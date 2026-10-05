import { getDatabase, withDatabaseLock, withDatabaseRead } from '../connection';
import { Deck, CardState } from '../../types/models';
import { settingsRepository } from './settingsRepository';

export interface DeckWithCounts extends Deck {
  card_count: number;
  new_count: number;
  learn_count: number;
  due_count: number;
  future_count?: number;
  suspended_count?: number;
  total_card_count?: number;
  total_new_count?: number;
  total_learn_count?: number;
  total_due_count?: number;
  total_future_count?: number;
  has_subdecks?: boolean;
}

export interface DeckTreeNode extends DeckWithCounts {
  children: DeckTreeNode[];
  level: number;
  short_name: string;
  total_card_count: number;
  total_new_count: number;
  total_learn_count: number;
  total_due_count: number;
  total_future_count?: number;
}

export const deckRepository = {
  async getAllWithCounts(): Promise<DeckWithCounts[]> {
    const db = await getDatabase();
    const now = Date.now();

    const sql = `
      SELECT 
        d.*,
        COUNT(c.id) AS card_count,
        SUM(CASE WHEN c.state = 0 AND c.suspended = 0 THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN (c.state = 1 OR c.state = 3) AND c.suspended = 0 THEN 1 ELSE 0 END) AS learn_count,
        SUM(CASE WHEN c.state = 2 AND c.due <= ? AND c.suspended = 0 THEN 1 ELSE 0 END) AS due_count,
        SUM(CASE WHEN c.state = 2 AND c.due > ? AND c.suspended = 0 THEN 1 ELSE 0 END) AS future_count,
        SUM(CASE WHEN c.suspended = 1 THEN 1 ELSE 0 END) AS suspended_count
      FROM decks d
      LEFT JOIN cards c ON c.deck_id = d.id
      WHERE d.archived = 0
      GROUP BY d.id
      ORDER BY d.name ASC;
    `;

    const rows = await withDatabaseRead(async (db) => {
      return await db.getAllAsync<any>(sql, now, now);
    });
    const rawDecks: DeckWithCounts[] = rows.map((r) => ({
      ...r,
      card_count: Number(r.card_count || 0),
      new_count: Number(r.new_count || 0),
      learn_count: Number(r.learn_count || 0),
      due_count: Number(r.due_count || 0),
      future_count: Number(r.future_count || 0),
      suspended_count: Number(r.suspended_count || 0),
    }));

    // Calculate aggregated descendant counts for parent decks
    const deckMap = new Map<string, DeckWithCounts>();
    rawDecks.forEach((d) => deckMap.set(d.id, d));

    return rawDecks.map((deck) => {
      // Find all descendants (via parent_id or Anki name:: prefix)
      const descendants = rawDecks.filter(
        (other) =>
          other.id !== deck.id &&
          (other.parent_id === deck.id ||
            other.name.startsWith(`${deck.name}::`))
      );

      const hasSubdecks = descendants.length > 0;
      const sumChildrenCards = descendants.reduce((acc, c) => acc + c.card_count, 0);
      const sumChildrenNew = descendants.reduce((acc, c) => acc + c.new_count, 0);
      const sumChildrenLearn = descendants.reduce((acc, c) => acc + c.learn_count, 0);
      const sumChildrenDue = descendants.reduce((acc, c) => acc + c.due_count, 0);
      const sumChildrenFuture = descendants.reduce((acc, c) => acc + (c.future_count || 0), 0);

      return {
        ...deck,
        has_subdecks: hasSubdecks,
        total_card_count: deck.card_count + sumChildrenCards,
        total_new_count: deck.new_count + sumChildrenNew,
        total_learn_count: deck.learn_count + sumChildrenLearn,
        total_due_count: deck.due_count + sumChildrenDue,
        total_future_count: (deck.future_count || 0) + sumChildrenFuture,
      };
    });
  },

  /**
   * Builds an Accordion Tree of decks with parent-child relationships and rolled-up counts
   */
  async getDeckTree(): Promise<DeckTreeNode[]> {
    const decks = await this.getAllWithCounts();
    const idMap = new Map<string, DeckTreeNode>();
    const nameMap = new Map<string, DeckTreeNode>();

    // 1. Initialize nodes
    decks.forEach((d) => {
      const parts = d.name.split('::');
      const shortName = parts[parts.length - 1].trim();

      const node: DeckTreeNode = {
        ...d,
        children: [],
        level: 0,
        short_name: shortName,
        total_card_count: d.card_count,
        total_new_count: d.new_count,
        total_learn_count: d.learn_count,
        total_due_count: d.due_count,
      };
      idMap.set(d.id, node);
      nameMap.set(d.name.toLowerCase(), node);
    });

    const roots: DeckTreeNode[] = [];
    const attachedChildIds = new Set<string>();

    // 2. Link parent-child by parent_id or by name prefix (e.g. "Book1::Chapter1")
    decks.forEach((d) => {
      const node = idMap.get(d.id)!;
      let parentNode: DeckTreeNode | undefined;

      if (d.parent_id && idMap.has(d.parent_id)) {
        parentNode = idMap.get(d.parent_id);
      } else if (d.name.includes('::')) {
        const parts = d.name.split('::');
        const parentName = parts.slice(0, -1).join('::').toLowerCase();
        if (nameMap.has(parentName)) {
          parentNode = nameMap.get(parentName);
        }
      }

      if (parentNode && parentNode.id !== node.id) {
        parentNode.children.push(node);
        node.level = parentNode.level + 1;
        attachedChildIds.add(node.id);
      }
    });

    // 3. Collect root nodes
    decks.forEach((d) => {
      if (!attachedChildIds.has(d.id)) {
        roots.push(idMap.get(d.id)!);
      }
    });

    // 4. Recursively roll up counts from bottom to top
    const rollUpCounts = (node: DeckTreeNode) => {
      node.children.forEach(rollUpCounts);
      const childCards = node.children.reduce((acc, c) => acc + c.total_card_count, 0);
      const childNew = node.children.reduce((acc, c) => acc + c.total_new_count, 0);
      const childLearn = node.children.reduce((acc, c) => acc + c.total_learn_count, 0);
      const childDue = node.children.reduce((acc, c) => acc + c.total_due_count, 0);

      node.total_card_count = node.card_count + childCards;
      node.total_new_count = node.new_count + childNew;
      node.total_learn_count = node.learn_count + childLearn;
      node.total_due_count = node.due_count + childDue;
      node.has_subdecks = node.children.length > 0;
    };

    roots.forEach(rollUpCounts);
    return roots;
  },

  /**
   * Returns deckId and all its descendant subdeck IDs
   */
  async getDeckAndDescendantIds(deckId: string): Promise<string[]> {
    return await withDatabaseRead(async (db) => {
      const targetDeck = await db.getFirstAsync<{ id: string; name: string }>(
        'SELECT id, name FROM decks WHERE id = ?;',
        deckId
      );
      if (!targetDeck) return [deckId];

      const rows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM decks WHERE id = ? OR parent_id = ? OR name LIKE ?;`,
        deckId,
        deckId,
        `${targetDeck.name}::%`
      );
      return Array.from(new Set([deckId, ...rows.map((r) => r.id)]));
    });
  },

  async getById(id: string): Promise<Deck | null> {
    return await withDatabaseRead(async (db) => {
      const row = await db.getFirstAsync<Deck>('SELECT * FROM decks WHERE id = ?;', id);
      return row || null;
    });
  },

  async create(name: string, description?: string, parentId?: string | null): Promise<Deck> {
    return withDatabaseLock(async (db) => {
      const id = `deck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = Date.now();

      await db.runAsync(
        `INSERT INTO decks (id, parent_id, name, description, created_at, updated_at, new_per_day, reviews_per_day)
         VALUES (?, ?, ?, ?, ?, ?, 20, 100);`,
        id,
        parentId || null,
        name,
        description || null,
        now,
        now
      );

      return {
        id,
        parent_id: parentId || null,
        name,
        description: description || null,
        created_at: now,
        updated_at: now,
        new_per_day: 20,
        reviews_per_day: 100,
        settings_json: null,
        archived: 0,
      };
    });
  },

  async update(id: string, updates: Partial<Deck>): Promise<void> {
    return withDatabaseLock(async (db) => {
      const sets: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        sets.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        sets.push('description = ?');
        values.push(updates.description);
      }
      if (updates.new_per_day !== undefined) {
        sets.push('new_per_day = ?');
        values.push(updates.new_per_day);
      }
      if (updates.reviews_per_day !== undefined) {
        sets.push('reviews_per_day = ?');
        values.push(updates.reviews_per_day);
      }

      if (sets.length === 0) return;

      sets.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);

      await db.runAsync(
        `UPDATE decks SET ${sets.join(', ')} WHERE id = ?;`,
        ...values
      );
    });
  },

  async delete(id: string): Promise<void> {
    return withDatabaseLock(async (db) => {
      const targetDeck = await db.getFirstAsync<{ id: string; name: string }>(
        'SELECT id, name FROM decks WHERE id = ?;',
        id
      );
      if (!targetDeck) return;

      const rows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM decks WHERE id = ? OR parent_id = ? OR name LIKE ?;`,
        id,
        id,
        `${targetDeck.name}::%`
      );
      const allIds = Array.from(new Set([id, ...rows.map((r) => r.id)]));
      if (allIds.length === 0) return;

      await db.withTransactionAsync(async () => {
        const placeholders = allIds.map(() => '?').join(',');

        // 1. Delete review logs associated with cards in these decks
        await db.runAsync(
          `DELETE FROM review_logs WHERE deck_id IN (${placeholders}) OR card_id IN (
             SELECT id FROM cards WHERE deck_id IN (${placeholders})
           );`,
          ...allIds,
          ...allIds
        );

        // 2. Delete study sessions, daily stats, and schedules for these decks
        await db.runAsync(`DELETE FROM study_sessions WHERE deck_id IN (${placeholders});`, ...allIds);
        await db.runAsync(`DELETE FROM daily_stats WHERE deck_id IN (${placeholders});`, ...allIds);
        await db.runAsync(`DELETE FROM schedules WHERE deck_id IN (${placeholders});`, ...allIds);

        // 3. Delete cards belonging to these decks
        await db.runAsync(`DELETE FROM cards WHERE deck_id IN (${placeholders});`, ...allIds);

        // 4. Delete orphaned notes (notes that no longer have any cards)
        await db.runAsync(`DELETE FROM notes WHERE id NOT IN (SELECT DISTINCT note_id FROM cards);`);

        // 5. Delete the decks themselves
        await db.runAsync(`DELETE FROM decks WHERE id IN (${placeholders});`, ...allIds);
      });
    });
  },

  /**
   * Sets the last studied / active deck ID in settings
   */
  async setLastStudiedDeckId(deckId: string): Promise<void> {
    try {
      if (!deckId) return;
      await settingsRepository.set('last_studied_deck_id', deckId);
    } catch (e) {
      console.warn('Failed to set last studied deck ID:', e);
    }
  },

  /** Note type used by an existing card in the deck (null for empty decks). */
  async getNoteTypeIdUsedInDeck(deckId: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ note_type_id: string }>(
      `SELECT n.note_type_id FROM notes n
       JOIN cards c ON c.note_id = n.id
       WHERE c.deck_id = ?
       LIMIT 1;`,
      deckId
    );
    return row?.note_type_id ?? null;
  },

  /**
   * Retrieves the last studied deck ID, checking:
   * 1. settings 'last_studied_deck_id' (if deck exists and not archived)
   * 2. review_logs (most recently reviewed card's deck)
   * 3. daily_stats (most recent study session's deck)
   * 4. Most recently updated/created deck with new cards
   */
  async getLastStudiedDeckId(): Promise<string | null> {
    return await withDatabaseRead(async (db) => {
      // 1. Check settings
      try {
        const savedId = await settingsRepository.get('last_studied_deck_id', '');
        if (savedId) {
          const deck = await db.getFirstAsync<{ id: string }>(
            'SELECT id FROM decks WHERE id = ? AND archived = 0;',
            savedId
          );
          if (deck) return deck.id;
        }
      } catch (e) {}

      // 2. Check review_logs (most recently studied card's deck)
      const lastRev = await db.getFirstAsync<{ deck_id: string }>(
        `SELECT r.deck_id 
         FROM review_logs r
         JOIN decks d ON d.id = r.deck_id
         WHERE d.archived = 0
         ORDER BY r.reviewed_at DESC 
         LIMIT 1;`
      );
      if (lastRev?.deck_id) return lastRev.deck_id;

      // 3. Check daily_stats
      const lastStat = await db.getFirstAsync<{ deck_id: string }>(
        `SELECT s.deck_id 
         FROM daily_stats s
         JOIN decks d ON d.id = s.deck_id
         WHERE d.archived = 0
         ORDER BY s.date DESC, s.time_ms DESC 
         LIMIT 1;`
      );
      if (lastStat?.deck_id) return lastStat.deck_id;

      // 4. Fallback to deck with new cards
      const deckWithNew = await db.getFirstAsync<{ id: string }>(
        `SELECT d.id 
         FROM decks d
         JOIN cards c ON c.deck_id = d.id
         WHERE d.archived = 0 AND c.suspended = 0 AND c.state = 0
         ORDER BY d.updated_at DESC 
         LIMIT 1;`
      );
      if (deckWithNew?.id) return deckWithNew.id;

      // 5. Fallback to any active deck
      const anyDeck = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM decks WHERE archived = 0 ORDER BY updated_at DESC LIMIT 1;'
      );
      return anyDeck?.id || null;
    });
  },

  /**
   * Retrieves full deck details with counts for the last studied deck
   */
  async getLastStudiedDeckWithCounts(): Promise<DeckWithCounts | null> {
    const deckId = await this.getLastStudiedDeckId();
    if (!deckId) return null;
    const all = await this.getAllWithCounts();
    return all.find((d) => d.id === deckId) || null;
  },
};
