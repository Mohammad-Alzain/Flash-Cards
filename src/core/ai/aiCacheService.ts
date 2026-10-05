import { withDatabaseLock, withDatabaseRead } from '../db/connection';

/**
 * Deterministic 64-bit hash function for caching prompts and quiz results
 */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export const aiCacheService = {
  /**
   * Retrieves a cached response by prompt hash
   */
  async getCached(promptHash: string): Promise<string | null> {
    return await withDatabaseRead(async (db) => {
      try {
        const row = await db.getFirstAsync<{ response_text: string }>(
          'SELECT response_text FROM ai_cache WHERE prompt_hash = ? LIMIT 1;',
          promptHash
        );
        return row?.response_text || null;
      } catch (err) {
        // Table may not yet be migrated on first run
        return null;
      }
    });
  },

  /**
   * Stores an AI response in cache using the global write mutex
   */
  async setCached(options: {
    promptHash: string;
    cardId?: string;
    requestType: string;
    model: string;
    responseText: string;
    tokensUsed?: number;
  }): Promise<void> {
    return await withDatabaseLock(async (db) => {
      try {
        const now = Date.now();
        const id = `cache_${options.promptHash}_${now}`;
        await db.runAsync(
          `INSERT INTO ai_cache (id, prompt_hash, card_id, request_type, model, response_text, tokens_used, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET response_text = excluded.response_text;`,
          id,
          options.promptHash,
          options.cardId || null,
          options.requestType,
          options.model,
          options.responseText,
          options.tokensUsed || 0,
          now
        );
      } catch (err) {
        console.warn('[AICacheService] Failed to cache response:', err);
      }
    });
  },

  /**
   * Counts the total number of cached AI items
   */
  async getCacheCount(): Promise<number> {
    return await withDatabaseRead(async (db) => {
      try {
        const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM ai_cache;');
        return Number(row?.count || 0);
      } catch {
        return 0;
      }
    });
  },

  /**
   * Clears the entire AI cache
   */
  async clearCache(): Promise<void> {
    return await withDatabaseLock(async (db) => {
      try {
        await db.runAsync('DELETE FROM ai_cache;');
      } catch (err) {
        console.warn('[AICacheService] Failed to clear cache:', err);
      }
    });
  },
};
