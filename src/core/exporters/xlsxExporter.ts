import * as XLSX from 'xlsx';
import { NoteExportData, ExportOptions } from './types';

/**
 * Exports notes to an Excel (.xlsx) file formatted as Base64 string.
 */
export function exportToXlsxBase64(
  notes: NoteExportData[],
  options: ExportOptions = {}
): string {
  const wb = XLSX.utils.book_new();

  // Collect all unique field names
  const fieldSet = new Set<string>();
  for (const note of notes) {
    for (const f of note.fieldNames) {
      fieldSet.add(f);
    }
  }
  const allFieldNames = Array.from(fieldSet);

  // Group notes by deck or single sheet
  const deckMap = new Map<string, NoteExportData[]>();
  for (const n of notes) {
    const deck = n.deckName || 'Default';
    if (!deckMap.has(deck)) {
      deckMap.set(deck, []);
    }
    deckMap.get(deck)!.push(n);
  }

  for (const [deckName, deckNotes] of deckMap.entries()) {
    const rows: (string | number)[][] = [];

    // Header row
    const headers = [...allFieldNames, 'Tags', 'Deck'];
    if (options.includeScheduling) {
      headers.push('State', 'Interval Days', 'Reps', 'Ease Factor');
    }
    rows.push(headers);

    for (const note of deckNotes) {
      const row: (string | number)[] = [];
      for (const fn of allFieldNames) {
        row.push(note.fields[fn] || '');
      }
      row.push(note.tags.join(' '));
      row.push(note.deckName);

      if (options.includeScheduling) {
        const card = note.cards[0];
        row.push(card ? card.state : 0);
        row.push(card ? card.intervalDays : 0);
        row.push(card ? card.reps : 0);
        row.push(card ? card.easeFactor : 2.5);
      }

      rows.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 22 }));

    // Clean sheet name (Excel limits sheet names to 31 chars and no / \ ? * : [ ])
    const safeSheetName = deckName.replace(/[\\/?*:[\]]/g, '_').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Cards');
  }

  // If no notes, create empty sheet
  if (deckMap.size === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['Front', 'Back', 'Tags', 'Deck']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Cards');
  }

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  return base64;
}
