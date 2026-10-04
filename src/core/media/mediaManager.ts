import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../db/connection';
import { MediaFile } from '../types/models';

const getMediaDir = (): string => {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}media/` : '';
};

const mediaCache = new Map<string, string | null>();

function toSafeFileUri(uri: string): string {
  try {
    const decoded = decodeURI(uri);
    return encodeURI(decoded).replace(/#/g, '%23');
  } catch {
    return uri;
  }
}

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
    // Strip Anki [sound:...] wrapper if present
    const clean = filename.replace(/^\[sound:/i, '').replace(/\]$/, '').trim();
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('file://')) {
      return clean;
    }
    const dir = getMediaDir();
    return dir ? `${dir}${clean}` : clean;
  },

  /**
   * Resolves a media filename to a valid file:// URI.
   * Tries: original name, decodeURIComponent, encodeURI, NFC/NFD Unicode normalization,
   * and case-insensitive directory listing fallback.
   * Returns valid file:// URI or null if not found.
   */
  async resolveMediaUri(filename: string): Promise<string | null> {
    if (!filename) return null;

    let clean = filename
      .replace(/^\[sound:/i, '')
      .replace(/\]$/, '')
      .replace(/^['"]|['"]$/g, '')
      .replace(/^\.\//, '')
      .replace(/&amp;/g, '&')
      .trim();

    if (!clean) return null;

    if (
      clean.startsWith('http://') ||
      clean.startsWith('https://') ||
      clean.startsWith('data:')
    ) {
      return clean;
    }

    if (mediaCache.has(clean)) {
      return mediaCache.get(clean) || null;
    }

    const dir = getMediaDir();
    if (!dir) return null;

    // Candidate variations
    const candidates = new Set<string>();
    candidates.add(clean);

    try {
      candidates.add(decodeURIComponent(clean));
    } catch {}

    try {
      candidates.add(encodeURI(clean));
    } catch {}

    // NFC and NFD Unicode normalization (e.g. macOS vs Android/Anki)
    for (const cand of Array.from(candidates)) {
      try {
        candidates.add(cand.normalize('NFC'));
        candidates.add(cand.normalize('NFD'));
      } catch {}
    }

    // Direct check for each candidate
    for (const cand of candidates) {
      const fullPath = cand.startsWith('file://') ? cand : `${dir}${cand}`;
      const safeUri = toSafeFileUri(fullPath);
      try {
        const info = await FileSystem.getInfoAsync(safeUri);
        if (info && info.exists) {
          mediaCache.set(clean, safeUri);
          console.log(`[MEDIA] Found file on disk: "${cand}" -> "${safeUri}" (exists: true)`);
          return safeUri;
        }
      } catch {}
    }

    // Directory listing fallback for case-insensitivity or subtle naming mismatches
    try {
      const files = await FileSystem.readDirectoryAsync(dir);
      const targetLower = clean.toLowerCase();
      let decodedLower = targetLower;
      try {
        decodedLower = decodeURIComponent(clean).toLowerCase();
      } catch {}

      const matched = files.find((f) => {
        const fLower = f.toLowerCase();
        return (
          fLower === targetLower ||
          fLower === decodedLower ||
          f.normalize('NFC').toLowerCase() === targetLower ||
          f.normalize('NFD').toLowerCase() === targetLower
        );
      });

      if (matched) {
        const safeUri = toSafeFileUri(`${dir}${matched}`);
        mediaCache.set(clean, safeUri);
        console.log(`[MEDIA] Found file via directory listing: "${matched}" -> "${safeUri}" (exists: true)`);
        return safeUri;
      }
    } catch (e) {
      // Safe ignore
    }

    mediaCache.set(clean, null);
    console.log(`[MEDIA] File not found on disk: "${clean}" (exists: false)`);
    return null;
  },

  /**
   * Resolves the existing file URI checking raw, decoded, and encoded filename variations.
   * Returns null if file does not exist on disk.
   */
  async findExistingUri(filename: string): Promise<string | null> {
    return this.resolveMediaUri(filename);
  },

  async fileExists(filename: string): Promise<boolean> {
    if (!filename) return false;
    const existing = await this.resolveMediaUri(filename);
    return existing !== null;
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
    mediaCache.clear();
    const fullUri = this.resolveUri(filename);
    const fileInfo = await FileSystem.getInfoAsync(fullUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fullUri, { idempotent: true });
    }

    const db = await getDatabase();
    await db.runAsync('DELETE FROM media WHERE filename = ?;', filename);
  },

  async clearAllMedia(): Promise<void> {
    mediaCache.clear();
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
