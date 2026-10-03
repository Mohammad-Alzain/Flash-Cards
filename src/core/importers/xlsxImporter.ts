import * as XLSX from 'xlsx';
import {
  ImportPreviewResult,
  ParsedCardCandidate,
  ImportOptions,
} from './types';

export const xlsxImporter = {
  /**
   * Generates a preview from an Excel file (base64 string or ArrayBuffer)
   */
  generatePreview(fileData: string, fileName: string): ImportPreviewResult {
    const workbook = XLSX.read(fileData, { type: 'base64' });
    const sheetNames = workbook.SheetNames || [];
    const firstSheetName = sheetNames[0] || '';
    const worksheet = workbook.Sheets[firstSheetName];

    const jsonRows: string[][] = worksheet
      ? XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
      : [];

    return {
      sourceType: 'xlsx',
      fileName,
      totalRows: jsonRows.length,
      sheets: sheetNames,
      sampleRows: jsonRows.slice(0, 20).map((row) => row.map((cell) => String(cell ?? ''))),
    };
  },

  /**
   * Parses sheet rows using column mappings into card candidates
   */
  parseSheet(
    fileData: string,
    sheetName: string | undefined,
    options: ImportOptions
  ): ParsedCardCandidate[] {
    const workbook = XLSX.read(fileData, { type: 'base64' });
    const targetSheet = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheet];
    if (!worksheet) return [];

    const jsonRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
    });

    const candidates: ParsedCardCandidate[] = [];
    const startIndex = options.hasHeader ? 1 : 0;
    const mapping = options.columnMapping || { 0: 'Front', 1: 'Back' };

    for (let r = startIndex; r < jsonRows.length; r++) {
      const row = jsonRows[r];
      if (!row || row.length === 0) continue;

      const fields: Record<string, string> = {};
      let tags = '';
      let deckName: string | undefined = undefined;

      for (let c = 0; c < row.length; c++) {
        const mappedTarget = mapping[c];
        if (!mappedTarget || mappedTarget === '__ignore__') continue;

        const cellVal = String(row[c] ?? '').trim();
        if (mappedTarget === '__tags__') {
          tags = cellVal;
        } else if (mappedTarget === '__deck__') {
          deckName = cellVal || undefined;
        } else {
          fields[mappedTarget] = cellVal;
        }
      }

      if (Object.values(fields).some((v) => v.length > 0)) {
        candidates.push({
          fields,
          tags,
          deckName,
        });
      }
    }

    return candidates;
  },
};
