import { getDatabase } from '../connection';
import { searchParser } from '../../search/searchParser';
import { Card, CardState } from '../../types/models';
import { stripHtml } from '../../render/templateEngine';
import { deckRepository } from './deckRepository';

export type BrowserSortColumn = 'created_at' | 'due' | 'sort_field' | 'ease_factor' | 'interval_days' | 'lapses' | 'reps';
export type BrowserSortOrder = 'ASC' | 'DESC';

export type BulkRescheduleMode = 'shift' | 'specific_date' | 'distribute' | 'multiplier';

export interface BulkRescheduleOptions {
  mode: BulkRescheduleMode;
  shiftDays?: number; // e.g. +3, -2
  updateIntervalsWithShift?: boolean;
  targetDaysFromNow?: number; // e.g. 0 = today, 1 = tomorrow, 7 = 1 week
  spreadOverDays?: number; // e.g. 7
  startFromDays?: number; // e.g. 0 or 1
  multiplier?: number; // e.g. 1.5, 0.8
}

export interface BulkRescheduleResult {
  updatedCount: number;
  minNewDue: number;
  maxNewDue: number;
}

export interface BrowserCardItem {
  id: string;
  note_id: string;
  deck_id: string;
  deck_name: string;
  sort_field: string;
  fields_json: string;
  tags: string;
  state: number;
  due: number;
  interval_days: number;
  ease_factor: number;
  reps: number;
  lapses: number;
  suspended: number;
}

