import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Universal file reading utilities for React Native (Android, iOS, Web)
 * Handles Android DocumentPicker cache sandbox, content:// URIs, and large binary files.
 */
export const fileReader = {
  /**
   * Reads a file URI into an ArrayBuffer safely across platforms.
   * Avoids Base64 memory overhead and Expo Go experience sandbox restrictions.
   */
  async readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
    // Guard against large files (> 25MB) that exceed Android heap limit and cause OutOfMemoryError
    if (Platform.OS !== 'web') {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && typeof info.size === 'number' && info.size > 25 * 1024 * 1024) {
          throw new Error(
            `File size (${Math.round(info.size / (1024 * 1024))} MB) exceeds the memory limit for full buffer reading. Please use streaming or URI-based extraction.`
          );
        }
      } catch (checkErr: any) {
        if (checkErr.message?.includes('exceeds the memory limit')) {
          throw checkErr;
        }
      }
    }

    // Strategy 1: React Native fetch() -> arrayBuffer()
    // In React Native, fetch() natively handles file:// and content:// URIs without Expo Go sandboxing limits
    try {
      const response = await fetch(uri);
      if (response.ok || response.status === 0 || response.status === 200) {
        const buffer = await response.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          return buffer;
        }
      }
    } catch (e1) {
      console.warn('[fileReader] fetch(uri).arrayBuffer() failed:', e1);
    }

    // Strategy 2: fetch() -> blob() -> FileReader
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('FileReader result is not an ArrayBuffer'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsArrayBuffer(blob);
      });
      if (buffer && buffer.byteLength > 0) {
        return buffer;
      }
    } catch (e2) {
      console.warn('[fileReader] fetch(uri).blob() failed:', e2);
    }

    // Strategy 3: Modern expo-file-system File (SDK 57)
    try {
      const { File } = require('expo-file-system');
      const f = new File(uri);
      const buffer = await f.arrayBuffer();
      if (buffer && buffer.byteLength > 0) {
        return buffer;
      }
    } catch (e3) {
      console.warn('[fileReader] File.arrayBuffer() failed:', e3);
    }

    // Strategy 4: expo-file-system legacy Base64 decode
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer as ArrayBuffer;
    } catch (e4) {
      console.warn('[fileReader] FileSystem.readAsStringAsync failed:', e4);
    }

    throw new Error('Unable to read selected file into memory.');
  },

  /**
   * Reads a file URI as UTF-8 text (for CSV, TXT, TSV).
   */
  async readAsText(uri: string): Promise<string> {
    // Strategy 1: React Native fetch() -> text()
    try {
      const response = await fetch(uri);
      const text = await response.text();
      if (text !== undefined && text !== null) {
        return text;
      }
    } catch (e1) {
      console.warn('[fileReader] fetch(uri).text() failed:', e1);
    }

    // Strategy 2: Modern expo-file-system File
    try {
      const { File } = require('expo-file-system');
      const f = new File(uri);
      const text = await f.text();
      if (text !== undefined && text !== null) {
        return text;
      }
    } catch (e2) {
      console.warn('[fileReader] File.text() failed:', e2);
    }

    // Strategy 3: FileSystem legacy readAsStringAsync
    try {
      const text = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return text;
    } catch (e3) {
      console.warn('[fileReader] FileSystem.readAsStringAsync failed:', e3);
    }

    // Strategy 4: Decode from ArrayBuffer
    const buf = await this.readAsArrayBuffer(uri);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buf);
  },

  /**
   * Reads a file URI as Base64 string (for XLSX).
   */
  async readAsBase64(uri: string): Promise<string> {
    try {
      return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (e) {
      const buf = await this.readAsArrayBuffer(uri);
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      return btoa(binary);
    }
  },
};
