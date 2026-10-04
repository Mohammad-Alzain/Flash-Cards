import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
let SQLite: any = null;
if (Platform.OS !== 'web') {
  try {
    SQLite = require('expo-sqlite');
  } catch {}
}
import { decompress as decompressZstd } from 'fzstd';
import { mediaManager } from '../media/mediaManager';
import { noteRepository } from '../db/repositories/noteRepository';
import { withDatabaseLock } from '../db/connection';
import { openZipArchive, IZipArchive, writeBytesToDisk } from './zipReader';
import {
  ImportPreviewResult,
  ParsedCardCandidate,
  ImportOptions,
} from './types';
import { CardState } from '../types/models';

export interface ApkgParsedCollection {
  decks: { id: string; name: string }[];
  models: {
    id: string;
    name: string;
    fields: string[];
    isCloze: boolean;
    templates: { name: string; qfmt: string; afmt: string }[];
    css: string;
  }[];
  cards: ParsedCardCandidate[];
  mediaCount: number;
}

function getTempDbLocation(tempDbName: string) {
  // Use cacheDirectory for temp DB extraction — it's always writable by expo-file-system.
  // SQLite.defaultDatabaseDirectory is managed internally by expo-sqlite and is NOT writable
  // via expo-file-system APIs (writeAsStringAsync / File.write) in Expo Go on Android.
  const cacheDir = FileSystem.cacheDirectory || `${FileSystem.documentDirectory}cache/`;
  const baseDir = cacheDir.replace(/\/+$/, '');
  // openDatabaseAsync needs a POSIX absolute path (no file:// prefix)
  const dirPathForOpen = baseDir.replace(/^file:\/\//, '');
  // writeBytesToDisk needs a file:// URI
  const targetPath = baseDir.startsWith('file://')
    ? `${baseDir}/${tempDbName}`
    : `file://${baseDir}/${tempDbName}`;
  return { baseDir, dirPathForOpen, targetPath };
}

async function extractDatabaseEntry(
  zipReader: IZipArchive,
  colDbFile: string,
  isZstd: boolean,
  targetPath: string
): Promise<void> {
  if (isZstd) {
    const compressedBytes = await zipReader.readEntryBytes(colDbFile);
    const decompressedBytes = decompressZstd(compressedBytes);
    await writeBytesToDisk(targetPath, decompressedBytes);
  } else {
    await zipReader.extractEntryToFile(colDbFile, targetPath);
  }
}

/**
 * Lightweight, zero-dependency Protobuf decoder for Anki Schema v18 config BLOBs.
 * Extracts length-delimited string fields (UTF-8) by field number.
 */
function decodeProtobufStrings(data: Uint8Array | ArrayBuffer | any): Record<number, string> {
  const result: Record<number, string> = {};
  if (!data) return result;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length === 0) return result;

  const decoder = new TextDecoder('utf-8');
  let pos = 0;
  while (pos < bytes.length) {
    let tag = 0;
    let shift = 0;
    while (pos < bytes.length) {
      const b = bytes[pos++];
      tag |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2) {
      let len = 0;
      shift = 0;
      while (pos < bytes.length) {
        const b = bytes[pos++];
        len |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      if (pos + len <= bytes.length) {
        const strBytes = bytes.subarray(pos, pos + len);
        try {
          result[fieldNumber] = decoder.decode(strBytes);
        } catch {}
        pos += len;
      } else {
        break;
      }
    } else if (wireType === 0) {
      while (pos < bytes.length && (bytes[pos++] & 0x80) !== 0) {}
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return result;
}

export type AnkiPackageKind = 'LEGACY_1' | 'LEGACY_2' | 'LATEST';

export const apkgImporter = {
  /**
   * Inspects an .apkg file using low-memory streaming reader.
   * Uses canonical Anki detection order (Section 2):
   * 1. collection.anki21b (LATEST, zstd-compressed SQLite schema v18)
   * 2. collection.anki21 (LEGACY_2, uncompressed SQLite schema v11)
   * 3. collection.anki2 (LEGACY_1, uncompressed SQLite schema v11)
   * NEVER reads collection.anki2 when anki21 / anki21b exists.
   */
  async inspectApkg(
    data: string | ArrayBuffer,
    fileName: string
  ): Promise<{ zipReader: IZipArchive; colDbFile: string | null; isZstd: boolean; kind: AnkiPackageKind }> {
    const zipReader = await openZipArchive(data);

    // Case-insensitive lookup for collection files in root archive
    const names = zipReader.getEntryNames();
    const findEntry = (baseName: string) =>
      names.find(
        (n) =>
          n.toLowerCase() === baseName.toLowerCase() ||
          n.toLowerCase().endsWith('/' + baseName.toLowerCase())
      );

    const entry21b = findEntry('collection.anki21b');
    const entry21 = findEntry('collection.anki21');
    const entry2 = findEntry('collection.anki2');

    let colDbFile: string | null = null;
    let isZstd = false;
    let kind: AnkiPackageKind = 'LEGACY_1';

    if (entry21b) {
      kind = 'LATEST';
      colDbFile = entry21b;
      isZstd = true;
    } else if (entry21) {
      kind = 'LEGACY_2';
      colDbFile = entry21;
      isZstd = false;
    } else if (entry2) {
      kind = 'LEGACY_1';
      colDbFile = entry2;
      isZstd = false;
    }

    return { zipReader, colDbFile, isZstd, kind };
  },

  /**
   * Generates a preview for .apkg files without loading the entire archive into RAM.
   */
  async generatePreview(
    data: string | ArrayBuffer,
    fileName: string
  ): Promise<ImportPreviewResult> {
    const { zipReader, colDbFile, isZstd } = await this.inspectApkg(data, fileName);

    if (!colDbFile) {
      zipReader.close();
      throw new Error('Invalid .apkg: Missing Anki collection database.');
    }

    // Extract collection database to SQLite location
    const tempDbName = `temp_col_${Date.now()}_${Math.floor(Math.random() * 10000)}.db`;
    const { dirPathForOpen, targetPath } = getTempDbLocation(tempDbName);

    try {
      await extractDatabaseEntry(zipReader, colDbFile, isZstd, targetPath);

      const tempDb: SQLiteDatabase = await SQLite.openDatabaseAsync(
        tempDbName,
        undefined,
        dirPathForOpen
      );
      let decksFound: string[] = [];
      let noteTypesFound: string[] = [];
      let totalCards = 0;

      try {
        // Check for dummy "Please update" note (Section 2 & 7)
        const checkDummy = await tempDb.getFirstAsync<{ flds: string }>(
          'SELECT flds FROM notes LIMIT 1;'
        ).catch(() => null);

        if (
          checkDummy &&
          checkDummy.flds &&
          checkDummy.flds.toLowerCase().includes('please update to the latest anki version')
        ) {
          throw new Error('ANKI_LATEST_REEXPORT_REQUIRED');
        }

        let colRow = await tempDb.getFirstAsync<{ decks: string; models: string; ver?: number }>(
          'SELECT decks, models, ver FROM col LIMIT 1;'
        ).catch(() => null);

        const schemaVer = Number(colRow?.ver || 11);

        if (colRow && colRow.decks) {
          try {
            const decksMap = typeof colRow.decks === 'string' ? JSON.parse(colRow.decks) : colRow.decks;
            decksFound = Object.values(decksMap).map((d: any) => d.name);
          } catch {}
        }

        if (colRow && colRow.models) {
          try {
            const modelsMap = typeof colRow.models === 'string' ? JSON.parse(colRow.models) : colRow.models;
            noteTypesFound = Object.values(modelsMap).map((m: any) => m.name);
          } catch {}
        }

        // Schema v18 fallback (side tables)
        if (schemaVer >= 18 || decksFound.length === 0) {
          try {
            const dRows = await tempDb.getAllAsync<{ name: string }>('SELECT name FROM decks;').catch(() => []);
            if (dRows && dRows.length > 0) {
              decksFound = dRows.map((d) => String(d.name || '').replace(/\u001f/g, '::'));
            }
            const mRows = await tempDb.getAllAsync<{ name: string }>('SELECT name FROM notetypes;').catch(() => []);
            if (mRows && mRows.length > 0) {
              noteTypesFound = mRows.map((m) => m.name);
            }
          } catch {}
        }

        const cardCountRow = await tempDb.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM cards;'
        ).catch(() => null);
        totalCards = Number(cardCountRow?.count || 0);

        if (totalCards === 0) {
          const noteCountRow = await tempDb.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM notes;'
          ).catch(() => null);
          totalCards = Number(noteCountRow?.count || 0);
        }

        // Clean up decksFound: if only 'Default' is found, add filename if meaningful
        if (decksFound.length === 0 || (decksFound.length === 1 && decksFound[0] === 'Default')) {
          const cleanName = fileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();
          if (cleanName && cleanName !== 'collection' && cleanName !== 'deck') {
            decksFound = [cleanName];
          }
        }
      } catch (e: any) {
        if (e?.message === 'ANKI_LATEST_REEXPORT_REQUIRED') {
          throw e;
        }
        console.warn('[APKG Preview] Could not read col metadata:', e);
      } finally {
        try {
          await tempDb.closeAsync();
        } catch {}
      }

      return {
        sourceType: 'apkg',
        fileName,
        totalRows: totalCards,
        decksFound,
        noteTypesFound,
        sampleRows: decksFound.map((d) => [d]),
      };
    } finally {
      try {
        if (SQLite?.deleteDatabaseAsync) {
          await SQLite.deleteDatabaseAsync(tempDbName, dirPathForOpen);
        }
      } catch {}
      try {
        await FileSystem.deleteAsync(targetPath, { idempotent: true });
      } catch {}
      zipReader.close();
    }
  },

  /**
   * Fully extracts models, decks, notes, cards, and media from an .apkg file.
   * Extracts SQLite database FIRST, then all media files (audio, image, video, fonts).
   */
  async extractFullCollection(
    data: string | ArrayBuffer,
    options: ImportOptions
  ): Promise<ApkgParsedCollection> {
    const { zipReader, colDbFile, isZstd } = await this.inspectApkg(data, 'collection.apkg');

    if (!colDbFile) {
      zipReader.close();
      throw new Error('Invalid .apkg: Missing Anki collection database.');
    }

    options.onProgress?.({
      stage: 'inspect',
      percent: 5,
      current: 0,
      total: 100,
      message: 'جاري فك ضغط واستخراج قاعدة البيانات...',
    });

    let mediaCount = 0;
    const tempDbName = `import_${Date.now()}_${Math.floor(Math.random() * 10000)}.db`;
    const { dirPathForOpen, targetPath } = getTempDbLocation(tempDbName);

    const parsedDecks: { id: string; name: string }[] = [];
    const parsedModels: any[] = [];
    const parsedCards: ParsedCardCandidate[] = [];

    try {
      // 1. Extract SQLite collection database FIRST
      await extractDatabaseEntry(zipReader, colDbFile, isZstd, targetPath);

      options.onProgress?.({
        stage: 'inspect',
        percent: 15,
        current: 15,
        total: 100,
        message: 'تم استخراج قاعدة البيانات، جاري قراءة البطاقات...',
      });

      const tempDb: SQLiteDatabase = await SQLite.openDatabaseAsync(
        tempDbName,
        undefined,
        dirPathForOpen
      );

      try {
        // Check for dummy "Please update" note (Section 2 & 7)
        const checkDummy = await tempDb.getFirstAsync<{ flds: string }>(
          'SELECT flds FROM notes LIMIT 1;'
        ).catch(() => null);

        if (
          checkDummy &&
          checkDummy.flds &&
          checkDummy.flds.toLowerCase().includes('please update to the latest anki version')
        ) {
          throw new Error('ANKI_LATEST_REEXPORT_REQUIRED');
        }

        let colRow = await tempDb.getFirstAsync<{ decks: string; models: string; crt: number; ver?: number }>(
          'SELECT decks, models, crt, ver FROM col LIMIT 1;'
        ).catch(() => null);

        let decksMap: Record<string, any> = {};
        let modelsMap: Record<string, any> = {};
        const colCrtSec = Number(colRow?.crt || Math.floor(Date.now() / 1000));
        const schemaVer = Number(colRow?.ver || 11);

        if (colRow) {
          try {
            decksMap = typeof colRow.decks === 'string' ? JSON.parse(colRow.decks) : (colRow.decks || {});
          } catch {}
          try {
            modelsMap = typeof colRow.models === 'string' ? JSON.parse(colRow.models) : (colRow.models || {});
          } catch {}
        }

        // Schema v18 handling (side tables: notetypes, fields, templates, decks)
        if (schemaVer >= 18 || Object.keys(modelsMap).length === 0) {
          try {
            const ntRows = await tempDb.getAllAsync<{ id: string | number; name: string; config?: any }>(
              'SELECT id, name, config FROM notetypes;'
            ).catch(() => []);

            const fRows = await tempDb.getAllAsync<{ ntid: string | number; ord: number; name: string }>(
              'SELECT ntid, ord, name FROM fields ORDER BY ntid, ord ASC;'
            ).catch(() => []);

            const tRows = await tempDb.getAllAsync<{ ntid: string | number; ord: number; name: string; config?: any }>(
              'SELECT ntid, ord, name, config FROM templates ORDER BY ntid, ord ASC;'
            ).catch(() => []);

            const dRows = await tempDb.getAllAsync<{ id: string | number; name: string }>(
              'SELECT id, name FROM decks;'
            ).catch(() => []);

            for (const d of dRows) {
              const cleanName = String(d.name || '').replace(/\u001f/g, '::');
              decksMap[String(d.id)] = { id: String(d.id), name: cleanName };
            }

            for (const nt of ntRows) {
              const ntIdStr = String(nt.id);
              const ntFields = fRows
                .filter((f) => String(f.ntid) === ntIdStr)
                .sort((a, b) => a.ord - b.ord)
                .map((f) => ({ name: f.name, ord: f.ord }));

              const ntTemplates = tRows
                .filter((t) => String(t.ntid) === ntIdStr)
                .sort((a, b) => a.ord - b.ord)
                .map((t) => {
                  const proto = decodeProtobufStrings(t.config);
                  return {
                    name: t.name || 'Card',
                    ord: t.ord,
                    qfmt: proto[1] || '{{Front}}',
                    afmt: proto[2] || '{{Back}}',
                  };
                });

              const ntProto = decodeProtobufStrings(nt.config);
              const css = ntProto[3] || '';

              modelsMap[ntIdStr] = {
                id: ntIdStr,
                name: nt.name,
                flds: ntFields,
                tmpls: ntTemplates,
                css,
                type: 0,
              };
            }
          } catch (v18Err) {
            console.warn('[APKG Import] Schema v18 reading error:', v18Err);
          }
        }

        for (const [did, d] of Object.entries<any>(decksMap)) {
          if (d && d.name) {
            parsedDecks.push({ id: did, name: d.name });
          }
        }

        for (const [mid, m] of Object.entries<any>(modelsMap)) {
          if (!m) continue;
          parsedModels.push({
            id: String(mid),
            name: m.name || `NoteType_${mid}`,
            fields: Array.isArray(m.flds)
              ? [...m.flds].sort((a: any, b: any) => (a.ord || 0) - (b.ord || 0)).map((f: any) => f?.name || 'Field')
              : [],
            isCloze: m.type === 1,
            templates: Array.isArray(m.tmpls)
              ? [...m.tmpls].sort((a: any, b: any) => (a.ord || 0) - (b.ord || 0)).map((t: any) => ({
                  name: t?.name || 'Card',
                  ord: t?.ord ?? 0,
                  qfmt: t?.qfmt || '{{Front}}',
                  afmt: t?.afmt || '{{Back}}',
                }))
              : [],
            css: m.css || '',
          });
        }

        // Ensure at least one fallback model exists
        if (parsedModels.length === 0) {
          parsedModels.push({
            id: '1',
            name: 'Basic',
            fields: ['Front', 'Back'],
            isCloze: false,
            templates: [{ name: 'Card 1', ord: 0, qfmt: '{{Front}}', afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}' }],
            css: '',
          });
        }

        // Auto-create or map note types in local database with exact templates & CSS inside withDatabaseLock
        const modelIdToLocalNoteTypeId = new Map<string, string>();

        await withDatabaseLock(async (mainDb) => {
          const existingNoteTypes = await mainDb.getAllAsync<{ id: string; name: string }>(
            'SELECT id, name FROM note_types;'
          );

          for (const model of parsedModels) {
            const lowerName = model.name.toLowerCase();
            const existing = existingNoteTypes.find((nt) => nt.name.toLowerCase() === lowerName);

            const formattedFields = model.fields.map((f: string, ord: number) => ({
              id: `fld_${ord}`,
              name: f,
              ord,
            }));

            const formattedTemplates = model.templates.map((t: any, ord: number) => ({
              id: `tmpl_${ord}`,
              name: t.name,
              ord: t.ord ?? ord,
              qfmt: t.qfmt,
              afmt: t.afmt,
              front_html: t.qfmt || '{{Front}}',
              back_html: t.afmt || '{{Back}}',
            }));

            if (existing) {
              modelIdToLocalNoteTypeId.set(String(model.id), existing.id);
              modelIdToLocalNoteTypeId.set(lowerName, existing.id);
            } else {
              const newId = `nt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              const now = Date.now();
              await mainDb.runAsync(
                `INSERT INTO note_types (id, name, fields_json, templates_json, css, is_cloze, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?);`,
                newId,
                model.name,
                JSON.stringify(formattedFields),
                JSON.stringify(formattedTemplates),
                model.css || '.card { font-size: 20px; text-align: center; }',
                model.isCloze ? 1 : 0,
                now
              );
              modelIdToLocalNoteTypeId.set(String(model.id), newId);
              modelIdToLocalNoteTypeId.set(lowerName, newId);
              existingNoteTypes.push({
                id: newId,
                name: model.name,
              });
            }
          }
        });

        // Paged query for notes (Section 3: WHERE id > ? ORDER BY id ASC LIMIT 1000)
        const notesMap = new Map<string, any>();
        let lastNoteId = 0;
        while (true) {
          const page = await tempDb.getAllAsync<any>(
            'SELECT id, guid, mid, flds, tags FROM notes WHERE id > ? ORDER BY id ASC LIMIT 1000;',
            lastNoteId
          ).catch(() => []);
          if (!page || page.length === 0) break;
          for (const n of page) {
            if (n && n.id != null) {
              notesMap.set(String(n.id), n);
              lastNoteId = Number(n.id);
            }
          }
        }

        // Paged query for cards (Section 3: WHERE id > ? ORDER BY id ASC LIMIT 1000)
        const cardsRows: any[] = [];
        let lastCardId = 0;
        while (true) {
          const page = await tempDb.getAllAsync<any>(
            'SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses, odid, odue FROM cards WHERE id > ? ORDER BY id ASC LIMIT 1000;',
            lastCardId
          ).catch(() => []);
          if (!page || page.length === 0) break;
          for (const c of page) {
            cardsRows.push(c);
            if (c && c.id != null) {
              lastCardId = Number(c.id);
            }
          }
        }

        // Helper to extract fields from a note and model with dynamic fallbacks
        const getFieldsForNote = (note: any, model: any): Record<string, string> => {
          const fieldValues = String(note.flds || '').split('\x1f');
          const fields: Record<string, string> = {};

          if (model && Array.isArray(model.flds) && model.flds.length > 0) {
            const sortedFlds = [...model.flds].sort((a: any, b: any) => (a.ord || 0) - (b.ord || 0));
            sortedFlds.forEach((fDef: any, idx: number) => {
              const fName = typeof fDef === 'string' ? fDef : (fDef?.name || `Field_${idx + 1}`);
              fields[fName] = fieldValues[idx] || '';
            });
          } else if (model && Array.isArray(model.fields) && model.fields.length > 0) {
            model.fields.forEach((fName: string, idx: number) => {
              fields[fName] = fieldValues[idx] || '';
            });
          } else {
            // Dynamic fallback when model field definitions are not available
            if (fieldValues.length === 1) {
              fields['Front'] = fieldValues[0] || '';
              fields['Back'] = '';
            } else {
              fields['Front'] = fieldValues[0] || '';
              fields['Back'] = fieldValues[1] || '';
              for (let idx = 2; idx < fieldValues.length; idx++) {
                fields[`Field ${idx + 1}`] = fieldValues[idx] || '';
              }
            }
          }
          return fields;
        };

        const resolveDeckName = (did: any): string => {
          let deckName = did != null
            ? (decksMap[String(did)]?.name || decksMap[Number(did)]?.name || decksMap[did]?.name)
            : null;

          if (!deckName || deckName === 'Default') {
            const customDeck = parsedDecks.find((d) => d.name && d.name !== 'Default');
            if (customDeck) {
              deckName = customDeck.name;
            }
          }
          return deckName || 'Default';
        };

        const dayNumberToMs = (crtSec: number, dueDays: number) => (crtSec + dueDays * 86400) * 1000;

        for (const c of cardsRows) {
          const note = notesMap.get(String(c.nid));
          if (!note) continue;

          let model = modelsMap[String(note.mid)] || modelsMap[Number(note.mid)] || modelsMap[note.mid];
          if (!model && parsedModels.length > 0) {
            model = parsedModels[0];
          }

          const fields = getFieldsForNote(note, model);

          // Filtered decks: if odid != 0, card belongs to odid and real due is odue (Section 5)
          const targetDid = (c.odid && c.odid !== 0) ? c.odid : c.did;
          const rawDue = (c.odid && c.odid !== 0 && c.odue !== 0) ? c.odue : c.due;

          const deckName = resolveDeckName(targetDid);
          const noteTypeName = model?.name || parsedModels[0]?.name || 'Basic';

          // Exact state & scheduling conversion (Section 4 & 5)
          let dueMs = 0;
          let intervalDays = 0;
          let easeFactor = (c.factor && c.factor > 0) ? c.factor / 1000 : 2.5;
          let state = CardState.New;

          if (options.keepScheduling) {
            if (c.queue === 0) {
              // New card: keep relative insertion order by due (integer)
              state = CardState.New;
              dueMs = Number(rawDue || 0);
              intervalDays = 0;
            } else if (c.queue === 1) {
              // Learning: due is in unix seconds
              state = CardState.Learning;
              dueMs = (rawDue || 0) * 1000;
              intervalDays = c.ivl < 0 ? 0 : (c.ivl || 0); // negative = seconds (intraday learning)
            } else if (c.queue === 2 || c.queue === 3) {
              // Review (2) or Day-learning (3): due is in days since col.crt
              state = c.queue === 3 ? CardState.Learning : CardState.Review;
              dueMs = dayNumberToMs(colCrtSec, rawDue || 0);
              intervalDays = c.ivl > 0 ? c.ivl : 1;
            } else if (c.queue === -1) {
              // Suspended
              state = CardState.Review;
              intervalDays = c.ivl > 0 ? c.ivl : 1;
              dueMs = dayNumberToMs(colCrtSec, rawDue || 0);
            }
          } else {
            // Reset scheduling: all cards become New
            state = CardState.New;
            dueMs = Number(rawDue || 0);
            intervalDays = 0;
            easeFactor = 2.5;
          }

          const localNoteTypeId =
            modelIdToLocalNoteTypeId.get(String(note.mid)) ||
            modelIdToLocalNoteTypeId.get(String(model?.id)) ||
            modelIdToLocalNoteTypeId.get(model?.name?.toLowerCase() || '') ||
            undefined;

          parsedCards.push({
            guid: note.guid,
            fields,
            tags: note.tags || '',
            deckName,
            noteTypeName,
            noteTypeId: localNoteTypeId,
            templateOrd: c.ord || 0,
            due: dueMs,
            intervalDays,
            easeFactor,
            reps: c.reps || 0,
            lapses: c.lapses || 0,
            state,
          });
        }

        // If cards table was empty or cards query failed, synthesize cards directly from notesMap
        if (parsedCards.length === 0 && notesMap.size > 0) {
          console.log(`[APKG Import] Synthesizing ${notesMap.size} cards directly from notes`);
          const fallbackDeckName = resolveDeckName(null);
          for (const note of notesMap.values()) {
            let model = modelsMap[String(note.mid)] || modelsMap[Number(note.mid)] || modelsMap[note.mid];
            if (!model && parsedModels.length > 0) {
              model = parsedModels[0];
            }
            const fields = getFieldsForNote(note, model);
            const noteTypeName = model?.name || parsedModels[0]?.name || 'Basic';
            const localNoteTypeId =
              modelIdToLocalNoteTypeId.get(String(note.mid)) ||
              modelIdToLocalNoteTypeId.get(String(model?.id)) ||
              modelIdToLocalNoteTypeId.get(model?.name?.toLowerCase() || '') ||
              undefined;

            parsedCards.push({
              guid: note.guid,
              fields,
              tags: note.tags || '',
              deckName: fallbackDeckName,
              noteTypeName,
              noteTypeId: localNoteTypeId,
              templateOrd: 0,
              due: Date.now(),
              intervalDays: 0,
              easeFactor: 2.5,
              reps: 0,
              lapses: 0,
              state: CardState.New,
            });
          }
        }
      } finally {
        try {
          await tempDb.closeAsync();
        } catch {}
      }

      // 2. Extract All Media Files (audio, images, video, fonts) in an optimized streaming pipeline
      await mediaManager.ensureDirectoryExists();
      if (zipReader.hasEntry('media')) {
        try {
          const mediaJsonStr = await zipReader.readEntryText('media');
          let mediaMap: Record<string, string> = {};
          try {
            mediaMap = JSON.parse(mediaJsonStr || '{}');
          } catch {}

          const mediaEntries = Object.entries(mediaMap);
          const totalMedia = mediaEntries.length;

          // Check which media files already exist to skip re-extracting them
          const mediaDir = mediaManager.getMediaDirectory();
          let existingMediaFiles = new Set<string>();
          try {
            const dirFiles = await FileSystem.readDirectoryAsync(mediaDir);
            existingMediaFiles = new Set(dirFiles);
          } catch {}

          let processed = 0;
          let lastProgressUpdate = 0;
          const MAX_CONCURRENT_WRITES = 4;
          const activeWrites: Promise<void>[] = [];

          for (const [numKey, rawFilename] of mediaEntries) {
            processed++;

            // Clean & normalize filename according to Section 6
            let cleanFilename = rawFilename;
            try {
              cleanFilename = decodeURIComponent(rawFilename);
            } catch {}
            cleanFilename = cleanFilename.normalize('NFC').trim();

            // Zip-slip protection (Section 6)
            if (
              cleanFilename.includes('..') ||
              cleanFilename.includes('/') ||
              cleanFilename.includes('\\')
            ) {
              console.warn('[APKG Media] Rejected invalid filename (zip-slip):', cleanFilename);
              continue;
            }

            if (existingMediaFiles.has(cleanFilename)) {
              // Already extracted from previous run, instantly count it
              mediaCount++;
            } else if (zipReader.hasEntry(numKey)) {
              try {
                // Sequential read from ZIP (streams slice directly from disk)
                const bytes = await zipReader.readEntryBytes(numKey);
                const targetUri = mediaManager.resolveUri(cleanFilename);

                // Asynchronous background disk write with bounded concurrency
                const p = writeBytesToDisk(targetUri, bytes, true)
                  .then(() => {
                    mediaCount++;
                  })
                  .catch((err) => {
                    console.warn(`[APKG] Failed to write media ${cleanFilename}:`, err);
                  });

                const tracked: Promise<void> = p.finally(() => {
                  const idx = activeWrites.indexOf(tracked);
                  if (idx !== -1) {
                    activeWrites.splice(idx, 1);
                  }
                });

                activeWrites.push(tracked);

                // Bound concurrency of active disk writes strictly to MAX_CONCURRENT_WRITES
                if (activeWrites.length >= MAX_CONCURRENT_WRITES) {
                  await Promise.race(activeWrites);
                }
              } catch (mediaErr) {
                console.warn(`[APKG] Failed to extract entry ${numKey}:`, mediaErr);
              }
            }

            // Yield event loop every 40 media entries to keep UI 60fps and allow GC
            if (processed % 40 === 0) {
              await new Promise((r) => setTimeout(r, 4));
            }

            // Throttle UI progress update to at most once per 150ms to keep React Native thread silky smooth
            const now = Date.now();
            if (now - lastProgressUpdate > 150 || processed === totalMedia) {
              lastProgressUpdate = now;
              const mediaPercent = 15 + Math.round((processed / Math.max(1, totalMedia)) * 48);
              options.onProgress?.({
                stage: 'media',
                percent: mediaPercent,
                current: processed,
                total: totalMedia,
                message: `جاري استخراج ملفات الوسائط والصوتيات (${processed}/${totalMedia})...`,
              });
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          // Await any remaining disk writes
          await Promise.all(activeWrites);
        } catch (e) {
          console.warn('[APKG] Failed to process media mapping:', e);
        }
      }

      options.onProgress?.({
        stage: 'parsing',
        percent: 65,
        current: parsedCards.length,
        total: parsedCards.length,
        message: `تم تجهيز ${parsedCards.length} بطاقة للاستيراد`,
      });

      return {
        decks: parsedDecks,
        models: parsedModels,
        cards: parsedCards,
        mediaCount,
      };
    } finally {
      try {
        if (SQLite?.deleteDatabaseAsync) {
          await SQLite.deleteDatabaseAsync(tempDbName, dirPathForOpen);
        }
      } catch {}
      try {
        await FileSystem.deleteAsync(targetPath, { idempotent: true });
      } catch {}
      zipReader.close();
    }
  },
};