export const browserRepository = {
  /**
   * Searches cards using full Anki query syntax with custom sorting
   */
  async searchCards(
    query: string,
    limit = 100,
    offset = 0,
    sortColumn: BrowserSortColumn = 'created_at',
    sortOrder: BrowserSortOrder = 'DESC'
  ): Promise<BrowserCardItem[]> {
    const db = await getDatabase();
    const { whereClause, params } = searchParser.parse(query);

    const safeColMap: Record<BrowserSortColumn, string> = {
      created_at: 'c.created_at',
      due: 'c.due',
      sort_field: 'n.sort_field',
      ease_factor: 'c.ease_factor',
      interval_days: 'c.interval_days',
      lapses: 'c.lapses',
      reps: 'c.reps',
    };
    const orderCol = safeColMap[sortColumn] || 'c.created_at';
    const safeOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT 
        c.id,
        c.note_id,
        c.deck_id,
        d.name as deck_name,
        n.sort_field,
        n.fields_json,
        n.tags,
        c.state,
        c.due,
        c.interval_days,
        c.ease_factor,
        c.reps,
        c.lapses,
        c.suspended
      FROM cards c
      JOIN notes n ON n.id = c.note_id
      JOIN decks d ON d.id = c.deck_id
      WHERE ${whereClause}
      ORDER BY ${orderCol} ${safeOrder}
      LIMIT ? OFFSET ?;
    `;

    return await db.getAllAsync<BrowserCardItem>(sql, ...params, limit, offset);
  },

  /**
   * Returns total matching cards count for query
   */
  async countCards(query: string): Promise<number> {
    const db = await getDatabase();
    const { whereClause, params } = searchParser.parse(query);
    const sql = `
      SELECT COUNT(*) as count
      FROM cards c
      JOIN notes n ON n.id = c.note_id
      JOIN decks d ON d.id = c.deck_id
      WHERE ${whereClause};
    `;
    const row = await db.getFirstAsync<{ count: number }>(sql, ...params);
    return Number(row?.count || 0);
  },

  /**
   * Bulk change deck
   */
  async bulkChangeDeck(cardIds: string[], targetDeckId: string): Promise<void> {
    const db = await getDatabase();
    const placeholders = cardIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE cards SET deck_id = ?, updated_at = ? WHERE id IN (${placeholders});`,
      targetDeckId,
      Date.now(),
      ...cardIds
    );
  },

  /**
   * Bulk suspend / unsuspend
   */
  async bulkSetSuspended(cardIds: string[], suspended: boolean): Promise<void> {
    const db = await getDatabase();
    const placeholders = cardIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE cards SET suspended = ?, updated_at = ? WHERE id IN (${placeholders});`,
      suspended ? 1 : 0,
      Date.now(),
      ...cardIds
    );
  },

  /**
   * Bulk reset progress
   */
  async bulkResetProgress(cardIds: string[]): Promise<void> {
    const db = await getDatabase();
    const placeholders = cardIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE cards SET
         state = 0,
         reps = 0,
         lapses = 0,
         interval_days = 0,
         ease_factor = 2.5,
         due = ?,
         last_review = NULL,
         updated_at = ?
       WHERE id IN (${placeholders});`,
      Date.now(),
      Date.now(),
      ...cardIds
    );
  },

  /**
   * Bulk delete cards
   */
  async bulkDeleteCards(cardIds: string[]): Promise<void> {
    if (!cardIds || cardIds.length === 0) return;
    const db = await getDatabase();
    const placeholders = cardIds.map(() => '?').join(',');
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM cards WHERE id IN (${placeholders});`, ...cardIds);
      await db.runAsync(`DELETE FROM notes WHERE id NOT IN (SELECT DISTINCT note_id FROM cards);`);
    });
  },

  /**
   * Bulk mark cards as studied/reviewed
   */
  async bulkMarkStudied(cardIds: string[]): Promise<void> {
    const db = await getDatabase();
    const placeholders = cardIds.map(() => '?').join(',');
    const now = Date.now();
    await db.runAsync(
      `UPDATE cards SET 
         state = 2, 
         interval_days = CASE WHEN interval_days < 1 THEN 1 ELSE interval_days END,
         reps = CASE WHEN reps < 1 THEN 1 ELSE reps END,
         due = ?,
         last_review = ?,
         updated_at = ? 
       WHERE id IN (${placeholders});`,
      now + 86400000,
      now,
      now,
      ...cardIds
    );
  },

  /**
   * Bulk add tags to notes of selected cards
   */
  async bulkAddTags(cardIds: string[], tagsInput: string): Promise<number> {
    if (cardIds.length === 0 || !tagsInput.trim()) return 0;
    const newTags = tagsInput
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (newTags.length === 0) return 0;

    const db = await getDatabase();
    const placeholders = cardIds.map(() => '?').join(',');
    const noteRows = await db.getAllAsync<{ note_id: string }>(
      `SELECT DISTINCT note_id FROM cards WHERE id IN (${placeholders});`,
      ...cardIds
    );

    if (noteRows.length === 0) return 0;

    let updatedCount = 0;
    const now = Date.now();

    await db.withTransactionAsync(async () => {
      for (const row of noteRows) {
        const note = await db.getFirstAsync<{ tags: string }>(
          'SELECT tags FROM notes WHERE id = ?;',
          row.note_id
        );
        if (!note) continue;

        const currentTags = (note.tags || '')
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        let changed = false;
        for (const tag of newTags) {
          if (!currentTags.includes(tag)) {
            currentTags.push(tag);
            changed = true;
          }
        }

        if (changed) {
          await db.runAsync(
            'UPDATE notes SET tags = ?, updated_at = ? WHERE id = ?;',
            currentTags.join(' '),
            now,
            row.note_id
          );
          updatedCount++;
        }
      }
    });

    return updatedCount;
  },

  /**
   * Bulk remove tags from notes of selected cards
   */
  async bulkRemoveTags(cardIds: string[], tagsInput: string): Promise<number> {
    if (cardIds.length === 0 || !tagsInput.trim()) return 0;
    const removeSet = new Set(
      tagsInput
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    );

    if (removeSet.size === 0) return 0;

    const db = await getDatabase();
    const placeholders = cardIds.map(() => '?').join(',');
    const noteRows = await db.getAllAsync<{ note_id: string }>(
      `SELECT DISTINCT note_id FROM cards WHERE id IN (${placeholders});`,
      ...cardIds
    );

    if (noteRows.length === 0) return 0;

    let updatedCount = 0;
    const now = Date.now();

    await db.withTransactionAsync(async () => {
      for (const row of noteRows) {
        const note = await db.getFirstAsync<{ tags: string }>(
          'SELECT tags FROM notes WHERE id = ?;',
          row.note_id
        );
        if (!note) continue;

        const currentTags = (note.tags || '')
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        const filtered = currentTags.filter((t) => !removeSet.has(t));
        if (filtered.length !== currentTags.length) {
          await db.runAsync(
            'UPDATE notes SET tags = ?, updated_at = ? WHERE id = ?;',
            filtered.join(' '),
            now,
            row.note_id
          );
          updatedCount++;
        }
      }
    });

    return updatedCount;
  },

  /**
   * Fetches all unique tags with count of notes using them
   */
  async getAllTagsWithCounts(): Promise<{ tag: string; count: number }[]> {
    const db = await getDatabase();
    const notes = await db.getAllAsync<{ tags: string }>('SELECT tags FROM notes WHERE tags != "";');

    const counts = new Map<string, number>();
    for (const n of notes) {
      const tagList = (n.tags || '').split(/[,\s]+/).filter((t) => t.trim().length > 0);
      for (const t of tagList) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }

    const result: { tag: string; count: number }[] = [];
    counts.forEach((count, tag) => {
      result.push({ tag, count });
    });

    return result.sort((a, b) => b.count - a.count);
  },

  /**
   * Renames a tag across all notes
   */
  async renameTag(oldTag: string, newTag: string): Promise<void> {
    const db = await getDatabase();
    const notes = await db.getAllAsync<{ id: string; tags: string }>(
      'SELECT id, tags FROM notes WHERE tags LIKE ?;',
      `%${oldTag}%`
    );

    for (const n of notes) {
      const tagList = (n.tags || '').split(/[,\s]+/).filter((t) => t.trim().length > 0);
      const updatedList = tagList.map((t) => (t === oldTag ? newTag : t));
      await db.runAsync(
        'UPDATE notes SET tags = ? WHERE id = ?;',
        updatedList.join(', '),
        n.id
      );
    }
  },

  /**
   * Deletes a tag from all notes
   */
  async deleteTag(targetTag: string): Promise<void> {
    const db = await getDatabase();
    const notes = await db.getAllAsync<{ id: string; tags: string }>(
      'SELECT id, tags FROM notes WHERE tags LIKE ?;',
      `%${targetTag}%`
    );

    for (const n of notes) {
      const tagList = (n.tags || '').split(/[,\s]+/).filter((t) => t.trim().length > 0);
      const updatedList = tagList.filter((t) => t !== targetTag);
      await db.runAsync(
        'UPDATE notes SET tags = ? WHERE id = ?;',
        updatedList.join(', '),
        n.id
      );
    }
  },

  /**
   * Discovers duplicate notes based on sort field
   */
  async findDuplicates(): Promise<{ sortField: string; count: number; noteIds: string[] }[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ sort_field: string; count: number }>(`
      SELECT sort_field, COUNT(*) as count
      FROM notes
      WHERE sort_field != ''
      GROUP BY LOWER(sort_field)
      HAVING count > 1;
    `);

    const result: { sortField: string; count: number; noteIds: string[] }[] = [];
    for (const r of rows) {
      const noteRows = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM notes WHERE LOWER(sort_field) = LOWER(?);',
        r.sort_field
      );
      result.push({
        sortField: r.sort_field,
        count: r.count,
        noteIds: noteRows.map((n) => n.id),
      });
    }

    return result;
  },

  /**
   * Find and replace text across note fields
   */
  async findAndReplace(searchStr: string, replaceStr: string): Promise<number> {
    const db = await getDatabase();
    const notes = await db.getAllAsync<{ id: string; fields_json: string }>(
      'SELECT id, fields_json FROM notes WHERE fields_json LIKE ?;',
      `%${searchStr}%`
    );

    let replacedNotes = 0;
    for (const n of notes) {
      const updatedFieldsStr = n.fields_json.split(searchStr).join(replaceStr);
      await db.runAsync(
        'UPDATE notes SET fields_json = ?, updated_at = ? WHERE id = ?;',
        updatedFieldsStr,
        Date.now(),
        n.id
      );
      replacedNotes++;
    }

    return replacedNotes;
  },

  /**
   * Scans for empty cards (cards whose front is blank after rendering)
   */
  async findEmptyCards(): Promise<{ cardId: string; noteId: string }[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(`
      SELECT c.id as card_id, c.note_id, n.fields_json
      FROM cards c
      JOIN notes n ON n.id = c.note_id;
    `);

    const emptyCards: { cardId: string; noteId: string }[] = [];
    for (const r of rows) {
      try {
        const fields = JSON.parse(r.fields_json || '{}');
        const firstVal = Object.values(fields)[0] as string;
        if (!firstVal || stripHtml(firstVal).length === 0) {
          emptyCards.push({ cardId: r.card_id, noteId: r.note_id });
        }
      } catch (e) {}
    }

    return emptyCards;
  },

  /**
   * Deletes empty cards
   */
  async deleteEmptyCards(cardIds: string[]): Promise<void> {
    if (cardIds.length === 0) return;
    const db = await getDatabase();
    const placeholders = cardIds.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM cards WHERE id IN (${placeholders});`, ...cardIds);
  },

  /**
   * Compacts and cleans SQLite database (VACUUM)
   */
  async vacuumDatabase(): Promise<void> {
    const db = await getDatabase();
    await db.execAsync('VACUUM;');
  },

  /**
   * Bulk reschedule studied cards with expert algorithms:
   * 1. Shift: advance or postpone by N days
   * 2. Specific Date: set due in X days from today
   * 3. Distribute: evenly spread backlog cards across D days
   * 4. Multiplier: scale interval durations
   */
  async bulkRescheduleCards(
    cardIds: string[],
    options: BulkRescheduleOptions
  ): Promise<BulkRescheduleResult> {
    if (!cardIds || cardIds.length === 0) {
      return { updatedCount: 0, minNewDue: 0, maxNewDue: 0 };
    }

    const db = await getDatabase();
    const now = Date.now();
    const placeholders = cardIds.map(() => '?').join(',');

    // Fetch existing card info
    const existingCards = await db.getAllAsync<{
      id: string;
      state: number;
      due: number;
      interval_days: number;
      reps: number;
      last_review: number | null;
    }>(
      `SELECT id, state, due, interval_days, reps, last_review
       FROM cards
       WHERE id IN (${placeholders})
       ORDER BY due ASC, id ASC;`,
      ...cardIds
    );

    if (existingCards.length === 0) {
      return { updatedCount: 0, minNewDue: 0, maxNewDue: 0 };
    }

    const updates: { id: string; newDue: number; newInterval: number; newState: number }[] = [];
    const N = existingCards.length;

    for (let i = 0; i < N; i++) {
      const card = existingCards[i];
      let newDue = card.due;
      let newInterval = card.interval_days;
      let newState = card.state === 0 ? 2 : card.state;

      switch (options.mode) {
        case 'shift': {
          const shiftDays = options.shiftDays || 0;
          const shiftMs = shiftDays * 86_400_000;
          newDue = Math.max(now, card.due + shiftMs);
          if (options.updateIntervalsWithShift) {
            newInterval = Math.max(1, card.interval_days + shiftDays);
          }
          break;
        }

        case 'specific_date': {
          const targetDays = Math.max(0, options.targetDaysFromNow ?? 0);
          newDue = now + targetDays * 86_400_000;
          newInterval = Math.max(1, targetDays);
          newState = 2; // Scheduled review
          break;
        }

        case 'distribute': {
          const spreadDays = Math.max(1, options.spreadOverDays || 7);
          const startOffsetDays = options.startFromDays ?? 1;
          const daySlot = Math.floor((i / N) * spreadDays);
          // Add deterministic small fuzz based on index to spread across study day hours
          const fuzzMs = (i % 12) * 1800_000; // 30-min increments
          newDue = now + (startOffsetDays + daySlot) * 86_400_000 + fuzzMs;
          newInterval = Math.max(1, startOffsetDays + daySlot);
          newState = 2;
          break;
        }

        case 'multiplier': {
          const mult = Math.max(0.1, options.multiplier || 1.0);
          newInterval = Math.max(1, Math.round(card.interval_days * mult));
          const baseTime = card.last_review || now;
          newDue = Math.max(now, baseTime + newInterval * 86_400_000);
          newState = 2;
          break;
        }
      }

      updates.push({
        id: card.id,
        newDue,
        newInterval,
        newState,
      });
    }

    let minNewDue = Infinity;
    let maxNewDue = -Infinity;

    await db.withTransactionAsync(async () => {
      const updatedAt = Date.now();
      for (const u of updates) {
        if (u.newDue < minNewDue) minNewDue = u.newDue;
        if (u.newDue > maxNewDue) maxNewDue = u.newDue;

        await db.runAsync(
          `UPDATE cards 
           SET due = ?, interval_days = ?, state = ?, updated_at = ? 
           WHERE id = ?;`,
          u.newDue,
          u.newInterval,
          u.newState,
          updatedAt,
          u.id
        );
      }
    });

    return {
      updatedCount: updates.length,
      minNewDue: minNewDue === Infinity ? now : minNewDue,
      maxNewDue: maxNewDue === -Infinity ? now : maxNewDue,
    };
  },

  /**
   * Retrieves all studied card IDs in a deck (and its sub-decks)
   */
  async getStudiedCardIdsInDeck(deckId: string): Promise<string[]> {
    const db = await getDatabase();
    const allDeckIds = await deckRepository.getDeckAndDescendantIds(deckId);
    const placeholders = allDeckIds.map(() => '?').join(',');

    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM cards 
       WHERE suspended = 0 
         AND (state != 0 OR reps > 0)
         AND deck_id IN (${placeholders})
       ORDER BY due ASC;`,
      ...allDeckIds
    );

    return rows.map((r) => r.id);
  },
};
