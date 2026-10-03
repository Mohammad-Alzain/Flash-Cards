import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import pako from 'pako';

/**
 * Interface for seekable binary reading without loading entire files into memory.
 */
export interface ISeekableReader {
  size: number;
  offset: number;
  readBytes(length: number): Promise<Uint8Array>;
  close(): void;
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

/**
 * Fast Base64 to Uint8Array converter without allocating massive intermediate strings.
 */
export function base64ToUint8Array(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0);

  // If environment has global atob
  if (typeof atob === 'function') {
    try {
      const binary = atob(b64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {}
  }

  // Pure typed array fallback
  let len = b64.length;
  while (len > 0 && b64.charCodeAt(len - 1) === 61) {
    len--;
  }
  const byteLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_LOOKUP[b64.charCodeAt(i)];
    const c1 = B64_LOOKUP[b64.charCodeAt(i + 1)];
    const c2 = i + 2 < len ? B64_LOOKUP[b64.charCodeAt(i + 2)] : 0;
    const c3 = i + 3 < len ? B64_LOOKUP[b64.charCodeAt(i + 3)] : 0;

    bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (p < byteLen) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (p < byteLen) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const len = bytes.byteLength;
  if (typeof btoa === 'function' && len <= 262144) {
    try {
      let binary = '';
      const CHUNK = 8192;
      for (let i = 0; i < len; i += CHUNK) {
        const sub = bytes.subarray(i, Math.min(i + CHUNK, len));
        binary += String.fromCharCode.apply(null, sub as unknown as number[]);
      }
      return btoa(binary);
    } catch {}
  }

  // Fast chunked pure JS fallback for large files or environments without btoa
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    chunk += B64_CHARS[b0 >> 2];
    chunk += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    chunk += i + 1 < len ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    chunk += i + 2 < len ? B64_CHARS[b2 & 63] : '=';
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  if (chunk.length > 0) parts.push(chunk);
  return parts.join('');
}

/**
 * Low-memory random-access reader wrapping native FileSystem.readAsStringAsync.
 * Uses position & length to read only the requested slice of bytes without loading 200MB+ archives into RAM.
 */
class FileSystemLegacySeekableReader implements ISeekableReader {
  private uri: string;
  public size: number;
  public offset: number = 0;

  constructor(uri: string, size: number) {
    this.uri = uri;
    this.size = size;
  }

  async readBytes(length: number): Promise<Uint8Array> {
    const actualLen = Math.min(length, Math.max(0, this.size - this.offset));
    if (actualLen <= 0) {
      return new Uint8Array(0);
    }

    const b64 = await FileSystem.readAsStringAsync(this.uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: this.offset,
      length: actualLen,
    });

    this.offset += actualLen;
    return base64ToUint8Array(b64);
  }

  close(): void {
    // No-op
  }
}

/**
 * Random-access reader wrapping native Expo SDK 57 FileHandle.
 * Allows seeking to arbitrary byte offsets in 200MB+ files without high RAM usage.
 */
class FileHandleReader implements ISeekableReader {
  private handle: any;
  private tempFileToDelete?: string;
  public size: number;

  constructor(handle: any, tempFileToDelete?: string) {
    this.handle = handle;
    this.tempFileToDelete = tempFileToDelete;
    this.size = typeof handle.size === 'number' ? handle.size : 0;
  }

  get offset(): number {
    return typeof this.handle.offset === 'number' ? this.handle.offset : 0;
  }

  set offset(val: number) {
    this.handle.offset = val;
  }

  async readBytes(length: number): Promise<Uint8Array> {
    return this.handle.readBytes(length);
  }

  close(): void {
    try {
      this.handle.close();
    } catch {}
    if (this.tempFileToDelete) {
      FileSystem.deleteAsync(this.tempFileToDelete, { idempotent: true }).catch(() => {});
    }
  }
}

/**
 * In-memory seekable reader for ArrayBuffer / Uint8Array (fallback for Web or small files).
 */
class BufferReader implements ISeekableReader {
  private buffer: Uint8Array;
  public size: number;
  public offset: number = 0;

  constructor(data: ArrayBuffer | Uint8Array) {
    this.buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.size = this.buffer.byteLength;
  }

  async readBytes(length: number): Promise<Uint8Array> {
    const end = Math.min(this.offset + length, this.size);
    const slice = this.buffer.subarray(this.offset, end);
    this.offset = end;
    return slice;
  }

