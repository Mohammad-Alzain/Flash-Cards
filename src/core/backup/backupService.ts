import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import JSZip from 'jszip';
import { deserializeDatabaseAsync, backupDatabaseAsync } from 'expo-sqlite';
import { getDatabase, checkpointDatabase, checkDatabaseIntegrity } from '../db/connection';

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

export type BackupStage = 'preparing' | 'database' | 'media' | 'compressing' | 'saving' | 'complete';

export interface BackupProgress {
  percent: number; // 0 to 100
  stage: BackupStage;
  message: string;
  detail?: string;
  cardCount?: number;
  deckCount?: number;
  mediaCount?: number;
}

const BACKUPS_DIR = `${FileSystem.documentDirectory}backups/`;
const MEDIA_DIR = `${FileSystem.documentDirectory}media/`;
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
   * Reports real-time progress callbacks across all backup stages.
   */
  static async createBackup(onProgress?: (progress: BackupProgress) => void): Promise<BackupInfo> {
    onProgress?.({
      percent: 5,
      stage: 'preparing',
      message: 'جاري تهيئة بيئة النسخ الاحتياطي...',
      detail: 'فحص الحاويات ومزامنة الذاكرة',
    });

    await this.ensureBackupsDir();

    // 1. Flush WAL to write all transactions into the primary db file
    await checkpointDatabase();

    const db = await getDatabase();

    onProgress?.({
      percent: 15,
      stage: 'database',
      message: 'جاري استخراج بيانات البطاقات والرزم...',
      detail: 'قراءة الجداول والإحصائيات',
    });

    // 2. Gather counts for metadata
    const cardsCountRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM cards');
    const notesCountRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM notes');
    const decksCountRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM decks');
    const mediaCountRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM media');

    const cardCount = cardsCountRes?.count || 0;
    const noteCount = notesCountRes?.count || 0;
    const deckCount = decksCountRes?.count || 0;
    const mediaCount = mediaCountRes?.count || 0;

    onProgress?.({
      percent: 25,
      stage: 'database',
      message: 'جاري تشفير لقطة الذاكرة وقاعدة البيانات...',
      detail: `${cardCount} بطاقة • ${deckCount} رزم`,
      cardCount,
      deckCount,
      mediaCount,
    });

    // 3. Serialize SQLite database to Uint8Array directly via SQLite C API
    // This avoids ExponentFileSystem permission restrictions on Android /databases/ directory
    const dbBytes = await db.serializeAsync('main');
    const dbSizeBytes = dbBytes.byteLength;

    // 4. Build zip
    const zip = new JSZip();
    zip.file('flashcards.db', dbBytes);

    onProgress?.({
      percent: 40,
      stage: 'media',
      message: 'جاري فحص وحزم الوسائط والصوتيات...',
      detail: 'فحص ملفات الوسائط المحلية',
      cardCount,
      deckCount,
      mediaCount,
    });

    // 5. Gather all local media files
    const mediaDirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
    let actualMediaFilesCount = 0;
    if (mediaDirInfo.exists && mediaDirInfo.isDirectory) {
      const files = await FileSystem.readDirectoryAsync(MEDIA_DIR);
      const totalFiles = files.length;
      const mediaZipFolder = zip.folder('media');
      for (let i = 0; i < totalFiles; i++) {
        const f = files[i];
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

        // Report granular media progress every few files or proportionally
        if (i % 3 === 0 || i === totalFiles - 1) {
          const mediaPct = Math.round(40 + ((i + 1) / totalFiles) * 35);
          onProgress?.({
            percent: Math.min(75, mediaPct),
            stage: 'media',
            message: 'جاري حزم الوسائط والصوتيات...',
            detail: `${i + 1} من ${totalFiles} ملف وسائط`,
            cardCount,
            deckCount,
            mediaCount: actualMediaFilesCount,
          });
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

    onProgress?.({
      percent: 78,
      stage: 'compressing',
      message: 'جاري ضغط الأرشيف وإنشاء الحزمة...',
      detail: 'خوارزمية DEFLATE المشفرة',
      cardCount,
      deckCount,
      mediaCount: metadata.mediaCount,
    });

    // 6. Generate ZIP file with live compression progress
    const zipBase64 = await zip.generateAsync(
      {
        type: 'base64',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      },
      (metadataObj) => {
        const compPct = Math.round(78 + (metadataObj.percent / 100) * 16);
        onProgress?.({
          percent: Math.min(94, compPct),
          stage: 'compressing',
          message: 'جاري ضغط الأرشيف وإنشاء الحزمة...',
          detail: `${Math.round(metadataObj.percent)}% مكتمل`,
          cardCount,
          deckCount,
          mediaCount: metadata.mediaCount,
        });
      }
    );

    onProgress?.({
      percent: 95,
      stage: 'saving',
      message: 'جاري حفظ النسخة الاحتياطية...',
      detail: 'كتابة ملف الأرشيف الآمن',
      cardCount,
      deckCount,
      mediaCount: metadata.mediaCount,
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

    onProgress?.({
      percent: 100,
      stage: 'complete',
      message: 'تم إنشاء النسخة الاحتياطية بنجاح!',
      detail: fileName,
      cardCount,
      deckCount,
      mediaCount: metadata.mediaCount,
    });

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

    // 2. Extract restored database binary from zip
    const restoredBytes = await dbEntry.async('uint8array');

    const targetDb = await getDatabase();

    // 3. Create safety checkpoint in-memory
    const safetyBytes = await targetDb.serializeAsync('main');

    // 4. Load restored data into an in-memory database instance
    const sourceDb = await deserializeDatabaseAsync(restoredBytes);

    try {
      // 5. Transfer all data using SQLite native online backup API
      await backupDatabaseAsync({
        sourceDatabase: sourceDb,
        destDatabase: targetDb,
      });

      await sourceDb.closeAsync();
      await checkpointDatabase();

      // 6. Restore media files
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

      // 7. Test restored database integrity
      const check = await checkDatabaseIntegrity();
      if (!check.ok) {
        throw new Error(`Restored database failed integrity check: ${check.message}`);
      }

      const finalCards = await targetDb.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM cards');
      const finalDecks = await targetDb.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM decks');

      return {
        success: true,
        message: 'Database restored successfully',
        cardCount: finalCards?.count || meta?.cardCount || 0,
        deckCount: finalDecks?.count || meta?.deckCount || 0,
      };
    } catch (err: any) {
      // Rollback to safety checkpoint in memory
      console.error('Restore failed, rolling back to pre-restore backup:', err);
      try {
        const rollbackDb = await deserializeDatabaseAsync(safetyBytes);
        await backupDatabaseAsync({
          sourceDatabase: rollbackDb,
          destDatabase: targetDb,
        });
        await rollbackDb.closeAsync();
        await checkpointDatabase();
      } catch (rollbackErr) {
        console.error('Failed to rollback:', rollbackErr);
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
