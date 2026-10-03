import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Reconciles note types and notes in the database:
 * 1. Cleans up any seeded note types that had wrapped <div class="card"> in templates.
 * 2. Fixes notes incorrectly linked to nt_basic when custom note types exist matching their fields.
 * 3. Auto-creates clean note types for orphaned notes with unique field signatures.
 */
export async function reconcileNoteTypesAndCards(db: SQLiteDatabase): Promise<void> {
  try {
    // 1. Clean up built-in note types to remove artificial <div class="card"> wrappers
    const seededRows = await db.getAllAsync<{ id: string; templates_json: string }>(
      "SELECT id, templates_json FROM note_types WHERE id IN ('nt_basic', 'nt_basic_reversed', 'nt_cloze');"
    );

    for (const row of seededRows) {
      if (row.templates_json && row.templates_json.includes('<div class="card')) {
        let tmpls = [];
        try {
          tmpls = JSON.parse(row.templates_json);
        } catch {}

        let modified = false;
        for (const t of tmpls) {
          if (t.front_html && t.front_html.includes('<div class="card')) {
            t.front_html = t.front_html
              .replace(/<div class="card front">/gi, '')
              .replace(/<div class="card back">/gi, '')
              .replace(/<\/div>$/gi, '')
              .trim();
            modified = true;
          }
          if (t.back_html && t.back_html.includes('<div class="card')) {
            t.back_html = t.back_html
              .replace(/<div class="card front">/gi, '')
              .replace(/<div class="card back">/gi, '')
              .replace(/<\/div>$/gi, '')
              .trim();
            modified = true;
          }
        }

        if (modified) {
          await db.runAsync(
            'UPDATE note_types SET templates_json = ? WHERE id = ?;',
            JSON.stringify(tmpls),
            row.id
          );
        }
      }
    }

    // 2. Fetch all note types to build field signature map
    const allNoteTypes = await db.getAllAsync<{
      id: string;
      name: string;
      fields_json: string;
      templates_json: string;
      css: string;
    }>('SELECT id, name, fields_json, templates_json, css FROM note_types;');

    if (allNoteTypes.length === 0) return;

    // Build signature -> note_type_id map
    // Signature = comma-separated sorted lowercased field names
    const ntSignatureMap = new Map<string, string>();
    for (const nt of allNoteTypes) {
      if (nt.id === 'nt_basic' || nt.id === 'nt_basic_reversed') continue;
      try {
        const fields = JSON.parse(nt.fields_json || '[]');
        const fieldNames = fields.map((f: any) =>
          typeof f === 'string' ? f.toLowerCase().trim() : (f.name || '').toLowerCase().trim()
        ).sort();
        if (fieldNames.length > 0) {
          const sig = fieldNames.join(':::');
          ntSignatureMap.set(sig, nt.id);
        }
      } catch {}
    }

    // 3. Find notes linked to nt_basic whose fields don't match Front/Back
    const misplacedNotes = await db.getAllAsync<{
      id: string;
      fields_json: string;
      note_type_id: string;
    }>("SELECT id, fields_json, note_type_id FROM notes WHERE note_type_id = 'nt_basic';");

    const orphanedBySig = new Map<string, { keys: string[]; noteIds: string[] }>();

    for (const note of misplacedNotes) {
      let fields: Record<string, string> = {};
      try {
        fields = JSON.parse(note.fields_json || '{}');
      } catch {}

      const keys = Object.keys(fields);
      if (keys.length === 0) continue;

      // If it genuinely has 'Front' and 'Back', it's already correct
      const lowerKeys = keys.map((k) => k.toLowerCase().trim()).sort();
      const isGenuineBasic =
        (lowerKeys.length === 2 && lowerKeys[0] === 'back' && lowerKeys[1] === 'front') ||
        (lowerKeys.length === 1 && (lowerKeys[0] === 'front' || lowerKeys[0] === 'back'));

      if (isGenuineBasic) continue;

      const sig = lowerKeys.join(':::');
      if (ntSignatureMap.has(sig)) {
        // Direct match with an existing custom note type from APKG!
        const matchedNtId = ntSignatureMap.get(sig)!;
        await db.runAsync('UPDATE notes SET note_type_id = ? WHERE id = ?;', matchedNtId, note.id);
      } else {
        // Collect for auto-recovery
        if (!orphanedBySig.has(sig)) {
          orphanedBySig.set(sig, { keys, noteIds: [] });
        }
        orphanedBySig.get(sig)!.noteIds.push(note.id);
      }
    }

    // 4. Auto-create note types for orphaned notes that have no matching note type
    for (const [sig, info] of orphanedBySig.entries()) {
      if (info.noteIds.length === 0) continue;

      const firstKey = info.keys[0];
      const secondKey = info.keys[1] || info.keys[0];
      const otherKeys = info.keys.slice(2);

      let frontHtml = `{{${firstKey}}}`;
      let backHtml = `{{FrontSide}}\n<hr id="answer">\n{{${secondKey}}}`;
      for (const k of otherKeys) {
        backHtml += `\n<div class="field-extra">{{${k}}}</div>`;
      }

      const newNtId = `nt_recovered_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newName = `Custom (${info.keys[0]})`;
      const formattedFields = info.keys.map((k, idx) => ({ id: `fld_${idx}`, name: k, ord: idx }));
      const formattedTemplates = [
        {
          id: `tmpl_0`,
          name: 'Card 1',
          ord: 0,
          front_html: frontHtml,
          back_html: backHtml,
          qfmt: frontHtml,
          afmt: backHtml,
        },
      ];
      const defaultCss = `.card { font-size: 20px; text-align: center; } .field-extra { margin-top: 12px; font-size: 0.9em; }`;

      await db.runAsync(
        `INSERT INTO note_types (id, name, fields_json, templates_json, css, is_cloze, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?);`,
        newNtId,
        newName,
        JSON.stringify(formattedFields),
        JSON.stringify(formattedTemplates),
        defaultCss,
        Date.now()
      );

      // Re-link all notes with this signature
      const placeholders = info.noteIds.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE notes SET note_type_id = ? WHERE id IN (${placeholders});`,
        newNtId,
        ...info.noteIds
      );
    }
  } catch (err) {
    console.warn('[Reconcile] Note type reconciliation warning:', err);
  }
}
