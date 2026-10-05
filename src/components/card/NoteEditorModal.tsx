import React from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Header, IconButton, Button } from '../ui';
import { useNoteEditor } from '../../features/notes/useNoteEditor';
import { NoteEditorBody } from '../../features/notes/components/NoteFormParts';

interface NoteEditorModalProps {
  visible: boolean;
  noteId: string | null;
  onClose: () => void;
  onSaved?: (updatedFields: Record<string, string>, updatedTags: string) => void;
}

/** Full-screen sheet for editing a note from anywhere (study, browser, deck). */
export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({ visible, noteId, onClose, onSaved }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const editor = useNoteEditor(noteId, visible);

  const save = async () => {
    const result = await editor.save();
    if (!result) return;
    onSaved?.(result.fields, result.tags);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        <Header
          title={t('add_note.edit_title')}
          subtitle={editor.noteTypeName || undefined}
          icon="create"
          iconTone="sky"
          rightElement={
            <>
              <IconButton icon="close" variant="ghost" onPress={onClose} accessibilityLabel={t('common.close')} />
              <Button title={t('common.save')} icon="checkmark" size="sm" loading={editor.saving} onPress={save} />
            </>
          }
        />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <NoteEditorBody editor={editor} />
          {!editor.loading && (
            <>
              <Button title={t('common.save')} icon="checkmark-circle" size="lg" fullWidth loading={editor.saving} onPress={save} style={{ marginBottom: 10 }} />
              <Button title={t('common.cancel')} variant="ghost" fullWidth onPress={onClose} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
