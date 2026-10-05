import { SQLiteDatabase } from 'expo-sqlite';
import { up as migration001 } from './001_initial_schema';
import { up as migration002 } from './002_ai_and_quiz_extended';
import { up as migration003 } from './003_reminder_calendar';

export interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

export const migrations: Migration[] = [
  { version: 1, up: migration001 },
  { version: 2, up: migration002 },
  { version: 3, up: migration003 },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Ensure schema_migrations exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  // Safety check: if note_types table does not exist, schema_migrations must be cleared so migrations run!
  const tableCheck = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='note_types';"
  );
  if (tableCheck.length === 0) {
    console.log('[DB] note_types table does not exist. Resetting schema_migrations to reapply...');
    await db.execAsync('DELETE FROM schema_migrations;');
  }

  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[DB] Running migration version ${migration.version}...`);
      await migration.up(db);
      await db.runAsync(
        'INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?);',
        migration.version,
        Date.now()
      );
      console.log(`[DB] Migration ${migration.version} successfully applied.`);
    }
  }
}
