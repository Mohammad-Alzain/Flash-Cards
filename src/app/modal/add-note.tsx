import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, TextField, Button, Badge, ChipPicker, FormSection } from '../../components/ui';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { NoteType } from '../../core/types/models';
import { FieldDef, parseFieldDefs } from '../../features/notes/noteFields';
import { NoteFieldInput } from '../../features/notes/components/NoteFormParts';

export default function AddNoteModal() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();

  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [deckId, setDeckId] = useState<string>(params.deckId || '');
  const [noteTypeId, setNoteTypeId] = useState<string>('');
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [firstFieldError, setFirstFieldError] = useState('');

  // Decks + note types; preselect the requested deck when it exists.
  useEffect(() => {
    Promise.all([deckRepository.getAllWithCounts(), noteRepository.getAllNoteTypes()]).then(([d, nt]) => {
      setDecks(d);
      setNoteTypes(nt);
      setDeckId(params.deckId && d.some((x) => x.id === params.deckId) ? params.deckId : d[0]?.id ?? '');
      if (nt.length > 0) setNoteTypeId(nt[0].id);
    });
  }, [params.deckId]);

  // Default to the note type the selected deck already uses.
  useEffect(() => {
    if (!deckId) return;
    let mounted = true;
    deckRepository
      .getNoteTypeIdUsedInDeck(deckId)
      .then((id) => {
        if (mounted && id) setNoteTypeId(id);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [deckId]);

  // Fields follow the selected note type.
  useEffect(() => {
    if (!noteTypeId) return;
    setFieldDefs(parseFieldDefs(noteTypes.find((nt) => nt.id === noteTypeId)?.fields_json));
  }, [noteTypeId, noteTypes]);

  const firstField = fieldDefs[0]?.name || 'Front';

  const setField = (name: string, text: string) => {
    setValues((prev) => ({ ...prev, [name]: text }));
    if (name === firstField && text.trim()) setFirstFieldError('');
  };

  const save = async () => {
    if (!values[firstField]?.trim()) {
      setFirstFieldError(t('add_note.error_empty'));
      return;
    }
    setFirstFieldError('');
    if (!deckId || !noteTypeId) {
      CustomAlert.alert(t('common.error'), t('add_note.select_deck_type'));
      return;
    }
    setSaving(true);
    try {
      await noteRepository.createNoteWithCards({ deckId, noteTypeId, fields: values, tags: tags.trim() });
      CustomAlert.alert(t('common.done'), t('add_note.success'), [
        { text: t('common.close'), onPress: () => router.back() },
        {
          text: t('add_note.add_another'),
          onPress: () => {
            setValues({});
            setFirstFieldError('');
          },
        },
      ]);
    } catch (err: any) {
      CustomAlert.alert(t('common.error'), err.message || t('add_note.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const deckName = decks.find((d) => d.id === deckId)?.name;
  const typeName = noteTypes.find((nt) => nt.id === noteTypeId)?.name;

  return (
    <Screen
      decor
      header={<Header title={t('add_note.title')} subtitle={t('add_note.subtitle')} icon="add-circle" iconTone="green" onBack={() => router.back()} />}
    >
      <FormSection icon="albums" tone="violet" title={t('add_note.deck')} trailing={deckName ? <Badge size="sm" variant="primary" label={deckName} /> : undefined}>
        <ChipPicker items={decks} selectedId={deckId} onSelect={setDeckId} getId={(d) => d.id} getLabel={(d) => d.name} />
      </FormSection>

      {noteTypes.length > 1 && (
        <FormSection icon="shapes" tone="amber" title={t('add_note.card_type')} trailing={typeName ? <Badge size="sm" label={typeName} /> : undefined}>
          <ChipPicker items={noteTypes} selectedId={noteTypeId} onSelect={setNoteTypeId} getId={(n) => n.id} getLabel={(n) => n.name} />
        </FormSection>
      )}

      <FormSection icon="document-text" tone="sky" title={t('add_note.fields_title')}>
        {fieldDefs.map((def, idx) => (
          <NoteFieldInput
            key={def.id || def.name}
            def={def}
            value={values[def.name] || ''}
            onChange={(txt) => setField(def.name, txt)}
            lines={idx === 0 ? 3 : 4}
            error={idx === 0 ? firstFieldError : undefined}
          />
        ))}
      </FormSection>

      <FormSection icon="pricetags" tone="green" title={t('add_note.tags')}>
        <TextField value={tags} onChangeText={setTags} placeholder={t('add_note.tags_placeholder')} icon="pricetag" style={{ marginBottom: 0 }} />
      </FormSection>

      <Button title={t('add_note.save_button')} icon="add-circle" size="lg" fullWidth loading={saving} onPress={save} style={{ marginTop: 4 }} />
    </Screen>
  );
}
