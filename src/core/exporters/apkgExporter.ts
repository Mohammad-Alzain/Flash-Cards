import { Platform } from 'react-native';
let SQLite: any = null;
if (Platform.OS !== 'web') {
  try { SQLite = require('expo-sqlite'); } catch {}
}
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { getDatabase } from '../db/connection';
import { deckRepository } from '../db/repositories/deckRepository';
import { mediaManager } from '../media/mediaManager';
import { ExportOptions, ExportResult } from './types';

// Simple DJB2-like checksum for first field string
function simpleChecksum(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Generate Anki-style 10-character GUID
function generateAnkiGuid(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  let res = '';
  for (let i = 0; i < 10; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// Extract all media references from note text (both [sound:...] and <... src="...">)
function extractMediaReferences(text: string): string[] {
  if (!text) return [];
  const refs: string[] = [];

  // 1. Match [sound:filename] or [sound:path/to/filename]
  const soundRegex = /\[sound:([^\]]+)\]/gi;
  let match: RegExpExecArray | null;
  while ((match = soundRegex.exec(text)) !== null) {
    const raw = match[1].trim();
    if (raw && !raw.startsWith('http://') && !raw.startsWith('https://') && !raw.startsWith('data:')) {
      let base = raw.split(/[/\\]/).pop() || raw;
      base = base.split(/[?#]/)[0].trim();
      if (base) {
        refs.push(base);
        try {
          const decoded = decodeURIComponent(base);
          if (decoded !== base) refs.push(decoded);
        } catch {}
      }
    }
  }

  // 2. Match src="..." or src='...' in media tags
  const srcRegex = /<(?:img|audio|video|source|track)\b[^>]*?\bsrc=["']?([^"'\s>]+)["']?/gi;
  while ((match = srcRegex.exec(text)) !== null) {
    const raw = match[1].trim();
    if (raw && !raw.startsWith('http://') && !raw.startsWith('https://') && !raw.startsWith('data:')) {
      let base = raw.split(/[/\\]/).pop() || raw;
      base = base.split(/[?#]/)[0].trim();
      if (base) {
        refs.push(base);
        try {
          const decoded = decodeURIComponent(base);
          if (decoded !== base) refs.push(decoded);
        } catch {}
      }
    }
  }

  return refs;
}

// Convert local file:// paths in fields to relative filenames for standard Anki export
function cleanFieldForAnkiExport(val: string): string {
  if (!val) return '';
  let cleaned = val.replace(
    /(<(?:img|audio|video|source|track)\b[^>]*?\bsrc=["']?)(?:file:\/\/[^"'\s>]*\/)([^"'\s>]+)(["']?)/gi,
    '$1$2$3'
  );
  cleaned = cleaned.replace(
    /\[sound:(?:file:\/\/[^\]]*\/)([^\]]+)\]/gi,
    '[sound:$1]'
  );
  return cleaned;
}

export async function exportToApkg(
  options: ExportOptions = {}
): Promise<ExportResult> {
  const db = await getDatabase();
  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  options.onProgress?.({
    stage: 'inspect',
    percent: 10,
    current: 10,
    total: 100,
    message: 'جاري فحص الرزم وتجهيز البطاقات للتصدير...',
  });

  // 1. Fetch decks and descendant subdecks
  let targetDeckIds: string[] = [];
  if (options.deckId) {
    targetDeckIds = await deckRepository.getDeckAndDescendantIds(options.deckId);
  }

  let decks: any[] = [];
  if (targetDeckIds.length > 0) {
    const placeholders = targetDeckIds.map(() => '?').join(',');
    decks = await db.getAllAsync<any>(
      `SELECT * FROM decks WHERE id IN (${placeholders}) AND archived = 0 ORDER BY name ASC`,
      ...targetDeckIds
    );
  } else {
    decks = await db.getAllAsync<any>('SELECT * FROM decks WHERE archived = 0 ORDER BY name ASC');
  }

  if (decks.length === 0) {
    throw new Error('No decks found to export');
  }

  // 2. Fetch note types
  const noteTypes = await db.getAllAsync<any>('SELECT * FROM note_types');

  // Build Anki Models & Decks JSON
  const ankiDecks: Record<string, any> = {};
  const deckIdMap = new Map<string, number>(); // internal ID -> Anki integer ID

  // Add default deck
  ankiDecks['1'] = {
    id: 1,
    mod: nowSec,
    name: 'Default',
    usn: 0,
    maxTaken: 60,
    collapsed: false,
    newToday: [0, 0],
    revToday: [0, 0],
    lrnToday: [0, 0],
    timeToday: [0, 0],
    conf: 1,
    desc: '',
  };

  let ankiDeckCounter = 1000;
  for (const d of decks) {
    const aId = ++ankiDeckCounter;
    deckIdMap.set(d.id, aId);
    ankiDecks[String(aId)] = {
      id: aId,
      mod: Math.floor(d.updated_at / 1000) || nowSec,
      name: d.name,
      usn: 0,
      maxTaken: 60,
      collapsed: false,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
      conf: 1,
      desc: d.description || '',
    };
  }

  const ankiModels: Record<string, any> = {};
  const modelIdMap = new Map<string, number>();
  let modelCounter = 2000;

  for (const nt of noteTypes) {
    const mId = ++modelCounter;
    modelIdMap.set(nt.id, mId);

    let fieldsArr: any[] = [];
    try {
      fieldsArr = JSON.parse(nt.fields_json);
    } catch {
      fieldsArr = [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }];
    }

    let tmplsArr: any[] = [];
    try {
      tmplsArr = JSON.parse(nt.templates_json);
    } catch {
      tmplsArr = [{ name: 'Card 1', ord: 0, qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr>{{Back}}' }];
    }

    ankiModels[String(mId)] = {
      id: mId,
      name: nt.name,
      type: nt.is_cloze ? 1 : 0,
      mod: nowSec,
      usn: -1,
      sortf: 0,
      did: 1,
      tmpls: tmplsArr.map((t: any, i: number) => ({
        name: t.name || `Card ${i + 1}`,
        ord: t.ord ?? i,
        qfmt: t.front_html || t.qfmt || '',
        afmt: t.back_html || t.afmt || '',
        bqfmt: '',
        bafmt: '',
        did: null,
      })),
      flds: fieldsArr.map((f: any, i: number) => ({
        name: f.name,
        ord: f.ord ?? i,
        sticky: false,
        rtl: false,
        font: 'Arial',
        size: 20,
        media: [],
      })),
      css: nt.css || '',
    };
  }

  // 3. Query notes and cards to export
  let cardsList: any[] = [];
  if (targetDeckIds.length > 0) {
    const placeholders = targetDeckIds.map(() => '?').join(',');
    cardsList = await db.getAllAsync<any>(
      `SELECT c.*, n.guid as note_guid, n.note_type_id, n.fields_json, n.tags as note_tags, n.created_at as note_created
       FROM cards c
       JOIN notes n ON c.note_id = n.id
       WHERE c.deck_id IN (${placeholders})`,
      ...targetDeckIds
    );
  } else {
    cardsList = await db.getAllAsync<any>(
      `SELECT c.*, n.guid as note_guid, n.note_type_id, n.fields_json, n.tags as note_tags, n.created_at as note_created
       FROM cards c
       JOIN notes n ON c.note_id = n.id`
    );
  }

  // Group by note
  const notesMap = new Map<string, any>();
  for (const c of cardsList) {
    if (!notesMap.has(c.note_id)) {
      notesMap.set(c.note_id, {
        note_id: c.note_id,
        guid: c.note_guid || generateAnkiGuid(),
        note_type_id: c.note_type_id,
        fields_json: c.fields_json,
        tags: c.note_tags || '',
        created_at: c.note_created,
        cards: [],
      });
    }
    notesMap.get(c.note_id)!.cards.push(c);
  }

  options.onProgress?.({
    stage: 'notes',
    percent: 30,
    current: 30,
    total: 100,
    message: `جاري كتابة قاعدة البيانات (${notesMap.size} ملاحظة، ${cardsList.length} بطاقة)...`,
  });

  // 4. Create temporary SQLite database for collection.anki2 in cacheDirectory
  const cacheDir = FileSystem.cacheDirectory || `${FileSystem.documentDirectory}cache/`;
  const baseDir = cacheDir.replace(/\/+$/, '');
  const dirPathForOpen = baseDir.replace(/^file:\/\//, '');
  const tempDbName = `temp_anki_${nowMs}.db`;
  const dbFilePath = baseDir.startsWith('file://')
    ? `${baseDir}/${tempDbName}`
    : `file://${baseDir}/${tempDbName}`;

  const tempDb = await SQLite.openDatabaseAsync(
    tempDbName,
    undefined,
    dirPathForOpen
  );

  const mediaRefList: string[] = [];

  try {
    await tempDb.execAsync(`
    PRAGMA foreign_keys = OFF;
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = OFF;

    CREATE TABLE col (
      id integer primary key,
      crt integer not null,
      mod integer not null,
      scm integer not null,
      ver integer not null,
      dty integer not null,
      usn integer not null,
      ls integer not null,
      conf text not null,
      models text not null,
      decks text not null,
      dconf text not null,
      tags text not null
    );

    CREATE TABLE notes (
      id integer primary key,
      guid text not null,
      mid integer not null,
      mod integer not null,
      usn integer not null,
      tags text not null,
      flds text not null,
      sfld text not null,
      csum integer not null,
      flags integer not null,
      data text not null
    );

    CREATE TABLE cards (
      id integer primary key,
      nid integer not null,
      did integer not null,
      ord integer not null,
      mod integer not null,
      usn integer not null,
      type integer not null,
      queue integer not null,
      due integer not null,
      ivl integer not null,
      factor integer not null,
      reps integer not null,
      lapses integer not null,
      left integer not null,
      odue integer not null,
      odid integer not null,
      flags integer not null,
      data text not null
    );

    CREATE TABLE revlog (
      id integer primary key,
      cid integer not null,
      usn integer not null,
      ease integer not null,
      ivl integer not null,
      lastIvl integer not null,
      factor integer not null,
      time integer not null,
      type integer not null
    );

    CREATE TABLE graves (
      usn integer not null,
      oid integer not null,
      type integer not null
    );
  `);

  // Default Anki Deck Configuration (dconf) - CRITICAL to prevent Anki 500 KeyError: 1
  const ankiDconf = {
    "1": {
      id: 1,
      mod: nowSec,
      name: "Default",
      usn: 0,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: {
        bury: true,
        delays: [1, 10],
        initialFactor: 2500,
        ints: [1, 4, 7],
        order: 1,
        perDay: 20,
        separate: true
      },
      rev: {
        bury: true,
        ease4: 1.3,
        fuzz: 0.05,
        ivlFct: 1,
        maxIvl: 36500,
        minSpace: 1,
        perDay: 200
      },
      lapse: {
        delays: [10],
        leechAction: 0,
        leechFails: 8,
        minInt: 1,
        mult: 0
      },
      dyn: false
    }
  };

  const ankiConf = {
    nextPos: 1,
    estTimes: true,
    activeDecks: [1],
    sortType: "noteFld",
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: 1,
    newBury: true,
    newSpread: 0,
    dueCounts: true,
    curModel: modelCounter > 2000 ? 2001 : 1,
    collapseTime: 1200
  };

  // Insert col row with valid dconf and conf
  await tempDb.runAsync(
    `INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`,
    nowSec,
    nowMs,
    nowMs,
    JSON.stringify(ankiConf),
    JSON.stringify(ankiModels),
    JSON.stringify(ankiDecks),
    JSON.stringify(ankiDconf)
  );

  // Insert notes & cards into tempDb inside an explicit transaction for 100x write speed
  let noteCounter = nowMs;
  let cardCounter = nowMs + 10000;

  await tempDb.execAsync('BEGIN TRANSACTION;');

  for (const [, n] of notesMap.entries()) {
    const ankiNid = ++noteCounter;
    const ankiMid = modelIdMap.get(n.note_type_id) || 2001;

    let fieldsObj: Record<string, string> = {};
    try {
      fieldsObj = JSON.parse(n.fields_json);
    } catch {}

    const modelDef = ankiModels[String(ankiMid)];
    const fieldVals: string[] = [];
    if (modelDef && modelDef.flds) {
      for (const f of modelDef.flds) {
        fieldVals.push(fieldsObj[f.name] || '');
      }
    } else {
      fieldVals.push(...Object.values(fieldsObj));
    }

    // Clean any local file:// paths for standard Anki export
    const cleanedFieldVals = fieldVals.map((v) => cleanFieldForAnkiExport(v));
    const fldsCombined = cleanedFieldVals.join('\x1f');
    const sfld = cleanedFieldVals[0] || '';
    const csum = simpleChecksum(sfld);

    // Format tags with Anki wrapping spaces: " tag1 tag2 "
    const rawTags = (n.tags || '').trim();
    const formattedTags = rawTags.length > 0 ? ` ${rawTags} ` : '';

    await tempDb.runAsync(
      `INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')`,
      ankiNid,
      n.guid,
      ankiMid,
      nowSec,
      formattedTags,
      fldsCombined,
      sfld,
      csum
    );

    // Scan for media references in field values: src="filename" or [sound:filename]
    if (options.includeMedia !== false) {
      for (const val of fieldVals) {
        const refs = extractMediaReferences(val);
        if (refs.length > 0) {
          mediaRefList.push(...refs);
        }
      }
    }

    for (const c of n.cards) {
      const ankiCid = ++cardCounter;
      const ankiDid = deckIdMap.get(c.deck_id) || 1;

      // Anki queue: 0=new, 1=learn, 2=review, -1=suspended
      let queue = 0;
      let cardType = 0; // 0=new, 1=learn, 2=review
      let ankiDue = 0;

      if (c.suspended) {
        queue = -1;
        cardType = 2;
        ankiDue = options.includeScheduling ? Math.max(0, Math.floor(((c.due || nowMs) - (nowSec * 1000)) / 86400000)) : ankiCid;
      } else if (c.state === 1 || c.state === 3) {
        queue = 1;
        cardType = 1;
        ankiDue = options.includeScheduling ? Math.floor((c.due || nowMs) / 1000) : ankiCid;
      } else if (c.state === 2) {
        queue = 2;
        cardType = 2;
        // In Anki, review cards due is an integer day offset relative to col.crt (nowSec)
        ankiDue = options.includeScheduling ? Math.max(0, Math.floor(((c.due || nowMs) - (nowSec * 1000)) / 86400000)) : ankiCid;
      } else {
        queue = 0;
        cardType = 0;
        ankiDue = ankiCid;
      }

      const factor = Math.round((c.ease_factor || 2.5) * 1000);
      const ivl = options.includeScheduling ? (c.interval_days || 0) : 0;
      const reps = options.includeScheduling ? (c.reps || 0) : 0;
      const lapses = options.includeScheduling ? (c.lapses || 0) : 0;

      await tempDb.runAsync(
        `INSERT INTO cards VALUES (?, ?, ?, ?, ?, -1, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, '')`,
        ankiCid,
        ankiNid,
        ankiDid,
        c.template_ord || 0,
        nowSec,
        cardType,
        queue,
        ankiDue,
        ivl,
        factor,
        reps,
        lapses,
        c.flag || 0
      );
    }
  }

  await tempDb.execAsync('COMMIT;');

  // Also query note_media table to ensure any media attached via database relation is captured
  if (options.includeMedia !== false) {
    try {
      const noteIds = Array.from(notesMap.keys());
      if (noteIds.length > 0) {
        for (let i = 0; i < noteIds.length; i += 400) {
          const chunk = noteIds.slice(i, i + 400);
          const placeholders = chunk.map(() => '?').join(',');
          const rows = await db.getAllAsync<{ filename: string }>(
            `SELECT m.filename FROM media m 
             JOIN note_media nm ON m.id = nm.media_id 
             WHERE nm.note_id IN (${placeholders})`,
            ...chunk
          );
          for (const r of rows) {
            if (r.filename) {
              const base = r.filename.split(/[/\\]/).pop() || r.filename;
              mediaRefList.push(base);
            }
          }
        }
      }
    } catch {}
  }
} finally {
  try {
    await tempDb.closeAsync();
  } catch {}
}

  // 5. Read collection.anki2 file bytes into JSZip
  const zip = new JSZip();

  const dbBase64 = await FileSystem.readAsStringAsync(dbFilePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  zip.file('collection.anki2', dbBase64, {
    base64: true,
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  });

  // 6. Add media files to zip
  const mediaMap: Record<string, string> = {};
  let mediaCounter = 0;
  const uniqueMedia = Array.from(new Set(mediaRefList.map((m) => m.trim()).filter(Boolean)));

  if (options.includeMedia !== false && uniqueMedia.length > 0) {
    options.onProgress?.({
      stage: 'media',
      percent: 50,
      current: 0,
      total: uniqueMedia.length,
      message: `جاري فحص وتجهيز الوسائط والصوتيات (${uniqueMedia.length} ملف)...`,
    });

    // Pre-index the media directory in 1 single filesystem call
    const mediaDir = mediaManager.getMediaDirectory();
    const diskMediaMap = new Map<string, string>(); // indexed filename variations -> full file URI

    try {
      if (mediaDir) {
        const files = await FileSystem.readDirectoryAsync(mediaDir);
        for (const f of files) {
          const fullUri = `${mediaDir}${f}`;
          diskMediaMap.set(f, fullUri);
          diskMediaMap.set(f.toLowerCase(), fullUri);
          try {
            diskMediaMap.set(decodeURIComponent(f).toLowerCase(), fullUri);
            diskMediaMap.set(f.normalize('NFC').toLowerCase(), fullUri);
            diskMediaMap.set(f.normalize('NFD').toLowerCase(), fullUri);
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[APKG Export] Could not index media directory:', e);
    }

    const totalMedia = uniqueMedia.length;
    const progressInterval = Math.max(1, Math.min(10, Math.floor(totalMedia / 25)));

    for (let idx = 0; idx < totalMedia; idx++) {
      const filename = uniqueMedia[idx];
      const cleanLower = filename.toLowerCase();

      // Instant O(1) in-memory lookup
      let existingUri: string | null = diskMediaMap.get(filename) || diskMediaMap.get(cleanLower) || null;
      if (!existingUri) {
        try {
          existingUri =
            diskMediaMap.get(decodeURIComponent(cleanLower)) ||
            diskMediaMap.get(cleanLower.normalize('NFC')) ||
            diskMediaMap.get(cleanLower.normalize('NFD')) ||
            null;
        } catch {}
      }

      // Fallback only if not in pre-indexed map
      if (!existingUri) {
        existingUri = await mediaManager.findExistingUri(filename);
      }

      if (existingUri) {
        try {
          const mediaBase64 = await FileSystem.readAsStringAsync(existingUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const indexStr = String(mediaCounter++);
          // CRITICAL: compression 'STORE' stores already-compressed media files instantly with ZERO CPU lag!
          zip.file(indexStr, mediaBase64, {
            base64: true,
            compression: 'STORE',
          });
          const baseCleanName = filename.split(/[/\\]/).pop() || filename;
          mediaMap[indexStr] = baseCleanName;
        } catch (mErr) {
          console.warn('[APKG Export] Could not read media file:', filename, mErr);
        }
      }

      // Dynamic live progress and cooperative event-loop yield
      if (idx % progressInterval === 0 || idx === totalMedia - 1) {
        const progressP = 50 + Math.round(((idx + 1) / totalMedia) * 30); // 50% to 80%
        options.onProgress?.({
          stage: 'media',
          percent: progressP,
          current: idx + 1,
          total: totalMedia,
          message: `جاري حزم الوسائط والصوتيات (${idx + 1}/${totalMedia})...`,
        });
        // Yield to JS event loop so UI ProgressBar renders fluidly
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  zip.file('media', JSON.stringify(mediaMap));

  // 7. Generate APKG zip archive with dynamic live progress
  options.onProgress?.({
    stage: 'compressing',
    percent: 82,
    current: 0,
    total: 100,
    message: 'جاري إنشاء حزمة APKG النهائية...',
  });

  const zipBase64 = await zip.generateAsync(
    {
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    },
    (metadata) => {
      const p = 82 + Math.round((metadata.percent / 100) * 16); // 82% to 98%
      options.onProgress?.({
        stage: 'compressing',
        percent: Math.min(98, p),
        current: Math.round(metadata.percent),
        total: 100,
        message: `جاري إنشاء حزمة APKG النهائية (${Math.round(metadata.percent)}%)...`,
      });
    }
  );

  // Target output
  const outDir = `${FileSystem.cacheDirectory}exports/`;
  const dirInfo = await FileSystem.getInfoAsync(outDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(outDir, { intermediates: true });
  }

  const exportDeckName = decks.length === 1 ? decks[0].name.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_') : 'Collection';
  const outFileName = `${exportDeckName}_${nowSec}.apkg`;
  const outFilePath = `${outDir}${outFileName}`;

  await FileSystem.writeAsStringAsync(outFilePath, zipBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Clean up temporary database file
  try {
    if (SQLite && typeof SQLite.deleteDatabaseAsync === 'function') {
      await SQLite.deleteDatabaseAsync(tempDbName, dirPathForOpen);
    }
  } catch {}
  try {
    await FileSystem.deleteAsync(dbFilePath, { idempotent: true });
  } catch {}

  const outInfo = await FileSystem.getInfoAsync(outFilePath);

  options.onProgress?.({
    stage: 'done',
    percent: 100,
    current: 100,
    total: 100,
    message: 'تم تجهيز الحزمة بنجاح!',
  });

  return {
    filePath: outFilePath,
    fileName: outFileName,
    cardCount: cardsList.length,
    noteCount: notesMap.size,
    mediaCount: mediaCounter,
    sizeBytes: outInfo.exists && 'size' in outInfo ? outInfo.size || 0 : 0,
  };
}
