import {
  getDatabase,
  withDatabaseLock,
  withDatabaseRead,
  setImportingState,
} from '../db/connection';
import {
  ParsedCardCandidate,
  ImportOptions,
  ImportSummary,
  ImportSourceType,
} from './types';
import { CardState } from '../types/models';

// Helper function to resolve/create hierarchical deck tree
async function resolveDeckHierarchy(
  fullName: string,
  deckMap: Map<string, string>,
  db: any
): Promise<string> {
  const parts = fullName.split('::').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';

  let currentPath = '';
  let parentId: string | null = null;
  const now = Date.now();

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}::${part}` : part;
    const lowerKey = currentPath.toLowerCase();

    if (deckMap.has(lowerKey)) {
      parentId = deckMap.get(lowerKey)!;
    } else {
      const id = `deck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.runAsync(
        `INSERT INTO decks (id, parent_id, name, description, created_at, updated_at, new_per_day, reviews_per_day)
         VALUES (?, ?, ?, ?, ?, ?, 20, 100);`,
        id,
        parentId || null,
        part,
        null,
        now,
        now
      );
      deckMap.set(lowerKey, id);
      parentId = id;
    }
  }

  return parentId || '';
}

export const importManager = {
  /**
   * Imports card candidates in efficient transactional batches with global lock.
   * Uses withTransactionAsync on the single main database connection to eliminate connection lockups.
   */
  async executeImport(
    candidates: ParsedCardCandidate[],
    sourceType: ImportSourceType,
    fileName: string,
    options: ImportOptions
  ): Promise<ImportSummary> {
    setImportingState(true);
    try {
      return await withDatabaseLock(async (db) => {
        const historyId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const now = Date.now();

        let added = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        // Preload decks
        const deckRows = await db.getAllAsync<{ id: string; name: string }>(
          'SELECT id, name FROM decks WHERE archived = 0;'
        );
        const deckMap = new Map<string, string>();
        deckRows.forEach((d) => deckMap.set(d.name.toLowerCase(), d.id));

        // Preload note types
        const ntRows = await db.getAllAsync<{ id: string; name: string }>(
          'SELECT id, name FROM note_types;'
        );
        const noteTypeMap = new Map<string, string>();
        ntRows.forEach((nt) => noteTypeMap.set(nt.name.toLowerCase(), nt.id));

        const fallbackNoteTypeId = options.noteTypeId || ntRows[0]?.id || '';

        // Preload existing notes and cards
        const existingNotesRows = await db.getAllAsync<{
          id: string;
          guid: string | null;
          sort_field: string;
          note_type_id: string;
        }>('SELECT id, guid, sort_field, note_type_id FROM notes;');

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
        );
        const existingCardsByNoteAndOrd = new Set<string>();
        for (const c of existingCardsRows) {
          existingCardsByNoteAndOrd.add(`${c.note_id}:::${c.template_ord ?? 0}`);
        }

        const BATCH_SIZE = 150;
        for (let batchStart = 0; batchStart < candidates.length; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, candidates.length);

          await db.withTransactionAsync(async () => {
            for (let i = batchStart; i < batchEnd; i++) {
              const candidate = candidates[i];

              // 1. Resolve Target Deck
              let targetDeckId = options.targetDeckId;
              if (candidate.deckName) {
                const hierarchicalId = await resolveDeckHierarchy(candidate.deckName, deckMap, db);
                if (hierarchicalId) {
                  targetDeckId = hierarchicalId;
                }
              }
              if (!targetDeckId) {
                targetDeckId = deckRows[0]?.id || '';
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
              } else if (sortField.length > 0 && existingNotesBySortField.has(`${sortField}:::${targetNoteTypeId}`)) {
                existingNoteId = existingNotesBySortField.get(`${sortField}:::${targetNoteTypeId}`);
              }

              const templateOrd = candidate.templateOrd || 0;

              if (existingNoteId) {
                const cardKey = `${existingNoteId}:::${templateOrd}`;
                const cardExists = existingCardsByNoteAndOrd.has(cardKey);

                if (options.duplicateStrategy === 'skip') {
                  if (cardExists) {
                    skipped++;
                    continue;
                  }
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
                }
              }

              // 5. Insert Note
              const noteId =
                existingNoteId && options.duplicateStrategy !== 'new'
                  ? existingNoteId
                  : `note_${now}_${added}_${Math.random().toString(36).substring(2, 6)}`;

              if (!existingNoteId || options.duplicateStrategy === 'new') {
                const noteGuid =
                  options.duplicateStrategy === 'new' && candidate.guid
                    ? `guid_${now}_${added}_${Math.random().toString(36).substring(2, 9)}`
                    : guid;

                await db.runAsync(
                  `INSERT INTO notes (id, guid, note_type_id, fields_json, tags, sort_field, checksum, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?);`,
                  noteId,
                  noteGuid,
                  targetNoteTypeId,
                  JSON.stringify(candidate.fields),
                  candidate.tags || '',
                  sortField,
                  now,
                  now
                );
                if (noteGuid) existingNotesByGuid.set(noteGuid, noteId);
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
            }
          });

          // Yield and update progress between committed batches
          const percent = Math.min(99, Math.round((batchEnd / candidates.length) * 100));
          options.onProgress?.({
            stage: 'saving',
            percent,
            current: batchEnd,
            total: candidates.length,
            message: `جاري حفظ البطاقات في قاعدة البيانات (${batchEnd}/${candidates.length})...`,
          });
          await new Promise((r) => setTimeout(r, 0));
        }

        // 7. Record import history
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

        options.onProgress?.({
          stage: 'saving',
          percent: 100,
          current: candidates.length,
          total: candidates.length,
          message: 'اكتمل الاستيراد بنجاح!',
        });

        return {
          historyId,
          sourceType,
          fileName,
          added,
          updated,
          skipped,
          errors,
        };
      });
    } finally {
      setImportingState(false);
    }
  },

  /**
   * Undoes an import by deleting notes and cards created in that import
   */
  async undoImport(historyId: string): Promise<boolean> {
    return withDatabaseLock(async (db) => {
      const historyItem = await db.getFirstAsync<any>(
        'SELECT * FROM import_history WHERE id = ?;',
        historyId
      );
      if (!historyItem) return false;

      const startTime = historyItem.imported_at - 1000;
      const endTime = historyItem.imported_at + 120000;

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'DELETE FROM notes WHERE created_at >= ? AND created_at <= ?;',
          startTime,
          endTime
        );
        await db.runAsync('DELETE FROM import_history WHERE id = ?;', historyId);
      });
      return true;
    });
  },

  /**
   * Retrieves import history
   */
  async getHistory(): Promise<any[]> {
    return withDatabaseRead(async (db) => {
      return await db.getAllAsync<any>(
        'SELECT * FROM import_history ORDER BY imported_at DESC LIMIT 30;'
      );
    });
  },
};
