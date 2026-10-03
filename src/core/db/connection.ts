import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';
import { seedInitialData } from './seed';
import { reconcileNoteTypesAndCards } from './reconcile';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('flashcards.db');
    // Enable WAL mode for high concurrency & write performance
    await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
    await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDatabase();
  await runMigrations(db);
  await seedInitialData(db);
  await reconcileNoteTypesAndCards(db);
  return db;
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('PRAGMA foreign_keys = OFF;');

  // Dynamically find and drop ALL user tables (including schema_migrations)
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
  );
  for (const table of tables) {
    await db.execAsync(`DROP TABLE IF EXISTS "${table.name}";`);
  }

  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Clear all media files on disk
  try {
    const { mediaManager } = require('../media/mediaManager');
    await mediaManager.clearAllMedia();
  } catch (e) {
    console.warn('Failed to clear media during reset:', e);
  }

  // Re-run migrations and seeds
  await runMigrations(db);
  await seedInitialData(db);
}

export async function checkDatabaseIntegrity(): Promise<{ ok: boolean; message: string }> {
  try {
    const db = await getDatabase();
    const result = await db.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check;');
    const status = result[0]?.integrity_check || 'unknown';
    return {
      ok: status.toLowerCase() === 'ok',
      message: status,
    };
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'Database check failed',
    };
  }
}

export async function checkpointDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (e) {
      console.warn('Failed to checkpoint WAL:', e);
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await checkpointDatabase();
      await dbInstance.closeAsync();
    } catch (e) {
      console.warn('Error closing database:', e);
    } finally {
      dbInstance = null;
    }
  }
}
