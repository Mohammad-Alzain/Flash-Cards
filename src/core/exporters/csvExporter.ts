import { NoteExportData, ExportOptions } from './types';

/**
 * Escapes a cell value according to RFC 4180 standards for CSV/TSV.
 */
function escapeCell(val: string | undefined | null, delimiter: string): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  const needsQuotes = str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r');
  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports notes to CSV or TSV string with UTF-8 BOM for proper Arabic/Unicode display in Excel.
 */
export function exportToDelimitedText(
  notes: NoteExportData[],
  options: ExportOptions = {}
): string {
  const isTsv = options.delimiter === '\t';
  const delimiter = options.delimiter || (isTsv ? '\t' : ',');
  const sepWord = isTsv ? 'tab' : 'comma';

  const lines: string[] = [];

  // UTF-8 BOM to prevent garbled Arabic in Excel
  const BOM = '\uFEFF';

  // Anki-compatible headers
  lines.push(`#separator:${sepWord}`);
  lines.push('#html:true');

  if (notes.length === 0) {
    return BOM + lines.join('\n');
  }

  // Collect all unique field names across notes
  const fieldSet = new Set<string>();
  for (const note of notes) {
    for (const f of note.fieldNames) {
      fieldSet.add(f);
    }
  }
  const allFieldNames = Array.from(fieldSet);

  // Headers: Fields..., Tags, Deck
  const headerCols = [...allFieldNames, 'Tags', 'Deck'];
  if (options.includeScheduling) {
    headerCols.push('CardCount', 'IntervalDays', 'Reps', 'State');
  }

  lines.push(headerCols.map(c => escapeCell(c, delimiter)).join(delimiter));

  for (const note of notes) {
    const row: string[] = [];

    // Add field values
    for (const fName of allFieldNames) {
      row.push(escapeCell(note.fields[fName] || '', delimiter));
    }

    // Add tags
    const tagsStr = note.tags.join(' ');
    row.push(escapeCell(tagsStr, delimiter));

    // Add deck name
    row.push(escapeCell(note.deckName, delimiter));

    if (options.includeScheduling) {
      const card = note.cards[0];
      row.push(escapeCell(String(note.cards.length), delimiter));
      row.push(escapeCell(card ? String(card.intervalDays) : '0', delimiter));
      row.push(escapeCell(card ? String(card.reps) : '0', delimiter));
      row.push(escapeCell(card ? String(card.state) : '0', delimiter));
    }

    lines.push(row.join(delimiter));
  }

  return BOM + lines.join('\n');
}
