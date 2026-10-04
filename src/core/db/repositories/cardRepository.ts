import { withDatabaseRead } from '../connection';
import { Card, CardState } from '../../types/models';

export interface CardWithNoteDetails extends Card {
  fields_json: string;
  tags: string;
  note_type_id: string;
}

export const cardRepository = {
  async getDueCards(limit = 50, deckId?: string): Promise<CardWithNoteDetails[]> {
    const now = Date.now();

    let sql = `
      SELECT c.*, n.fields_json, n.tags, n.note_type_id
      FROM cards c
      JOIN notes n ON n.id = c.note_id
      WHERE c.suspended = 0
        AND ((c.state = 2 AND c.due <= ?) OR c.state = 1 OR c.state = 3)
    `;
    const params: any[] = [now];

    if (deckId) {
      sql += ' AND c.deck_id = ?';
      params.push(deckId);
    }

    sql += ' ORDER BY c.due ASC LIMIT ?;';
    params.push(limit);

    return await withDatabaseRead(async (db) => {
      return await db.getAllAsync<CardWithNoteDetails>(sql, ...params);
    });
  },

  async getNewCards(limit = 20, deckId?: string): Promise<CardWithNoteDetails[]> {
    let sql = `
      SELECT c.*, n.fields_json, n.tags, n.note_type_id
      FROM cards c
      JOIN notes n ON n.id = c.note_id
      WHERE c.suspended = 0 AND c.state = 0
    `;
    const params: any[] = [];

    if (deckId) {
      sql += ' AND c.deck_id = ?';
      params.push(deckId);
    }

    sql += ' ORDER BY c.created_at ASC LIMIT ?;';
    params.push(limit);

    return await withDatabaseRead(async (db) => {
      return await db.getAllAsync<CardWithNoteDetails>(sql, ...params);
    });
  },

  async getGlobalCounts(): Promise<{ due: number; newCards: number; learn: number; total: number }> {
    const now = Date.now();

    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN state = 0 AND suspended = 0 THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN (state = 1 OR state = 3) AND suspended = 0 THEN 1 ELSE 0 END) as learn_count,
        SUM(CASE WHEN state = 2 AND due <= ? AND suspended = 0 THEN 1 ELSE 0 END) as due_count
      FROM cards;
    `;

    return await withDatabaseRead(async (db) => {
      const row = await db.getFirstAsync<any>(sql, now);
      return {
        total: Number(row?.total || 0),
        newCards: Number(row?.new_count || 0),
        learn: Number(row?.learn_count || 0),
        due: Number(row?.due_count || 0),
      };
    });
  },

  async getTotalCount(): Promise<number> {
    return await withDatabaseRead(async (db) => {
      const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cards;');
      return Number(row?.count || 0);
    });
  },

  async getById(id: string): Promise<Card | null> {
    if (!id || typeof id !== 'string') return null;
    return await withDatabaseRead(async (db) => {
      return await db.getFirstAsync<Card>('SELECT * FROM cards WHERE id = ?;', [id]);
    });
  },
};
