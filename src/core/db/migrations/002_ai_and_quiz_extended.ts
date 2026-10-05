import { SQLiteDatabase } from 'expo-sqlite';

export async function up(db: SQLiteDatabase): Promise<void> {
  // 1. Create ai_cache table for caching AI explanations and quiz queries
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ai_cache (
      id TEXT PRIMARY KEY,
      prompt_hash TEXT NOT NULL,
      card_id TEXT NULL,
      request_type TEXT NOT NULL,
      model TEXT NOT NULL,
      response_text TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_cache_prompt ON ai_cache(prompt_hash);
    CREATE INDEX IF NOT EXISTS idx_ai_cache_card ON ai_cache(card_id);
  `);

  // Helper to add column if it does not already exist
  const addColumnIfNotExists = async (tableName: string, colName: string, colType: string) => {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
    if (!cols.some((c) => c.name === colName)) {
      await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType};`);
    }
  };

  // 2. Extend quiz_answers with AI grading and review fields
  await addColumnIfNotExists('quiz_answers', 'ai_answer', 'TEXT NULL');
  await addColumnIfNotExists('quiz_answers', 'ai_verdict', "TEXT NULL"); // 'correct' | 'partial' | 'incorrect'
  await addColumnIfNotExists('quiz_answers', 'ai_score', 'REAL NULL'); // 0.0 to 1.0
  await addColumnIfNotExists('quiz_answers', 'ai_feedback', 'TEXT NULL');
  await addColumnIfNotExists('quiz_answers', 'ai_tip', 'TEXT NULL');
  await addColumnIfNotExists('quiz_answers', 'ai_confidence', 'REAL NULL');
  await addColumnIfNotExists('quiz_answers', 'manual_override', 'TEXT NULL');
  await addColumnIfNotExists('quiz_answers', 'is_marked_for_review', 'INTEGER DEFAULT 0');

  // 3. Extend quiz_attempts with comprehensive AI summary and in-progress autosave
  await addColumnIfNotExists('quiz_attempts', 'ai_summary_json', 'TEXT NULL');
  await addColumnIfNotExists('quiz_attempts', 'in_progress_state_json', 'TEXT NULL');
}
