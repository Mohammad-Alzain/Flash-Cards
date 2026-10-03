export type ImportSourceType = 'apkg' | 'csv' | 'txt' | 'xlsx' | 'paste';

export interface ParsedCardCandidate {
  guid?: string;
  fields: Record<string, string>;
  tags?: string;
  deckName?: string;
  noteTypeName?: string;
  noteTypeId?: string;
  templateOrd?: number;
  due?: number;
  intervalDays?: number;
  easeFactor?: number;
  reps?: number;
  lapses?: number;
  state?: number;
}

export interface ImportPreviewResult {
  sourceType: ImportSourceType;
  fileName: string;
  totalRows: number;
  headers?: string[];
  sampleRows: string[][];
  detectedDelimiter?: string;
  sheets?: string[];
  decksFound?: string[];
  noteTypesFound?: string[];
}

export interface ImportProgress {
  stage: 'inspect' | 'media' | 'parsing' | 'saving';
  percent: number; // 0 - 100
  current: number;
  total: number;
  message: string;
  estimatedRemainingSeconds?: number;
}

export interface ImportOptions {
  targetDeckId: string;
  noteTypeId: string;
  duplicateStrategy: 'skip' | 'update' | 'new';
  keepScheduling: boolean;
  columnMapping?: Record<number, string>; // columnIndex -> fieldName ('Front', 'Back', etc. or '__ignore__', '__tags__')
  hasHeader?: boolean;
  onProgress?: (progress: ImportProgress) => void;
}

export interface ImportSummary {
  historyId: string;
  sourceType: ImportSourceType;
  fileName: string;
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}
