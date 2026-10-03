import { SQLiteDatabase } from 'expo-sqlite';

export async function up(db: SQLiteDatabase): Promise<void> {
  // Enable foreign keys and WAL mode
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      parent_id TEXT NULL,
      name TEXT NOT NULL,
      description TEXT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      new_per_day INTEGER DEFAULT 20,
      reviews_per_day INTEGER DEFAULT 100,
      settings_json TEXT NULL,
      archived INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS note_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      templates_json TEXT NOT NULL,
      css TEXT NOT NULL,
      is_cloze INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_type_versions (
      id TEXT PRIMARY KEY,
      note_type_id TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      saved_at INTEGER NOT NULL,
      FOREIGN KEY (note_type_id) REFERENCES note_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      guid TEXT UNIQUE NOT NULL,
      note_type_id TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      tags TEXT DEFAULT '',
      sort_field TEXT DEFAULT '',
      checksum INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (note_type_id) REFERENCES note_types(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      deck_id TEXT NOT NULL,
      template_ord INTEGER NOT NULL DEFAULT 0,
      state INTEGER NOT NULL DEFAULT 0, -- 0 New, 1 Learning, 2 Review, 3 Relearning
      due INTEGER NOT NULL DEFAULT 0,
      stability REAL DEFAULT 0,
      difficulty REAL DEFAULT 0,
      elapsed_days INTEGER DEFAULT 0,
      scheduled_days INTEGER DEFAULT 0,
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      interval_days INTEGER DEFAULT 0,
      last_review INTEGER NULL,
      suspended INTEGER DEFAULT 0,
      buried_until INTEGER NULL,
      flag INTEGER DEFAULT 0,
      bookmarked INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      deck_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      state_before INTEGER NOT NULL,
      due_before INTEGER NOT NULL,
      interval_before INTEGER NOT NULL,
      interval_after INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      reviewed_at INTEGER NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_media (
      note_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      PRIMARY KEY (note_id, media_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      deck_id TEXT NULL,
      type TEXT NOT NULL, -- 'study' | 'review' | 'custom'
      time_of_day TEXT NOT NULL,
      days_of_week_mask INTEGER NOT NULL,
      duration_min INTEGER NOT NULL,
      enabled INTEGER DEFAULT 1,
      notification_id TEXT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      cards_seen INTEGER DEFAULT 0,
      new_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT NOT NULL, -- YYYY-MM-DD
      deck_id TEXT NOT NULL,
      new_done INTEGER DEFAULT 0,
      reviews_done INTEGER DEFAULT 0,
      time_ms INTEGER DEFAULT 0,
      goal_met INTEGER DEFAULT 0,
      PRIMARY KEY (date, deck_id),
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      imported_at INTEGER NOT NULL,
      notes_added INTEGER DEFAULT 0,
      notes_skipped INTEGER DEFAULT 0,
      errors_json TEXT NULL
    );

    -- Quiz and Gamification tables
    CREATE TABLE IF NOT EXISTS quiz_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      preset_id TEXT NULL,
      mode TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      total INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      score REAL NOT NULL,
      duration_ms INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      FOREIGN KEY (preset_id) REFERENCES quiz_presets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      question_type TEXT NOT NULL,
      user_answer TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      time_ms INTEGER NOT NULL,
      answered_at INTEGER NOT NULL,
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mistakes (
      card_id TEXT PRIMARY KEY,
      wrong_count INTEGER DEFAULT 1,
      correct_streak INTEGER DEFAULT 0,
      last_wrong_at INTEGER NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS xp_log (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      unlocked_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      key TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      target INTEGER NOT NULL,
      claimed INTEGER DEFAULT 0
    );

    -- Indexes for high performance
    CREATE INDEX IF NOT EXISTS idx_decks_parent ON decks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(note_type_id);
    CREATE INDEX IF NOT EXISTS idx_notes_guid ON notes(guid);
    CREATE INDEX IF NOT EXISTS idx_cards_deck_state_due ON cards(deck_id, state, due);
    CREATE INDEX IF NOT EXISTS idx_cards_note ON cards(note_id);
    CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
    CREATE INDEX IF NOT EXISTS idx_revlog_card ON review_logs(card_id);
    CREATE INDEX IF NOT EXISTS idx_revlog_date ON review_logs(reviewed_at);
  `);
}
