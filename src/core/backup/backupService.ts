import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import JSZip from 'jszip';
import { getDatabase, closeDatabase, checkpointDatabase, checkDatabaseIntegrity } from '../db/connection';

export interface BackupMetadata {
  version: number;
  appVersion: string;
  createdAt: number;
  createdDate: string;
  cardCount: number;
  noteCount: number;
  deckCount: number;
  mediaCount: number;
  dbSizeBytes: number;
}

export interface BackupInfo {
  fileName: string;
  filePath: string;
  createdAt: number;
  sizeBytes: number;
  metadata?: BackupMetadata;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  cardCount?: number;
  deckCount?: number;
}

const BACKUPS_DIR = `${FileSystem.documentDirectory}backups/`;
const MEDIA_DIR = `${FileSystem.documentDirectory}media/`;
const DB_PATH = `${FileSystem.documentDirectory}SQLite/flashcards.db`;
const MAX_ROLLING_BACKUPS = 5;

export class BackupService {
  /**
   * Ensures the backups directory exists.
   */
  private static async ensureBackupsDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(BACKUPS_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(BACKUPS_DIR, { intermediates: true });
    }
  }

  /**
   * Creates a full offline backup (database + all media assets) in a single timestamped zip file.
   */
  static async createBackup(): Promise<BackupInfo> {
    await this.ensureBackupsDir();

    // 1. Flush WAL to write all transactions into the primary db file
    await checkpointDatabase();

    const db = await getDatabase();

    // 2. Gather counts for metadata
    const cardsCountRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM cards');
    const notesCountRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM notes');
    const decksCountRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM decks');
    const mediaCountRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM media');

    const cardCount = cardsCountRes?.count || 0;
    const noteCount = notesCountRes?.count || 0;
    const deckCount = decksCountRes?.count || 0;
    const mediaCount = mediaCountRes?.count || 0;

    // 3. Read SQLite database file
    const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (!dbInfo.exists) {
      throw new Error('Database file not found at ' + DB_PATH);
    }
    const dbSizeBytes = 'size' in dbInfo ? dbInfo.size || 0 : 0;

    const dbBase64 = await FileSystem.readAsStringAsync(DB_PATH, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 4. Build zip
    const zip = new JSZip();
    zip.file('flashcards.db', dbBase64, { base64: true });

    // 5. Gather all local media files
    const mediaDirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
    let actualMediaFilesCount = 0;
    if (mediaDirInfo.exists && mediaDirInfo.isDirectory) {
      const files = await FileSystem.readDirectoryAsync(MEDIA_DIR);
      const mediaZipFolder = zip.folder('media');
      for (const f of files) {
        try {
          const mPath = `${MEDIA_DIR}${f}`;
          const mInfo = await FileSystem.getInfoAsync(mPath);
          if (mInfo.exists && !mInfo.isDirectory) {
            const mBase64 = await FileSystem.readAsStringAsync(mPath, {
              encoding: FileSystem.EncodingType.Base64,
            });
            mediaZipFolder?.file(f, mBase64, { base64: true });
            actualMediaFilesCount++;
          }
        } catch (e) {
          console.warn(`Failed to package media file ${f}:`, e);
        }
      }
    }

    const now = Date.now();
    const metadata: BackupMetadata = {
      version: 1,
      appVersion: '1.0.0',
      createdAt: now,
      createdDate: new Date(now).toISOString(),
      cardCount,
      noteCount,
      deckCount,
      mediaCount: actualMediaFilesCount || mediaCount,
      dbSizeBytes,
    };

    zip.file('meta.json', JSON.stringify(metadata, null, 2));

    // 6. Generate ZIP file
    const zipBase64 = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const dateStr = new Date(now)
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    const fileName = `backup_${dateStr}.zip`;
    const targetPath = `${BACKUPS_DIR}${fileName}`;

    await FileSystem.writeAsStringAsync(targetPath, zipBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const outInfo = await FileSystem.getInfoAsync(targetPath);
    const sizeBytes = outInfo.exists && 'size' in outInfo ? outInfo.size || 0 : 0;

    // 7. Auto prune rolling backups (keep latest MAX_ROLLING_BACKUPS)
    await this.pruneRollingBackups(MAX_ROLLING_BACKUPS);

    return {
      fileName,
      filePath: targetPath,
      createdAt: now,
      sizeBytes,
      metadata,
    };
  }

  /**
   * Restores a full backup from a given zip file path.
   * Creates an emergency safety checkpoint before replacing the database.
   */
  static async restoreBackup(backupFilePath: string): Promise<RestoreResult> {
    const fileInfo = await FileSystem.getInfoAsync(backupFilePath);
    if (!fileInfo.exists) {
      throw new Error('Backup file does not exist: ' + backupFilePath);
    }

    // 1. Read and inspect zip file
    const zipBase64 = await FileSystem.readAsStringAsync(backupFilePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const zip = await JSZip.loadAsync(zipBase64, { base64: true });

    // Validate database file presence
    const dbEntry = zip.file('flashcards.db');
    if (!dbEntry) {
      throw new Error('Invalid backup archive: missing flashcards.db');
    }

    // Read metadata if present
    let meta: BackupMetadata | null = null;
    const metaEntry = zip.file('meta.json');
    if (metaEntry) {
      try {
        const metaStr = await metaEntry.async('string');
        meta = JSON.parse(metaStr);
      } catch (e) {
        console.warn('Could not parse backup meta.json:', e);
      }
    }

    // 2. Unpack database to temporary staging file
    const restoredDbBase64 = await dbEntry.async('base64');
    const stagingDbPath = `${FileSystem.documentDirectory}SQLite/flashcards_staging.db`;

    await FileSystem.writeAsStringAsync(stagingDbPath, restoredDbBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 3. Close active SQLite connection
    await closeDatabase();

    // 4. Create safety backup of existing database in case restore fails
    const safetyDbPath = `${DB_PATH}.pre_restore_bak`;
    const curDbInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (curDbInfo.exists) {
      try {
        await FileSystem.copyAsync({ from: DB_PATH, to: safetyDbPath });
      } catch (e) {
        console.warn('Could not create safety backup:', e);
      }
    }

    try {
      // Overwrite main db with staging db
      await FileSystem.copyAsync({ from: stagingDbPath, to: DB_PATH });
      await FileSystem.deleteAsync(stagingDbPath, { idempotent: true });

      // Clean up stale WAL / SHM files if any
      await FileSystem.deleteAsync(`${DB_PATH}-wal`, { idempotent: true });
      await FileSystem.deleteAsync(`${DB_PATH}-shm`, { idempotent: true });

      // 5. Restore media files
      const mediaDirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
      if (!mediaDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
      }

      const mediaEntries = zip.folder('media');
      if (mediaEntries) {
        const filePromises: Promise<any>[] = [];
        mediaEntries.forEach((relPath, entry) => {
          if (!entry.dir) {
            filePromises.push(
              (async () => {
                const b64 = await entry.async('base64');
                const dest = `${MEDIA_DIR}${relPath}`;
                await FileSystem.writeAsStringAsync(dest, b64, {
                  encoding: FileSystem.EncodingType.Base64,
                });
              })()
            );
          }
        });
        await Promise.all(filePromises);
      }

      // 6. Test restored database integrity
      const check = await checkDatabaseIntegrity();
      if (!check.ok) {
        throw new Error(`Restored database failed integrity check: ${check.message}`);
      }

      // Database is healthy, remove emergency backup
      await FileSystem.deleteAsync(safetyDbPath, { idempotent: true });

      const newDb = await getDatabase();
      const finalCards = await newDb.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM cards');
      const finalDecks = await newDb.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM decks');

      return {
        success: true,
        message: 'Database restored successfully',
        cardCount: finalCards?.count || meta?.cardCount || 0,
        deckCount: finalDecks?.count || meta?.deckCount || 0,
      };
    } catch (err: any) {
      // Rollback to safety backup
      console.error('Restore failed, rolling back to pre-restore backup:', err);
      const safetyInfo = await FileSystem.getInfoAsync(safetyDbPath);
      if (safetyInfo.exists) {
        try {
          await FileSystem.copyAsync({ from: safetyDbPath, to: DB_PATH });
        } catch {}
      }
      throw new Error(`Failed to restore backup: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * Lists all local backups sorted by creation date descending.
   */
  static async listBackups(): Promise<BackupInfo[]> {
    await this.ensureBackupsDir();
    const files = await FileSystem.readDirectoryAsync(BACKUPS_DIR);
    const backupFiles = files.filter(f => f.endsWith('.zip'));

    const list: BackupInfo[] = [];

    for (const fileName of backupFiles) {
      const filePath = `${BACKUPS_DIR}${fileName}`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        const sizeBytes = 'size' in info ? info.size || 0 : 0;
        const modTime = 'modificationTime' in info ? (info.modificationTime || 0) * 1000 : Date.now();

        // Extract timestamp from filename format backup_YYYY-MM-DD_HH-mm-ss.zip
        let createdAt = modTime;
        const match = fileName.match(/backup_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
        if (match) {
          const [, y, m, d, h, min, s] = match;
          const parsed = new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).getTime();
          if (!isNaN(parsed)) {
            createdAt = parsed;
          }
        }

        list.push({
          fileName,
          filePath,
          createdAt,
          sizeBytes,
        });
      }
    }

    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Deletes a backup file by name.
   */
  static async deleteBackup(fileName: string): Promise<void> {
    const filePath = `${BACKUPS_DIR}${fileName}`;
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  }

  /**
   * Shares a backup file via native share sheet.
   */
  static async shareBackup(fileName: string): Promise<void> {
    const filePath = `${BACKUPS_DIR}${fileName}`;
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Native file sharing is not available on this device');
    }
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/zip',
      dialogTitle: 'Share Backup Archive',
      UTI: 'com.pkware.zip-archive',
    });
  }

  /**
   * Picks a backup zip from the device file manager and imports it into the backups folder.
   */
  static async importBackupFromDocumentPicker(): Promise<BackupInfo | null> {
    await this.ensureBackupsDir();

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed', '*/*'],
      copyToCacheDirectory: Platform.OS === 'ios',
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const targetName = asset.name.endsWith('.zip') ? asset.name : `${asset.name}.zip`;
    const targetPath = `${BACKUPS_DIR}${targetName}`;

    await FileSystem.copyAsync({
      from: asset.uri,
      to: targetPath,
    });

    const info = await FileSystem.getInfoAsync(targetPath);
    return {
      fileName: targetName,
      filePath: targetPath,
      createdAt: Date.now(),
      sizeBytes: info.exists && 'size' in info ? info.size || 0 : 0,
    };
  }

  /**
   * Automatically retains only the most recent N backups, deleting older ones.
   */
  private static async pruneRollingBackups(maxRetention: number): Promise<void> {
    try {
      const backups = await this.listBackups();
      if (backups.length > maxRetention) {
        const toDelete = backups.slice(maxRetention);
        for (const b of toDelete) {
          await this.deleteBackup(b.fileName);
        }
      }
    } catch (e) {
      console.warn('Error pruning rolling backups:', e);
    }
  }
}
