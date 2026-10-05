import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Button } from '../../components/ui';
import { useNoteEditor } from '../../features/notes/useNoteEditor';
import { NoteEditorBody } from '../../features/notes/components/NoteFormParts';

/** Route form of the note editor (deep-linkable via ?noteId=). */
export default function EditNoteScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const editor = useNoteEditor(noteId);

  useEffect(() => {
    if (!noteId) router.back();
  }, [noteId, router]);

  const save = async () => {
    if (await editor.save()) {
      CustomAlert.alert(t('common.done'), t('add_note.success'), [{ text: t('common.close'), onPress: () => router.back() }]);
    }
  };

  return (
    <Screen
      header={
        <Header
          title={t('add_note.edit_title')}
          subtitle={editor.noteTypeName || undefined}
          icon="create"
          iconTone="sky"
          onBack={() => router.back()}
        />
      }
    >
      <NoteEditorBody editor={editor} />
      {!editor.loading && <Button title={t('common.save')} icon="checkmark-circle" size="lg" fullWidth loading={editor.saving} onPress={save} />}
    </Screen>
  );
}
