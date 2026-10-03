import { getDatabase } from '../db/connection';

export const mistakesManager = {
  async recordWrongAnswer(cardId: string): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO mistakes (card_id, wrong_count, correct_streak, last_wrong_at)
       VALUES (?, 1, 0, ?)
       ON CONFLICT(card_id) DO UPDATE SET
         wrong_count = wrong_count + 1,
         correct_streak = 0,
         last_wrong_at = ?;`,
      cardId,
      now,
      now
    );
  },

  async recordCorrectAnswer(cardId: string): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ correct_streak: number }>(
      'SELECT correct_streak FROM mistakes WHERE card_id = ?;',
      cardId
    );

    if (!row) return;

    const newStreak = (row.correct_streak || 0) + 1;
    if (newStreak >= 3) {
      // Graduated from mistakes notebook!
      await db.runAsync('DELETE FROM mistakes WHERE card_id = ?;', cardId);
    } else {
      await db.runAsync(
        'UPDATE mistakes SET correct_streak = ? WHERE card_id = ?;',
        newStreak,
        cardId
      );
    }
  },

  async getMistakesCount(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM mistakes;'
    );
    return Number(row?.count || 0);
  },

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM mistakes;');
  },
};
