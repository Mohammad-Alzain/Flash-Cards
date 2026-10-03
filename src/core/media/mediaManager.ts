import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../db/connection';
import { MediaFile } from '../types/models';

const getMediaDir = (): string => {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}media/` : '';
};

export const mediaManager = {
  getMediaDirectory(): string {
    return getMediaDir();
  },

  async ensureDirectoryExists(): Promise<void> {
    const dir = getMediaDir();
    if (!dir) return;
    try {
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
    } catch (e) {
      console.warn('[MediaManager] Could not ensure media dir exists:', e);
    }
  },

  resolveUri(filename: string): string {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('file://')) {
      return filename;
    }
    const dir = getMediaDir();
    return dir ? `${dir}${filename}` : filename;
  },

  async saveMediaFile(
    sourceUri: string,
    targetFilename?: string
  ): Promise<{ filename: string; fullUri: string; size: number }> {
    await this.ensureDirectoryExists();

    const ext = sourceUri.split('.').pop() || 'dat';
    const filename = targetFilename || `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const destination = `${getMediaDir()}${filename}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destination,
    });

    const fileInfo = await FileSystem.getInfoAsync(destination);
    const size = fileInfo.exists ? (fileInfo as any).size || 0 : 0;

    // Save metadata in SQLite
    const db = await getDatabase();
    const mediaId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.runAsync(
      `INSERT OR IGNORE INTO media (id, filename, mime, size, hash)
       VALUES (?, ?, ?, ?, ?);`,
      mediaId,
      filename,
      `image/${ext}`,
      size,
      ''
    );

    return {
      filename,
      fullUri: destination,
      size,
    };
  },

  async deleteMediaFile(filename: string): Promise<void> {
    const fullUri = this.resolveUri(filename);
    const fileInfo = await FileSystem.getInfoAsync(fullUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fullUri, { idempotent: true });
    }

    const db = await getDatabase();
    await db.runAsync('DELETE FROM media WHERE filename = ?;', filename);
  },

  async clearAllMedia(): Promise<void> {
    const dir = getMediaDir();
    if (dir) {
      try {
        const info = await FileSystem.getInfoAsync(dir);
        if (info.exists) {
          await FileSystem.deleteAsync(dir, { idempotent: true });
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }
      } catch (e) {
        console.warn('[MediaManager] Could not clear media dir:', e);
      }
    }
  },

  async getStorageStats(): Promise<{ count: number; totalSizeBytes: number }> {
    try {
      await this.ensureDirectoryExists();
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ count: number; total_size: number }>(
        'SELECT COUNT(*) as count, SUM(size) as total_size FROM media;'
      );
      return {
        count: Number(row?.count || 0),
        totalSizeBytes: Number(row?.total_size || 0),
      };
    } catch (e) {
      console.warn('[MediaManager] getStorageStats error:', e);
      return { count: 0, totalSizeBytes: 0 };
    }
  },
};
