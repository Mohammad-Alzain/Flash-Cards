import Papa from 'papaparse';
import {
  ImportPreviewResult,
  ParsedCardCandidate,
  ImportOptions,
} from './types';

export const textImporter = {
  /**
   * Detects delimiter from raw content or Anki headers
   */
  detectDelimiter(content: string): string {
    const lines = content.split('\n', 10);
    for (const line of lines) {
      if (line.startsWith('#separator:')) {
        const val = line.replace('#separator:', '').trim().toLowerCase();
        if (val === 'tab' || val === '\\t') return '\t';
        if (val === 'comma') return ',';
        if (val === 'semicolon') return ';';
        if (val === 'pipe') return '|';
        return val;
      }
    }

    // Auto-detect based on character occurrences in non-comment lines
    const sample = lines.filter((l) => !l.startsWith('#')).join('\n');
    const tabCount = (sample.match(/\t/g) || []).length;
    const commaCount = (sample.match(/,/g) || []).length;
    const semiCount = (sample.match(/;/g) || []).length;
    const pipeCount = (sample.match(/\|/g) || []).length;

    if (tabCount >= commaCount && tabCount >= semiCount && tabCount >= pipeCount) return '\t';
    if (semiCount >= commaCount && semiCount >= pipeCount) return ';';
    if (pipeCount >= commaCount) return '|';
    return ',';
  },

  /**
   * Generates a preview of the text/CSV file (first 20 rows)
   */
  generatePreview(content: string, fileName: string): ImportPreviewResult {
    const delimiter = this.detectDelimiter(content);

    // Filter out Anki # comments for data parsing
    const lines = content.split(/\r?\n/);
    const dataLines: string[] = [];
    for (const line of lines) {
      if (!line.startsWith('#') && line.trim().length > 0) {
        dataLines.push(line);
      }
    }

    const cleanContent = dataLines.join('\n');
    const parsed = Papa.parse<string[]>(cleanContent, {
      delimiter,
      skipEmptyLines: true,
      preview: 25,
    });

    const rows = parsed.data || [];
    const totalLinesEstimate = dataLines.length;

    return {
      sourceType: fileName.endsWith('.csv') ? 'csv' : 'txt',
      fileName,
      totalRows: totalLinesEstimate,
      detectedDelimiter: delimiter === '\t' ? 'Tab' : delimiter,
      sampleRows: rows.slice(0, 20),
    };
  },

  /**
   * Parses Quizlet-style copy-pasted text (term<TAB>def or term - def)
   */
  parsePastedText(text: string): ParsedCardCandidate[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const candidates: ParsedCardCandidate[] = [];

    for (const line of lines) {
      let term = '';
      let def = '';

      if (line.includes('\t')) {
        const parts = line.split('\t');
        term = parts[0]?.trim() || '';
        def = parts.slice(1).join('\t').trim();
      } else if (line.includes(' - ')) {
        const parts = line.split(' - ');
        term = parts[0]?.trim() || '';
        def = parts.slice(1).join(' - ').trim();
      } else if (line.includes(' : ')) {
        const parts = line.split(' : ');
        term = parts[0]?.trim() || '';
        def = parts.slice(1).join(' : ').trim();
      } else if (line.includes(',')) {
        const parts = line.split(',');
        term = parts[0]?.trim() || '';
        def = parts.slice(1).join(',').trim();
      } else {
        term = line.trim();
        def = '';
      }

      if (term || def) {
        candidates.push({
          fields: {
            Front: term,
            Back: def,
          },
        });
      }
    }

    return candidates;
  },

  /**
   * Parses complete content using column mappings into card candidates
   */
  parseFullContent(
    content: string,
    options: ImportOptions
  ): ParsedCardCandidate[] {
    const delimiter = this.detectDelimiter(content);
    const lines = content.split(/\r?\n/);
    const dataLines = lines.filter((l) => !l.startsWith('#') && l.trim().length > 0);
    const cleanContent = dataLines.join('\n');

    const parsed = Papa.parse<string[]>(cleanContent, {
      delimiter,
      skipEmptyLines: true,
    });

    const rows = parsed.data || [];
    const candidates: ParsedCardCandidate[] = [];

    const startIndex = options.hasHeader ? 1 : 0;
    const mapping = options.columnMapping || { 0: 'Front', 1: 'Back' };

    for (let r = startIndex; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const fields: Record<string, string> = {};
      let tags = '';
      let deckName: string | undefined = undefined;

      for (let c = 0; c < row.length; c++) {
        const mappedTarget = mapping[c];
        if (!mappedTarget || mappedTarget === '__ignore__') continue;

        if (mappedTarget === '__tags__') {
          tags = row[c]?.trim() || '';
        } else if (mappedTarget === '__deck__') {
          deckName = row[c]?.trim() || undefined;
        } else {
          fields[mappedTarget] = row[c] ?? '';
        }
      }

      // If at least one mapped field has content
      if (Object.values(fields).some((v) => v.trim().length > 0)) {
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
