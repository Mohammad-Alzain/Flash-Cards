export type ExportFormat = 'apkg' | 'csv' | 'tsv' | 'xlsx';

export interface ExportProgress {
  percent: number;
  message: string;
  stage?: string;
  current?: number;
  total?: number;
}

export interface ExportOptions {
  deckId?: string; // undefined means all decks
  includeScheduling?: boolean; // include review logs and interval info
  includeMedia?: boolean; // include referenced media files
  delimiter?: string; // for CSV/TSV
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportResult {
  filePath: string;
  fileName: string;
  cardCount: number;
  noteCount: number;
  mediaCount: number;
  sizeBytes: number;
}

export interface NoteExportData {
  id: string;
  guid: string;
  deckName: string;
  deckId: string;
  noteTypeName: string;
  fields: Record<string, string>;
  fieldNames: string[];
  tags: string[];
  cards: CardExportData[];
}

export interface CardExportData {
  id: string;
  templateOrd: number;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  easeFactor: number;
  intervalDays: number;
  lastReview: number | null;
  suspended: boolean;
  flag: number;
}