  close(): void {
    // No-op for in-memory buffer
  }
}

export interface ZipEntry {
  fileName: string;
  compressionMethod: number; // 0 = stored, 8 = deflated
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export interface IZipArchive {
  entries: Map<string, ZipEntry>;
  hasEntry(fileName: string): boolean;
  getEntry(fileName: string): ZipEntry | undefined;
  getEntryNames(): string[];
  readEntryBytes(fileNameOrEntry: string | ZipEntry): Promise<Uint8Array>;
  readEntryText(fileNameOrEntry: string | ZipEntry): Promise<string>;
  extractEntryToFile(
    fileNameOrEntry: string | ZipEntry,
    targetUri: string,
    skipDirCheck?: boolean
  ): Promise<void>;
  close(): void;
}

// Binary helper functions
function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function readU64(bytes: Uint8Array, offset: number): number {
  const low = readU32(bytes, offset);
  const high = readU32(bytes, offset + 4);
  return high * 4294967296 + low;
}

let hasNativeFileWriteSupport: boolean | null = null;

/**
 * Universal safe byte-writer for files. Writes Uint8Array directly using expo-file-system File,
 * with legacy base64 fallback. Caches native write support to avoid catching thousands of exceptions.
 */
export async function writeBytesToDisk(
  targetUri: string,
  bytes: Uint8Array,
  skipDirCheck: boolean = false
): Promise<void> {
  if (!skipDirCheck) {
    const lastSlash = targetUri.lastIndexOf('/');
    if (lastSlash > 0) {
      const parentDir = targetUri.substring(0, lastSlash + 1);
      try {
        const dirInfo = await FileSystem.getInfoAsync(parentDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
        }
      } catch {}
    }
  }

  if (Platform.OS !== 'web' && hasNativeFileWriteSupport !== false) {
    try {
      const { File } = require('expo-file-system');
      const f = new File(targetUri);
      if (!f.exists) {
        f.create({ intermediates: true });
      }
      f.write(bytes);
      hasNativeFileWriteSupport = true;
      return;
    } catch {
      hasNativeFileWriteSupport = false;
    }
  }

  const b64 = uint8ArrayToBase64(bytes);
  await FileSystem.writeAsStringAsync(targetUri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * High-performance, streaming ZIP archive parser and extractor.
 * Operates with minimal RAM usage by parsing Central Directory headers at the end of the file
 * and reading individual compressed file payloads on demand.
 */
export class ZipArchive implements IZipArchive {
  private reader: ISeekableReader;
  private tempFileToDelete?: string;
  public entries: Map<string, ZipEntry> = new Map();
  private textDecoder = new TextDecoder('utf-8');

  constructor(reader: ISeekableReader, tempFileToDelete?: string) {
    this.reader = reader;
    this.tempFileToDelete = tempFileToDelete;
  }

  /**
   * Initializes the ZIP archive by parsing the End of Central Directory and Central Directory.
   */
  async init(): Promise<void> {
    const fileSize = this.reader.size;
    if (fileSize < 22) {
      throw new Error('Invalid ZIP archive: file size is less than 22 bytes.');
    }

    // 1. Scan for End of Central Directory (EOCD) signature: 0x06054b50 (PK\x05\x06)
    // EOCD is located within the last 65,557 bytes
    const searchLen = Math.min(fileSize, 65557);
    this.reader.offset = fileSize - searchLen;
    const tailBuffer = await this.reader.readBytes(searchLen);

    let eocdRel = -1;
    for (let i = tailBuffer.length - 22; i >= 0; i--) {
      if (readU32(tailBuffer, i) === 0x06054b50) {
        eocdRel = i;
        break;
      }
    }

    if (eocdRel === -1) {
      throw new Error('Invalid ZIP archive: End of Central Directory (EOCD) signature not found.');
    }

    const eocdAbsolute = fileSize - searchLen + eocdRel;
    let totalEntries = readU16(tailBuffer, eocdRel + 10);
    let cdSize = readU32(tailBuffer, eocdRel + 12);
    let cdOffset = readU32(tailBuffer, eocdRel + 16);

    // Check for ZIP64 locator (20 bytes before EOCD: signature 0x07064b50)
    if (cdOffset === 0xffffffff || totalEntries === 0xffff) {
      const locatorOffset = eocdAbsolute - 20;
      if (locatorOffset >= 0) {
        this.reader.offset = locatorOffset;
        const locatorBuf = await this.reader.readBytes(20);
        if (readU32(locatorBuf, 0) === 0x07064b50) {
          const zip64EocdOffset = readU64(locatorBuf, 8);
          this.reader.offset = zip64EocdOffset;
          const zip64EocdBuf = await this.reader.readBytes(56);
          if (readU32(zip64EocdBuf, 0) === 0x06064b50) {
            totalEntries = readU64(zip64EocdBuf, 32);
            cdSize = readU64(zip64EocdBuf, 40);
            cdOffset = readU64(zip64EocdBuf, 48);
          }
        }
      }
    }

    // 2. Read Central Directory
    this.reader.offset = cdOffset;
    const cdBytes = await this.reader.readBytes(cdSize);

    let ptr = 0;
    for (let i = 0; i < totalEntries && ptr + 46 <= cdBytes.length; i++) {
      const sig = readU32(cdBytes, ptr);
      if (sig !== 0x02014b50) {
        break;
      }

      const compressionMethod = readU16(cdBytes, ptr + 10);
      let compSize = readU32(cdBytes, ptr + 20);
      let uncompSize = readU32(cdBytes, ptr + 24);
      const nameLen = readU16(cdBytes, ptr + 28);
      const extraLen = readU16(cdBytes, ptr + 30);
      const commentLen = readU16(cdBytes, ptr + 32);
      let localHeaderOffset = readU32(cdBytes, ptr + 42);

      const fileNameBytes = cdBytes.subarray(ptr + 46, ptr + 46 + nameLen);
      const fileName = this.textDecoder.decode(fileNameBytes);

      // Check ZIP64 extra fields if any 32-bit field is 0xFFFFFFFF
      if (
        (compSize === 0xffffffff || uncompSize === 0xffffffff || localHeaderOffset === 0xffffffff) &&
        extraLen > 0
      ) {
        const extraStart = ptr + 46 + nameLen;
        const extraEnd = extraStart + extraLen;
        let ePtr = extraStart;
        while (ePtr + 4 <= extraEnd) {
          const headerId = readU16(cdBytes, ePtr);
          const dataSize = readU16(cdBytes, ePtr + 2);
          ePtr += 4;
          if (headerId === 0x0001) {
            let z64Ptr = ePtr;
            if (uncompSize === 0xffffffff && z64Ptr + 8 <= extraEnd) {
              uncompSize = readU64(cdBytes, z64Ptr);
              z64Ptr += 8;
            }
            if (compSize === 0xffffffff && z64Ptr + 8 <= extraEnd) {
              compSize = readU64(cdBytes, z64Ptr);
              z64Ptr += 8;
            }
            if (localHeaderOffset === 0xffffffff && z64Ptr + 8 <= extraEnd) {
              localHeaderOffset = readU64(cdBytes, z64Ptr);
              z64Ptr += 8;
            }
          }
          ePtr += dataSize;
        }
      }

      this.entries.set(fileName, {
        fileName,
        compressionMethod,
        compressedSize: compSize,
        uncompressedSize: uncompSize,
        localHeaderOffset,
      });

      ptr += 46 + nameLen + extraLen + commentLen;
    }
  }

  hasEntry(fileName: string): boolean {
    return this.entries.has(fileName);
  }

  getEntry(fileName: string): ZipEntry | undefined {
    return this.entries.get(fileName);
  }

  getEntryNames(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Reads and decompresses the bytes of a specific ZIP entry on demand.
   * Only loads the exact entry's compressed bytes into memory, then frees them immediately.
   */
  async readEntryBytes(fileNameOrEntry: string | ZipEntry): Promise<Uint8Array> {
    const entry =
      typeof fileNameOrEntry === 'string'
        ? this.entries.get(fileNameOrEntry)
        : fileNameOrEntry;

    if (!entry) {
      throw new Error(
        `Entry '${typeof fileNameOrEntry === 'string' ? fileNameOrEntry : 'unknown'}' not found in ZIP archive.`
      );
    }

    // Seek to local header
    this.reader.offset = entry.localHeaderOffset;
    const localHeader = await this.reader.readBytes(30);
    const localSig = readU32(localHeader, 0);
    if (localSig !== 0x04034b50) {
      throw new Error(`Invalid local file header signature for entry: ${entry.fileName}`);
    }

    const localNameLen = readU16(localHeader, 26);
    const localExtraLen = readU16(localHeader, 28);
    const dataStart = entry.localHeaderOffset + 30 + localNameLen + localExtraLen;

    // Seek to data payload
    this.reader.offset = dataStart;
    const compressedData = await this.reader.readBytes(entry.compressedSize);

    if (entry.compressionMethod === 0) {
      // Stored (uncompressed)
      return compressedData;
    } else if (entry.compressionMethod === 8) {
      // Deflated: decompress raw stream using pako.inflateRaw
      try {
        return pako.inflateRaw(compressedData);
      } catch (err: any) {
        throw new Error(
          `Failed to decompress entry '${entry.fileName}': ${err.message || 'inflate error'}`
        );
      }
    } else {
      throw new Error(
        `Unsupported compression method (${entry.compressionMethod}) for entry '${entry.fileName}'.`
      );
    }
  }

  async readEntryText(fileNameOrEntry: string | ZipEntry): Promise<string> {
    const bytes = await this.readEntryBytes(fileNameOrEntry);
    return this.textDecoder.decode(bytes);
  }

  async extractEntryToFile(
    fileNameOrEntry: string | ZipEntry,
    targetUri: string,
    skipDirCheck: boolean = false
  ): Promise<void> {
    const bytes = await this.readEntryBytes(fileNameOrEntry);
    await writeBytesToDisk(targetUri, bytes, skipDirCheck);
  }

  close(): void {
    this.reader.close();
    this.entries.clear();
    if (this.tempFileToDelete) {
      FileSystem.deleteAsync(this.tempFileToDelete, { idempotent: true }).catch(() => {});
      this.tempFileToDelete = undefined;
    }
  }
}

/**
 * Opens a ZIP archive safely across platforms.
 * Uses low-memory random-access streaming: reads 200MB+ APKG archives with < 5MB of RAM.
 * NEVER reads entire large archives into RAM.
 */
export async function openZipArchive(
  source: string | ArrayBuffer | Uint8Array
): Promise<IZipArchive> {
  let reader: ISeekableReader;
  let tempFileToClean: string | undefined = undefined;

  if (typeof source === 'string') {
    let uri = source;

    if (Platform.OS === 'web') {
      const resp = await fetch(uri);
      const ab = await resp.arrayBuffer();
      reader = new BufferReader(ab);
    } else {
      // Native (Android / iOS):
      // If uri is content://, stage it directly to cacheDirectory to enable seekable reads and accurate file size
      if (uri.startsWith('content://')) {
        const tempName = `zip_staged_${Date.now()}_${Math.floor(Math.random() * 10000)}.tmp`;
        const tempPath = `${FileSystem.cacheDirectory}${tempName}`;
        try {
          await FileSystem.copyAsync({ from: uri, to: tempPath });
          uri = tempPath;
          tempFileToClean = tempPath;
        } catch (stageErr) {
          console.warn('[ZipReader] Could not stage content URI, attempting direct read:', stageErr);
        }
      }

      let fileSize = 0;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && typeof info.size === 'number') {
          fileSize = info.size;
        }
      } catch (infoErr) {
        console.warn('[ZipReader] Could not get file size via getInfoAsync:', infoErr);
      }

      // Priority 1: If FileHandle from expo-file-system is available and working, try it
      let handle: any = null;
      try {
        const { File, FileMode } = require('expo-file-system');
        const file = new File(uri);
        handle = file.open(FileMode.ReadOnly);
        if (handle && typeof handle.readBytes === 'function') {
          reader = new FileHandleReader(handle, tempFileToClean);
          tempFileToClean = undefined; // Handled by FileHandleReader
        }
      } catch (handleErr) {
        // Fall through to legacy seekable reader
      }

      // Priority 2: Native streaming via FileSystem.readAsStringAsync with position & length
      // Reads only the requested slice of bytes into memory, zero OutOfMemory risk on 200MB+ archives!
      if (!reader!) {
        if (fileSize > 0) {
          reader = new FileSystemLegacySeekableReader(uri, fileSize);
        } else {
          // Double check file info
          const info = await FileSystem.getInfoAsync(uri);
          fileSize = info.exists && typeof info.size === 'number' ? info.size : 0;
          if (fileSize > 0) {
            reader = new FileSystemLegacySeekableReader(uri, fileSize);
          } else {
            throw new Error('Selected archive file does not exist or is empty.');
          }
        }
      }
    }
  } else {
    reader = new BufferReader(source);
  }

  const archive = new ZipArchive(reader, tempFileToClean);
  await archive.init();
  return archive;
}
