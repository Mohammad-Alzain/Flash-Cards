import { Platform } from 'react-native';
let SQLite: any = null;
if (Platform.OS !== 'web') {
  try { SQLite = require('expo-sqlite'); } catch {}
}
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { getDatabase } from '../db/connection';
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

export async function exportToApkg(
  options: ExportOptions = {}
): Promise<ExportResult> {
  const db = await getDatabase();
  const nowSec = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();

  // 1. Fetch decks to export
  let decksQuery = 'SELECT * FROM decks WHERE archived = 0';
  const decksParams: any[] = [];
  if (options.deckId) {
    decksQuery += ' AND id = ?';
    decksParams.push(options.deckId);
  }
  const decks = await db.getAllAsync<any>(decksQuery, decksParams);

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
  let cardsQuery = `
    SELECT c.*, n.guid as note_guid, n.note_type_id, n.fields_json, n.tags as note_tags, n.created_at as note_created
    FROM cards c
    JOIN notes n ON c.note_id = n.id
  `;
  const cardsParams: any[] = [];
  if (options.deckId) {
    cardsQuery += ' WHERE c.deck_id = ?';
    cardsParams.push(options.deckId);
  }
  const cardsList = await db.getAllAsync<any>(cardsQuery, cardsParams);

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

  // 4. Create temporary SQLite database for collection.anki2
  const tempDbName = `temp_anki_${nowMs}.db`;
  const tempDb = await SQLite.openDatabaseAsync(tempDbName);

  await tempDb.execAsync(`
    PRAGMA foreign_keys = OFF;

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

  // Insert col row
  await tempDb.runAsync(
    `INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, '{}', ?, ?, '{}', '{}')`,
    [nowSec, nowMs, nowMs, JSON.stringify(ankiModels), JSON.stringify(ankiDecks)]
  );

  // Insert notes & cards into tempDb
  let noteCounter = nowMs;
  let cardCounter = nowMs + 10000;
  const mediaRefList: string[] = [];

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

    const fldsCombined = fieldVals.join('\x1f');
    const sfld = fieldVals[0] || '';
    const csum = simpleChecksum(sfld);

    // Format tags with Anki wrapping spaces: " tag1 tag2 "
    const rawTags = (n.tags || '').trim();
    const formattedTags = rawTags.length > 0 ? ` ${rawTags} ` : '';

    await tempDb.runAsync(
      `INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')`,
      [ankiNid, n.guid, ankiMid, nowSec, formattedTags, fldsCombined, sfld, csum]
    );

    // Scan for media references in field values: src="filename" or [sound:filename]
    if (options.includeMedia) {
      for (const val of fieldVals) {
        const imgMatches = val.match(/src=["']([^"']+)["']/g);
        if (imgMatches) {
          for (const m of imgMatches) {
            const clean = m.replace(/src=["']/, '').replace(/["']$/, '');
            mediaRefList.push(clean);
          }
        }
        const sndMatches = val.match(/\[sound:([^\]]+)\]/g);
        if (sndMatches) {
          for (const m of sndMatches) {
            const clean = m.replace(/\[sound:/, '').replace(/\]$/, '');
            mediaRefList.push(clean);
          }
        }
      }
    }

    for (const c of n.cards) {
      const ankiCid = ++cardCounter;
      const ankiDid = deckIdMap.get(c.deck_id) || 1;

      // Anki queue: 0=new, 1=learn, 2=review, -1=suspended
      let queue = 0;
      if (c.suspended) {
        queue = -1;
      } else if (c.state === 1 || c.state === 3) {
        queue = 1;
      } else if (c.state === 2) {
        queue = 2;
      }

      const factor = Math.round((c.ease_factor || 2.5) * 1000);
      const ivl = options.includeScheduling ? (c.interval_days || 0) : 0;
      const reps = options.includeScheduling ? (c.reps || 0) : 0;
      const lapses = options.includeScheduling ? (c.lapses || 0) : 0;

      await tempDb.runAsync(
        `INSERT INTO cards VALUES (?, ?, ?, ?, ?, -1, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, '')`,
        [
          ankiCid,
          ankiNid,
          ankiDid,
          c.template_ord || 0,
          nowSec,
          c.state || 0,
          queue,
          c.due || 0,
          ivl,
          factor,
          reps,
          lapses,
          c.flag || 0,
        ]
      );
    }
  }

  // Close temp db so file is unlocked for zip packaging
  await tempDb.closeAsync();

  // 5. Read collection.anki2 file bytes into JSZip
  const zip = new JSZip();
  const dbFilePath = `${FileSystem.documentDirectory}SQLite/${tempDbName}`;

  const dbBase64 = await FileSystem.readAsStringAsync(dbFilePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  zip.file('collection.anki2', dbBase64, { base64: true });

  // 6. Add media files to zip
  const mediaMap: Record<string, string> = {};
  let mediaCounter = 0;
  const uniqueMedia = Array.from(new Set(mediaRefList));

  for (const filename of uniqueMedia) {
    const localMediaPath = `${FileSystem.documentDirectory}media/${filename}`;
    const info = await FileSystem.getInfoAsync(localMediaPath);
    if (info.exists) {
      const mediaBase64 = await FileSystem.readAsStringAsync(localMediaPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const indexStr = String(mediaCounter++);
      zip.file(indexStr, mediaBase64, { base64: true });
      mediaMap[indexStr] = filename;
    }
  }

  zip.file('media', JSON.stringify(mediaMap));

  // 7. Generate APKG zip archive
  const zipBase64 = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

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
    await FileSystem.deleteAsync(dbFilePath, { idempotent: true });
  } catch {}

  const outInfo = await FileSystem.getInfoAsync(outFilePath);

  return {
    filePath: outFilePath,
    fileName: outFileName,
    cardCount: cardsList.length,
    noteCount: notesMap.size,
    mediaCount: mediaCounter,
    sizeBytes: outInfo.exists && 'size' in outInfo ? outInfo.size || 0 : 0,
  };
}
