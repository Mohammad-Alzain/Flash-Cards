import { getDatabase } from '../db/connection';
import {
  ParsedCardCandidate,
  ImportOptions,
  ImportSummary,
  ImportSourceType,
} from './types';
import { deckRepository } from '../db/repositories/deckRepository';
import { noteRepository } from '../db/repositories/noteRepository';
import { CardState } from '../types/models';

// Helper function to resolve/create hierarchical deck tree (Section 4 & 5)
async function resolveDeckHierarchy(
  fullName: string,
  deckMap: Map<string, string>
): Promise<string> {
  const parts = fullName.split('::').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';

  let currentPath = '';
  let parentId: string | null = null;

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}::${part}` : part;
    const lowerKey = currentPath.toLowerCase();

    if (deckMap.has(lowerKey)) {
      parentId = deckMap.get(lowerKey)!;
    } else {
      const newDeck = await deckRepository.create(part, undefined, parentId);
      deckMap.set(lowerKey, newDeck.id);
      parentId = newDeck.id;
    }
  }

  return parentId || '';
}

export const importManager = {
  /**
   * Imports a list of card candidates into SQLite with duplicate handling and transactions
   */
  async executeImport(
    candidates: ParsedCardCandidate[],
    sourceType: ImportSourceType,
    fileName: string,
    options: ImportOptions
  ): Promise<ImportSummary> {
    const db = await getDatabase();
    const historyId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Cache of deck name -> deck id
    const existingDecks = await deckRepository.getAllWithCounts();
    const deckMap = new Map<string, string>();
    existingDecks.forEach((d) => deckMap.set(d.name.toLowerCase(), d.id));

    // Cache of note type name -> note type id
    const existingNoteTypes = await noteRepository.getAllNoteTypes();
    const noteTypeMap = new Map<string, string>();
    existingNoteTypes.forEach((nt) => noteTypeMap.set(nt.name.toLowerCase(), nt.id));

    // Fallback note type ID if options.noteTypeId is not set
    const fallbackNoteTypeId = options.noteTypeId || existingNoteTypes[0]?.id || '';

    // Preload existing notes and cards for instant duplicate checking
    const existingNotesRows = await db.getAllAsync<{
      id: string;
      guid: string | null;
      sort_field: string;
      note_type_id: string;
    }>('SELECT id, guid, sort_field, note_type_id FROM notes;').catch(() => []);

    const existingNotesByGuid = new Map<string, string>();
    const existingNotesBySortField = new Map<string, string>();
    for (const row of existingNotesRows) {
      if (row.guid) existingNotesByGuid.set(row.guid, row.id);
      if (row.sort_field && row.sort_field.trim().length > 0) {
        existingNotesBySortField.set(`${row.sort_field.trim()}:::${row.note_type_id}`, row.id);
      }
    }

    const existingCardsRows = await db.getAllAsync<{ id: string; note_id: string; template_ord: number }>(
      'SELECT id, note_id, template_ord FROM cards;'
    ).catch(() => []);
    const existingCardsByNoteAndOrd = new Set<string>();
    for (const c of existingCardsRows) {
      existingCardsByNoteAndOrd.add(`${c.note_id}:::${c.template_ord ?? 0}`);
    }

    // Chunk in batches of 250 for smooth UI responsiveness
    const BATCH_SIZE = 250;

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      await db.withTransactionAsync(async () => {
        for (const candidate of batch) {
          try {
            // 1. Resolve Target Deck with tree hierarchy support (Section 4 & 5)
            let targetDeckId = options.targetDeckId;
            if (candidate.deckName) {
              const hierarchicalId = await resolveDeckHierarchy(candidate.deckName, deckMap);
              if (hierarchicalId) {
                targetDeckId = hierarchicalId;
              }
            }
            if (!targetDeckId) {
              targetDeckId = existingDecks[0]?.id || '';
            }

            // 2. Resolve Target Note Type
            let targetNoteTypeId = candidate.noteTypeId || fallbackNoteTypeId;
            if (!candidate.noteTypeId && candidate.noteTypeName) {
              const ntKey = candidate.noteTypeName.toLowerCase();
              if (noteTypeMap.has(ntKey)) {
                targetNoteTypeId = noteTypeMap.get(ntKey)!;
              }
            } else if (!candidate.noteTypeId && options.noteTypeId) {
              targetNoteTypeId = options.noteTypeId;
            }

            // 3. Determine Sort Field
            const firstFieldVal = Object.values(candidate.fields)[0] || '';
            const sortField = firstFieldVal.trim();
            const guid = candidate.guid || `guid_${now}_${Math.random().toString(36).substring(2, 9)}`;

            // 4. Duplicate Check
            let existingNoteId: string | undefined = undefined;
            if (candidate.guid && existingNotesByGuid.has(candidate.guid)) {
              existingNoteId = existingNotesByGuid.get(candidate.guid);
            } else if (sourceType !== 'apkg' && sortField.length > 0 && existingNotesBySortField.has(`${sortField}:::${targetNoteTypeId}`)) {
              existingNoteId = existingNotesBySortField.get(`${sortField}:::${targetNoteTypeId}`);
            }

            const templateOrd = candidate.templateOrd || 0;

            if (existingNoteId) {
              const cardKey = `${existingNoteId}:::${templateOrd}`;
              const cardExists = existingCardsByNoteAndOrd.has(cardKey);

              if (options.duplicateStrategy === 'skip') {
                if (cardExists) {
                  // Repair note_type_id if it was previously pointing to fallback nt_basic
                  if (targetNoteTypeId && targetNoteTypeId !== 'nt_basic') {
                    await db.runAsync(
                      "UPDATE notes SET note_type_id = ? WHERE id = ? AND (note_type_id = 'nt_basic' OR note_type_id IS NULL);",
                      targetNoteTypeId,
                      existingNoteId
                    );
                  }
                  skipped++;
                  continue;
                }
                // Note exists but lacks this card (e.g. another card template or cloze) -> insert the card!
              } else if (options.duplicateStrategy === 'update') {
                await db.runAsync(
                  'UPDATE notes SET note_type_id = ?, fields_json = ?, tags = ?, updated_at = ? WHERE id = ?;',
                  targetNoteTypeId,
                  JSON.stringify(candidate.fields),
                  candidate.tags || '',
                  now,
                  existingNoteId
                );
                if (cardExists) {
                  updated++;
                  continue;
                }
                // If it lacked this card, fall through to insert the card!
              }
              // If options.duplicateStrategy === 'new', do not skip, insert new note and card!
            }

            // 5. Insert Note
            const noteId =
              existingNoteId && options.duplicateStrategy !== 'new'
                ? existingNoteId
                : `note_${now}_${added}_${Math.random().toString(36).substring(2, 6)}`;

            if (!existingNoteId || options.duplicateStrategy === 'new') {
              await db.runAsync(
                `INSERT INTO notes (id, guid, note_type_id, fields_json, tags, sort_field, checksum, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?);`,
                noteId,
                guid,
                targetNoteTypeId,
                JSON.stringify(candidate.fields),
                candidate.tags || '',
                sortField,
                now,
                now
              );
              if (guid) existingNotesByGuid.set(guid, noteId);
              if (sortField) existingNotesBySortField.set(`${sortField}:::${targetNoteTypeId}`, noteId);
            }

            // 6. Insert Card
            const cardId = `card_${now}_${added}_${Math.random().toString(36).substring(2, 6)}`;
            const due = candidate.due || now;
            const state = candidate.state ?? CardState.New;
            const intervalDays = candidate.intervalDays || 0;
            const easeFactor = candidate.easeFactor || 2.5;
            const reps = candidate.reps || 0;
            const lapses = candidate.lapses || 0;

            await db.runAsync(
              `INSERT INTO cards (
                 id, note_id, deck_id, template_ord, state, due, stability, difficulty,
                 elapsed_days, scheduled_days, reps, lapses, ease_factor, interval_days,
                 last_review, suspended, buried_until, flag, bookmarked, created_at, updated_at
               ) VALUES (
                 ?, ?, ?, ?, ?, ?, 0, 0,
                 0, 0, ?, ?, ?, ?,
                 NULL, 0, NULL, 0, 0, ?, ?
               );`,
              cardId,
              noteId,
              targetDeckId,
              candidate.templateOrd || 0,
              state,
              due,
              reps,
              lapses,
              easeFactor,
              intervalDays,
              now,
              now
            );

            existingCardsByNoteAndOrd.add(`${noteId}:::${templateOrd}`);
            added++;
          } catch (itemErr: any) {
            errors.push(itemErr?.message || 'Error importing card item');
          }
        }
      });

      const currentProcessed = Math.min(i + BATCH_SIZE, candidates.length);
      const isApkg = sourceType === 'apkg';
      const basePercent = isApkg ? 65 : 0;
      const availablePercent = 100 - basePercent;
      const percent = basePercent + Math.round((currentProcessed / Math.max(1, candidates.length)) * availablePercent);

      options.onProgress?.({
        stage: 'saving',
        percent: Math.min(99, percent),
        current: currentProcessed,
        total: candidates.length,
        message: `جاري حفظ البطاقات في قاعدة البيانات (${currentProcessed}/${candidates.length})...`,
      });

      // Small yield to keep UI responsive and smooth
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    options.onProgress?.({
      stage: 'saving',
      percent: 100,
      current: candidates.length,
      total: candidates.length,
      message: 'اكتمل الاستيراد بنجاح!',
    });

    // 6. Record import history
    await db.runAsync(
      `INSERT INTO import_history (id, source_type, filename, imported_at, notes_added, notes_skipped, errors_json)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      historyId,
      sourceType,
      fileName,
      now,
      added,
      skipped,
      errors.length > 0 ? JSON.stringify(errors.slice(0, 50)) : null
    );

    return {
      historyId,
      sourceType,
      fileName,
      added,
      updated,
      skipped,
      errors,
    };
  },

  /**
   * Undoes an import by deleting notes and cards created in that import
   */
  async undoImport(historyId: string): Promise<boolean> {
    const db = await getDatabase();
    const historyItem = await db.getFirstAsync<any>(
      'SELECT * FROM import_history WHERE id = ?;',
      historyId
    );
    if (!historyItem) return false;

    // Delete notes imported within the timestamp window
    const startTime = historyItem.imported_at - 1000;
    const endTime = historyItem.imported_at + 120000;

    await db.runAsync(
      'DELETE FROM notes WHERE created_at >= ? AND created_at <= ?;',
      startTime,
      endTime
    );

    await db.runAsync('DELETE FROM import_history WHERE id = ?;', historyId);
    return true;
  },

  /**
   * Retrieves import history
   */
  async getHistory(): Promise<any[]> {
    const db = await getDatabase();
    return await db.getAllAsync<any>(
      'SELECT * FROM import_history ORDER BY imported_at DESC LIMIT 30;'
    );
  },
};
