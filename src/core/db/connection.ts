import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';
import { seedInitialData } from './seed';
import { reconcileNoteTypesAndCards } from './reconcile';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Importing state barrier
let isImportingFlag = false;

export function isImporting(): boolean {
  return isImportingFlag;
}

export function setImportingState(importing: boolean): void {
  isImportingFlag = importing;
}

// Global Async Write Mutex
let writeMutex = Promise.resolve();

/**
 * Runs a database operation exclusively through a global FIFO queue.
 * Guarantees that no two write operations or maintenance tasks overlap.
 */
export async function withDatabaseLock<T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  const previousMutex = writeMutex;
  // Always chain with .catch() so an error in a previous operation never bricks the mutex queue
  writeMutex = previousMutex.catch(() => {}).then(() => lockPromise);

  try {
    await previousMutex.catch(() => {});
  } catch {}

  try {
    return await operation(db);
  } finally {
    releaseLock!();
  }
}

/**
 * Runs a database read operation directly using SQLite WAL mode concurrency.
 */
export async function withDatabaseRead<T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  return await operation(db);
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('flashcards.db');
        // Enable WAL mode for high concurrency & write performance
        await db.execAsync('PRAGMA journal_mode = WAL;');
        // Wait up to 5000ms if database is busy instead of throwing SQLITE_BUSY immediately
        await db.execAsync('PRAGMA busy_timeout = 5000;');
        await db.execAsync('PRAGMA foreign_keys = ON;');
        dbInstance = db;
        return db;
      } catch (err) {
        dbInitPromise = null;
        dbInstance = null;
        console.error('[Database] Failed to open database:', err);
        throw err;
      }
    })();
  }
  return await dbInitPromise;
}

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  return withDatabaseLock(async (db) => {
    await runMigrations(db);
    await seedInitialData(db);
    await reconcileNoteTypesAndCards(db);
    return db;
  });
}

/**
 * Safely resets database: locks database, drops all user tables, clears media, and re-initializes.
 */
export async function resetDatabase(): Promise<void> {
  setImportingState(false);
  return withDatabaseLock(async (db) => {
    try {
      await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}

    // Disable foreign keys temporarily for clean table dropping
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

    // Re-run migrations and seeds cleanly
    await runMigrations(db);
    await seedInitialData(db);
    await reconcileNoteTypesAndCards(db);
  });
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
      dbInitPromise = null;
    }
  }
}
