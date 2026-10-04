import { getDatabase, withDatabaseLock, withDatabaseRead } from '../connection';
import {
  Note,
  NoteType,
  NoteTypeVersion,
  Card,
  CardState,
  CardTemplateDef,
  NoteFieldDef,
} from '../../types/models';

export interface NoteTypeWithCounts extends NoteType {
  notes_count: number;
  fields_count: number;
  templates_count: number;
}

export const noteRepository = {
  async getAllNoteTypes(): Promise<NoteType[]> {
    return await withDatabaseRead(async (db) => {
      return await db.getAllAsync<NoteType>('SELECT * FROM note_types ORDER BY name ASC;');
    });
  },

  async getAllNoteTypesWithCounts(): Promise<NoteTypeWithCounts[]> {
    return await withDatabaseRead(async (db) => {
      const rows = await db.getAllAsync<any>(`
        SELECT 
          nt.*,
          COUNT(n.id) as notes_count
        FROM note_types nt
        LEFT JOIN notes n ON n.note_type_id = nt.id
        GROUP BY nt.id
        ORDER BY nt.name ASC;
      `);

      return rows.map((r) => {
        let fCount = 0;
        let tCount = 0;
        try {
          fCount = JSON.parse(r.fields_json || '[]').length;
        } catch (e) {}
        try {
          tCount = JSON.parse(r.templates_json || '[]').length;
        } catch (e) {}

        return {
          ...r,
          notes_count: Number(r.notes_count || 0),
          fields_count: fCount,
          templates_count: tCount,
        };
      });
    });
  },

  async getNoteTypeById(id: string): Promise<NoteType | null> {
    return await withDatabaseRead(async (db) => {
      const row = await db.getFirstAsync<NoteType>('SELECT * FROM note_types WHERE id = ?;', id);
      return row || null;
    });
  },

  async createNoteType(params: {
    name: string;
    fields: NoteFieldDef[];
    templates: CardTemplateDef[];
    css?: string;
    isCloze?: boolean;
  }): Promise<NoteType> {
    return await withDatabaseLock(async (db) => {
      const id = `nt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = Date.now();
      const defaultCss = params.css || '.card { font-size: 20px; text-align: center; }';

      await db.runAsync(
        `INSERT INTO note_types (id, name, fields_json, templates_json, css, is_cloze, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        id,
        params.name,
        JSON.stringify(params.fields),
        JSON.stringify(params.templates),
        defaultCss,
        params.isCloze ? 1 : 0,
        now
      );

      return {
        id,
        name: params.name,
        fields_json: JSON.stringify(params.fields),
        templates_json: JSON.stringify(params.templates),
        css: defaultCss,
        is_cloze: params.isCloze ? 1 : 0,
        created_at: now,
      };
    });
  },

  async updateNoteType(
    id: string,
    updates: {
      name?: string;
      fields?: NoteFieldDef[];
      templates?: CardTemplateDef[];
      css?: string;
    }
  ): Promise<void> {
    return await withDatabaseLock(async (db) => {
      const current = await db.getFirstAsync<NoteType>('SELECT * FROM note_types WHERE id = ?;', id);
      if (!current) throw new Error('Note type not found');

      // 1. Save version snapshot before update
      const versionId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await db.runAsync(
        `INSERT INTO note_type_versions (id, note_type_id, snapshot_json, saved_at)
         VALUES (?, ?, ?, ?);`,
        versionId,
        id,
        JSON.stringify(current),
        Date.now()
      );

      // Keep only last 10 versions
      await db.runAsync(
        `DELETE FROM note_type_versions 
         WHERE note_type_id = ? AND id NOT IN (
           SELECT id FROM note_type_versions 
           WHERE note_type_id = ? 
           ORDER BY saved_at DESC LIMIT 10
         );`,
        id,
        id
      );

      // 2. Perform updates
      const sets: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        sets.push('name = ?');
        values.push(updates.name);
      }
      if (updates.fields !== undefined) {
        sets.push('fields_json = ?');
        values.push(JSON.stringify(updates.fields));

        // Migrate existing notes so they contain all field keys
        try {
          const existingNotes = await db.getAllAsync<{ id: string; fields_json: string }>(
            'SELECT id, fields_json FROM notes WHERE note_type_id = ?;',
            id
          );
          for (const n of existingNotes) {
            try {
              const parsed = JSON.parse(n.fields_json || '{}');
              let modified = false;
              for (const f of updates.fields) {
                if (parsed[f.name] === undefined) {
                  parsed[f.name] = '';
                  modified = true;
                }
              }
              if (modified) {
                await db.runAsync(
                  'UPDATE notes SET fields_json = ? WHERE id = ?;',
                  JSON.stringify(parsed),
                  n.id
                );
              }
            } catch (e) {}
          }
        } catch (err) {
          console.warn('Failed to migrate existing notes on fields update:', err);
        }
      }
      if (updates.templates !== undefined) {
        sets.push('templates_json = ?');
        values.push(JSON.stringify(updates.templates));
      }
      if (updates.css !== undefined) {
        sets.push('css = ?');
        values.push(updates.css);
      }

      if (sets.length > 0) {
        values.push(id);
        await db.runAsync(`UPDATE note_types SET ${sets.join(', ')} WHERE id = ?;`, ...values);
      }
    });
  },

  async addFieldToNoteType(
    noteTypeId: string,
    fieldName: string,
    rtl: boolean = false
  ): Promise<NoteFieldDef[]> {
    return await withDatabaseLock(async (db) => {
      const current = await db.getFirstAsync<NoteType>('SELECT * FROM note_types WHERE id = ?;', noteTypeId);
      if (!current) throw new Error('Note type not found');

      let fields: NoteFieldDef[] = [];
      try {
        fields = JSON.parse(current.fields_json || '[]');
      } catch {
        fields = [];
      }

      const trimmedName = fieldName.trim();
      if (!trimmedName) throw new Error('Field name cannot be empty');

      if (fields.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase())) {
        throw new Error(`Field "${trimmedName}" already exists`);
      }

      const newField: NoteFieldDef = {
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmedName,
        order: fields.length,
        rtl,
        sticky: false,
      };

      const updatedFields = [...fields, newField];

      // Update note type
      await this.updateNoteType(noteTypeId, {
        fields: updatedFields,
      });

      // Update all existing notes of this note_type to include the new field key with empty string
      try {
        const existingNotes = await db.getAllAsync<{ id: string; fields_json: string }>(
          'SELECT id, fields_json FROM notes WHERE note_type_id = ?;',
          noteTypeId
        );

        for (const n of existingNotes) {
          try {
            const parsed = JSON.parse(n.fields_json || '{}');
            if (parsed[trimmedName] === undefined) {
              parsed[trimmedName] = '';
              await db.runAsync(
                'UPDATE notes SET fields_json = ? WHERE id = ?;',
                JSON.stringify(parsed),
                n.id
              );
            }
          } catch (err) {
            // ignore corrupted note
          }
        }
      } catch (e) {
        console.warn('[NoteRepo] Could not migrate existing notes for new field:', e);
      }

      return updatedFields;
    });
  },

  async getVersions(noteTypeId: string): Promise<NoteTypeVersion[]> {
    return await withDatabaseRead(async (db) => {
      return await db.getAllAsync<NoteTypeVersion>(
        'SELECT * FROM note_type_versions WHERE note_type_id = ? ORDER BY saved_at DESC LIMIT 10;',
        noteTypeId
      );
    });
  },

  async restoreVersion(versionId: string): Promise<void> {
    return await withDatabaseLock(async (db) => {
      const versionRow = await db.getFirstAsync<NoteTypeVersion>(
        'SELECT * FROM note_type_versions WHERE id = ?;',
        versionId
      );
      if (!versionRow) throw new Error('Version not found');

      const snapshot: NoteType = JSON.parse(versionRow.snapshot_json);
      await db.runAsync(
        `UPDATE note_types 
         SET name = ?, fields_json = ?, templates_json = ?, css = ?, is_cloze = ?
         WHERE id = ?;`,
        snapshot.name,
        snapshot.fields_json,
        snapshot.templates_json,
        snapshot.css,
        snapshot.is_cloze,
        snapshot.id
      );
    });
  },

  async deleteNoteType(id: string): Promise<void> {
    return await withDatabaseLock(async (db) => {
      // Verify notes count first
      const countRow = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM notes WHERE note_type_id = ?;',
        id
      );
      if (Number(countRow?.count || 0) > 0) {
        throw new Error(`Cannot delete note type used by ${countRow?.count} notes.`);
      }

      await db.runAsync('DELETE FROM note_types WHERE id = ?;', id);
    });
  },

  async createNoteWithCards(params: {
    deckId: string;
    noteTypeId: string;
    fields: Record<string, string>;
    tags?: string;
  }): Promise<{ noteId: string; cardCount: number }> {
    return await withDatabaseLock(async (db) => {
      const now = Date.now();
      const noteId = `note_${now}_${Math.random().toString(36).substring(2, 7)}`;
      const guid = `guid_${now}_${Math.random().toString(36).substring(2, 9)}`;

      // Sort field is first non-empty field value
      const firstFieldKey = Object.keys(params.fields)[0] || '';
      const sortField = params.fields[firstFieldKey] || '';

      // Get note type to inspect templates
      const noteType = await db.getFirstAsync<NoteType>('SELECT * FROM note_types WHERE id = ?;', params.noteTypeId);
      if (!noteType) {
        throw new Error(`Note type ${params.noteTypeId} not found`);
      }

      const templates: CardTemplateDef[] = JSON.parse(noteType.templates_json || '[]');

      // Insert Note
      await db.runAsync(
        `INSERT INTO notes (id, guid, note_type_id, fields_json, tags, sort_field, checksum, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?);`,
        noteId,
        guid,
        params.noteTypeId,
        JSON.stringify(params.fields),
        params.tags || '',
        sortField,
        now,
        now
      );

      // Create cards for each template
      let cardCount = 0;
      for (let ord = 0; ord < templates.length; ord++) {
        const template = templates[ord];
        const targetDeckId = template.deck_override_id || params.deckId;
        const cardId = `card_${now}_${ord}_${Math.random().toString(36).substring(2, 7)}`;

        await db.runAsync(
          `INSERT INTO cards (
             id, note_id, deck_id, template_ord, state, due, stability, difficulty,
             elapsed_days, scheduled_days, reps, lapses, ease_factor, interval_days,
             last_review, suspended, buried_until, flag, bookmarked, created_at, updated_at
           ) VALUES (
             ?, ?, ?, ?, 0, ?, 0, 0,
             0, 0, 0, 0, 2.5, 0,
             NULL, 0, NULL, 0, 0, ?, ?
           );`,
          cardId,
          noteId,
          targetDeckId,
          ord,
          now, // Due now as new card
          now,
          now
        );
        cardCount++;
      }

      return { noteId, cardCount };
    });
  },

  async getNoteById(id: string): Promise<Note | null> {
    return await withDatabaseRead(async (db) => {
      const row = await db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?;', id);
      return row || null;
    });
  },

  async getNoteWithDetails(noteId: string): Promise<{
    note: Note;
    noteType: NoteType;
    fields: Record<string, string>;
    deckId: string;
    deckName: string;
  } | null> {
    return await withDatabaseRead(async (db) => {
      const note = await db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?;', noteId);
      if (!note) return null;

      const noteType = await db.getFirstAsync<NoteType>('SELECT * FROM note_types WHERE id = ?;', note.note_type_id);
      if (!noteType) return null;

      // Get current deck of the note from one of its cards
      const cardRow = await db.getFirstAsync<{ deck_id: string; deck_name: string }>(
        `SELECT c.deck_id, d.name as deck_name 
         FROM cards c 
         LEFT JOIN decks d ON d.id = c.deck_id 
         WHERE c.note_id = ? 
         LIMIT 1;`,
        noteId
      );

      let parsedFields: Record<string, string> = {};
      try {
        parsedFields = JSON.parse(note.fields_json || '{}');
      } catch {}

      return {
        note,
        noteType,
        fields: parsedFields,
        deckId: cardRow?.deck_id || '',
        deckName: cardRow?.deck_name || 'Default',
      };
    });
  },

  async updateNote(
    id: string,
    updates: {
      fields?: Record<string, string>;
      tags?: string;
      deckId?: string;
    }
  ): Promise<void> {
    return await withDatabaseLock(async (db) => {
      const now = Date.now();

      const note = await db.getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?;', id);
      if (!note) throw new Error('Note not found');

      const sets: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (updates.fields !== undefined) {
        sets.push('fields_json = ?');
        values.push(JSON.stringify(updates.fields));

        const firstVal = Object.values(updates.fields)[0] || '';
        sets.push('sort_field = ?');
        values.push(firstVal);
      }

      if (updates.tags !== undefined) {
        sets.push('tags = ?');
        values.push(updates.tags);
      }

      values.push(id);
      await db.runAsync(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?;`, ...values);

      // If deck changed, update all cards belonging to this note
      if (updates.deckId) {
        await db.runAsync(
          'UPDATE cards SET deck_id = ?, updated_at = ? WHERE note_id = ?;',
          updates.deckId,
          now,
          id
        );
      }
    });
  },

  async getTotalCount(): Promise<number> {
    return await withDatabaseRead(async (db) => {
      const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM notes;');
      return Number(row?.count || 0);
    });
  },
};
