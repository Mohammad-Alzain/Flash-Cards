import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { AppText, Row, TextField, Button, ChipPicker, FormSection } from '../../../components/ui';
import { CustomAlert } from '../../../components/common/CustomDialog';
import { audioService } from '../../../core/audio/audioService';
import { firstSoundFile, FieldDef } from '../noteFields';
import type { useNoteEditor } from '../useNoteEditor';

interface FieldInputProps {
  def: FieldDef;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  lines?: number;
}

/** A note field with an inline "play audio" action when it holds a [sound:] tag. */
export const NoteFieldInput: React.FC<FieldInputProps> = ({ def, value, onChange, error, lines = 3 }) => {
  const { t } = useTranslation();
  const sound = firstSoundFile(value);
  return (
    <View style={{ marginBottom: 4 }}>
      <Row justify="space-between" style={{ marginBottom: 6, paddingHorizontal: 4 }}>
        <AppText variant="bodySm" weight="extrabold" color="primary">
          {def.name}
        </AppText>
        {value.includes('[sound:') && (
          <Button
            title={t('add_note.play_audio')}
            icon="volume-high"
            variant="soft"
            size="sm"
            onPress={() => (sound ? audioService.play(sound) : CustomAlert.alert(t('add_note.play_audio'), t('add_note.no_sound')))}
          />
        )}
      </Row>
      <TextField
        value={value}
        onChangeText={onChange}
        placeholder={t('add_note.field_placeholder', { name: def.name })}
        multiline
        numberOfLines={lines}
        error={error}
      />
    </View>
  );
};

/** Inline form for adding a field to the note type. */
const AddFieldInline: React.FC<{ typeName: string; onAdd: (name: string) => Promise<boolean> }> = ({ typeName, onAdd }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button title={t('add_note.add_field', { type: typeName })} icon="add-circle" variant="outline" onPress={() => setOpen(true)} style={{ marginBottom: 14 }} />
    );
  }
  return (
    <FormSection icon="add-circle" tone="teal" title={t('add_note.add_field_title', { type: typeName })}>
      <TextField value={name} onChangeText={setName} placeholder={t('add_note.add_field_placeholder')} autoFocus />
      <Row gap={10}>
        <Button
          title={t('common.cancel')}
          variant="ghost"
          size="sm"
          onPress={() => {
            setOpen(false);
            setName('');
          }}
          style={{ flex: 1 }}
        />
        <Button
          title={t('add_note.add_field_button')}
          size="sm"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            const ok = await onAdd(name);
            setBusy(false);
            if (ok) {
              setOpen(false);
              setName('');
            }
          }}
          style={{ flex: 1 }}
        />
      </Row>
    </FormSection>
  );
};

/** Full editing body for an existing note: deck · fields · add field · tags. */
export const NoteEditorBody: React.FC<{ editor: ReturnType<typeof useNoteEditor> }> = ({ editor }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (editor.loading) {
    return (
      <View style={{ paddingVertical: 60, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return (
    <>
      <FormSection icon="albums" tone="violet" title={t('add_note.deck')}>
        <ChipPicker items={editor.decks} selectedId={editor.deckId} onSelect={editor.setDeckId} getId={(d) => d.id} getLabel={(d) => d.name} />
      </FormSection>
      <FormSection icon="document-text" tone="sky" title={t('add_note.fields_title')}>
        {editor.fieldDefs.map((def) => (
          <NoteFieldInput key={def.id || def.name} def={def} value={editor.fields[def.name] || ''} onChange={(v) => editor.setField(def.name, v)} />
        ))}
      </FormSection>
      <AddFieldInline typeName={editor.noteTypeName} onAdd={editor.addField} />
      <FormSection icon="pricetags" tone="green" title={t('add_note.tags')}>
        <TextField value={editor.tags} onChangeText={editor.setTags} placeholder={t('add_note.tags_placeholder')} icon="pricetag" style={{ marginBottom: 0 }} />
      </FormSection>
    </>
  );
};
