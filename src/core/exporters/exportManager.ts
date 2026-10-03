import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../db/connection';
import { ExportFormat, ExportOptions, ExportResult, NoteExportData } from './types';
import { exportToDelimitedText } from './csvExporter';
import { exportToXlsxBase64 } from './xlsxExporter';
import { exportToApkg } from './apkgExporter';

export class ExportManager {
  /**
   * Fetches note export data structured for tabular export (CSV, TSV, XLSX).
   */
  static async fetchExportNotes(deckId?: string): Promise<NoteExportData[]> {
    const db = await getDatabase();

    let query = `
      SELECT 
        n.id, n.guid, n.fields_json, n.tags,
        d.id as deck_id, d.name as deck_name,
        nt.name as note_type_name, nt.fields_json as nt_fields_json,
        c.id as card_id, c.template_ord, c.state, c.due, c.stability,
        c.difficulty, c.elapsed_days, c.scheduled_days, c.reps, c.lapses,
        c.ease_factor, c.interval_days, c.last_review, c.suspended, c.flag
      FROM notes n
      JOIN cards c ON n.id = c.note_id
      JOIN decks d ON c.deck_id = d.id
      JOIN note_types nt ON n.note_type_id = nt.id
    `;
    const params: any[] = [];
    if (deckId) {
      query += ` WHERE d.id = ?`;
      params.push(deckId);
    }
    query += ` ORDER BY d.name, n.created_at ASC`;

    const rows = await db.getAllAsync<any>(query, params);

    const notesMap = new Map<string, NoteExportData>();

    for (const r of rows) {
      if (!notesMap.has(r.id)) {
        let fields: Record<string, string> = {};
        try {
          fields = JSON.parse(r.fields_json);
        } catch {}

        let ntFields: any[] = [];
        try {
          ntFields = JSON.parse(r.nt_fields_json);
        } catch {}

        const fieldNames = ntFields.length > 0 
          ? ntFields.map((f: any) => f.name)
          : Object.keys(fields);

        const tagsList = (r.tags || '')
          .split(' ')
          .map((t: string) => t.trim())
          .filter(Boolean);

        notesMap.set(r.id, {
          id: r.id,
          guid: r.guid,
          deckName: r.deck_name,
          deckId: r.deck_id,
          noteTypeName: r.note_type_name,
          fields,
          fieldNames,
          tags: tagsList,
          cards: [],
        });
      }

      notesMap.get(r.id)!.cards.push({
        id: r.card_id,
        templateOrd: r.template_ord,
        state: r.state,
        due: r.due,
        stability: r.stability,
        difficulty: r.difficulty,
        elapsedDays: r.elapsed_days,
        scheduledDays: r.scheduled_days,
        reps: r.reps,
        lapses: r.lapses,
        easeFactor: r.ease_factor,
        intervalDays: r.interval_days,
        lastReview: r.last_review,
        suspended: r.suspended === 1,
        flag: r.flag,
      });
    }

    return Array.from(notesMap.values());
  }

  /**
   * Main export execution entry point.
   */
  static async export(
    format: ExportFormat,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    if (format === 'apkg') {
      return await exportToApkg(options);
    }

    const notes = await this.fetchExportNotes(options.deckId);
    if (notes.length === 0) {
      throw new Error('No notes found to export');
    }

    const outDir = `${FileSystem.cacheDirectory}exports/`;
    const dirInfo = await FileSystem.getInfoAsync(outDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(outDir, { intermediates: true });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const deckNamePrefix = options.deckId && notes[0] ? notes[0].deckName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_') : 'Collection';

    let fileName = '';
    let filePath = '';

    if (format === 'csv') {
      fileName = `${deckNamePrefix}_${timestamp}.csv`;
      filePath = `${outDir}${fileName}`;
      const content = exportToDelimitedText(notes, { ...options, delimiter: ',' });
      await FileSystem.writeAsStringAsync(filePath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else if (format === 'tsv') {
      fileName = `${deckNamePrefix}_${timestamp}.txt`;
      filePath = `${outDir}${fileName}`;
      const content = exportToDelimitedText(notes, { ...options, delimiter: '\t' });
      await FileSystem.writeAsStringAsync(filePath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else if (format === 'xlsx') {
      fileName = `${deckNamePrefix}_${timestamp}.xlsx`;
      filePath = `${outDir}${fileName}`;
      const base64 = exportToXlsxBase64(notes, options);
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const totalCards = notes.reduce((sum, n) => sum + n.cards.length, 0);
    const outInfo = await FileSystem.getInfoAsync(filePath);

    return {
      filePath,
      fileName,
      cardCount: totalCards,
      noteCount: notes.length,
      mediaCount: 0,
      sizeBytes: outInfo.exists && 'size' in outInfo ? outInfo.size || 0 : 0,
    };
  }

  /**
   * Triggers native sharing sheet to save or send file.
   */
  static async share(filePath: string, mimeType?: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Native file sharing is not available on this device');
    }
    await Sharing.shareAsync(filePath, {
      mimeType,
      dialogTitle: 'Export Flashcards',
      UTI: mimeType,
    });
  }
}
