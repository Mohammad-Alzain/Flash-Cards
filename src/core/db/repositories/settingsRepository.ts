import { getDatabase } from '../connection';

export const settingsRepository = {
  async get(key: string, defaultValue = ''): Promise<string> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?;',
      key
    );
    return row?.value ?? defaultValue;
  },

  async set(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      key,
      value
    );
  },

  async getAll(): Promise<Record<string, string>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings;');
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  },
};
