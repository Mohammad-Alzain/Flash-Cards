import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toneForKey } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Card, Row, AppText, Badge, Button, IconButton, IconTile, BottomSheet, TextField } from '../../components/ui';
import { noteRepository, NoteTypeWithCounts } from '../../core/db/repositories/noteRepository';
import { useFocusData } from '../../hooks/useFocusData';

/** Starting point for a brand-new note type: Front/Back with one card template. */
const BASIC_TEMPLATE = {
  fields: [
    { id: 'f_front', name: 'Front', order: 0, rtl: false },
    { id: 'f_back', name: 'Back', order: 1, rtl: false },
  ],
  templates: [
    {
      id: 't_c1',
      name: 'Card 1',
      order: 0,
      front_html: '<div class="card">{{Front}}</div>',
      back_html: '{{FrontSide}}<hr id="answer"><div class="card">{{Back}}</div>',
    },
  ],
};

export default function NoteTypesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: noteTypes, reload } = useFocusData<NoteTypeWithCounts[]>(() => noteRepository.getAllNoteTypesWithCounts(), [], 'note types');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    try {
      const created = await noteRepository.createNoteType({ name: name.trim(), ...BASIC_TEMPLATE });
      setName('');
      setSheetOpen(false);
      await reload();
      router.push(`/note-types/${created.id}/fields`);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const remove = (nt: NoteTypeWithCounts) => {
    if (nt.notes_count > 0) {
      CustomAlert.alert(t('common.warning'), t('note_types.cannot_delete'));
      return;
    }
    CustomAlert.alert(t('common.delete'), t('note_types.delete_type_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await noteRepository.deleteNoteType(nt.id);
            await reload();
          } catch (err: any) {
            CustomAlert.alert(t('common.error'), err.message);
          }
        },
      },
    ]);
  };

  return (
    <Screen
      decor
      header={
        <Header
          title={t('note_types.title')}
          subtitle={t('note_types.subtitle')}
          icon="shapes"
          iconTone="violet"
          onBack={() => router.back()}
          rightElement={<Button title={t('note_types.gallery_button')} icon="images" variant="ghost" size="sm" onPress={() => router.push('/note-types/gallery')} />}
        />
      }
      overlay={
        <BottomSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={t('note_types.new_type')}
          icon="shapes"
          tone="violet"
          footer={
            <Row gap={10}>
              <Button title={t('common.cancel')} variant="ghost" onPress={() => setSheetOpen(false)} style={{ flex: 1 }} />
              <Button title={t('common.save')} icon="checkmark" disabled={!name.trim()} onPress={create} style={{ flex: 1 }} />
            </Row>
          }
        >
          <TextField label={t('note_types.name_label')} value={name} onChangeText={setName} placeholder={t('note_types.name_placeholder')} icon="text" autoFocus style={{ marginBottom: 0 }} />
        </BottomSheet>
      }
    >
      <Button title={t('note_types.new_type')} icon="add-circle" fullWidth onPress={() => setSheetOpen(true)} style={{ marginBottom: 18 }} />

      {noteTypes.map((nt) => (
        <Card key={nt.id} style={{ marginBottom: 12 }}>
          <Row gap={12}>
            <IconTile icon={nt.is_cloze === 1 ? 'code-slash' : 'document-text'} tone={toneForKey(nt.id)} size={46} variant="solid" />
            <View style={{ flex: 1 }}>
              <AppText variant="h3" numberOfLines={1}>
                {nt.name}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {t('note_types.notes_using', { count: nt.notes_count })}
              </AppText>
            </View>
            {nt.is_cloze === 1 && <Badge size="sm" variant="accent" label={t('note_types.cloze')} />}
          </Row>
          <Row gap={8} style={{ marginTop: 12 }}>
            <Button
              title={t('note_types.fields_button', { count: nt.fields_count })}
              icon="list"
              variant="ghost"
              size="sm"
              onPress={() => router.push(`/note-types/${nt.id}/fields`)}
              style={{ flex: 1 }}
            />
            <Button
              title={t('note_types.templates_button', { count: nt.templates_count })}
              icon="color-palette"
              variant="soft"
              size="sm"
              onPress={() => router.push(`/note-types/${nt.id}/templates`)}
              style={{ flex: 1 }}
            />
            {nt.notes_count === 0 && <IconButton icon="trash" variant="danger" size={38} onPress={() => remove(nt)} accessibilityLabel={t('common.delete')} />}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
