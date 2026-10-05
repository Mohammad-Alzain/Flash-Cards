import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { useDirection } from '../../theme';
import { FieldDef, parseFieldDefs } from './noteFields';

/** Loads an existing note and manages its editable fields, tags and deck. */
export const useNoteEditor = (noteId: string | null | undefined, enabled = true) => {
  const { t } = useTranslation();
  const dir = useDirection();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteTypeId, setNoteTypeId] = useState('');
  const [noteTypeName, setNoteTypeName] = useState('');
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [tags, setTags] = useState('');
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [deckId, setDeckId] = useState('');

  useEffect(() => {
    if (!enabled || !noteId) return;
    let mounted = true;
    setLoading(true);
    Promise.all([noteRepository.getNoteWithDetails(noteId), deckRepository.getAllWithCounts()])
      .then(([details, allDecks]) => {
        if (!mounted) return;
        setDecks(allDecks);
        if (details) {
          setNoteTypeId(details.noteType.id);
          setNoteTypeName(details.noteType.name);
          setFieldDefs(parseFieldDefs(details.noteType.fields_json));
          setFields(details.fields);
          setTags(details.note.tags || '');
          setDeckId(details.deckId || (allDecks[0]?.id ?? ''));
        }
      })
      .catch((e) => {
        console.error('[NoteEditor] Load error:', e);
        CustomAlert.alert(t('common.error'), t('add_note.load_failed'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, noteId]);

  const setField = (name: string, value: string) => setFields((prev) => ({ ...prev, [name]: value }));

  /** Adds a field to the note type; returns true on success. */
  const addField = async (rawName: string) => {
    const name = rawName.trim();
    if (!name || !noteTypeId) return false;
    try {
      const updated = await noteRepository.addFieldToNoteType(noteTypeId, name, dir.rtl);
      setFieldDefs(parseFieldDefs(JSON.stringify(updated)));
      setFields((prev) => ({ ...prev, [name]: '' }));
      CustomAlert.alert(t('common.done'), t('add_note.field_added', { name, type: noteTypeName }));
      return true;
    } catch (e: any) {
      CustomAlert.alert(t('common.warning'), e.message || t('add_note.add_field_failed'));
      return false;
    }
  };

  /** Persists the note; returns the saved values or null on failure. */
  const save = async () => {
    if (!noteId) return null;
    setSaving(true);
    try {
      await noteRepository.updateNote(noteId, { fields, tags: tags.trim(), deckId });
      return { fields, tags: tags.trim() };
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || t('add_note.save_failed'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { loading, saving, noteTypeName, fieldDefs, fields, setField, tags, setTags, decks, deckId, setDeckId, addField, save };
};
