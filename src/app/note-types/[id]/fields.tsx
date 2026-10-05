import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection } from '../../../theme';
import { CustomAlert } from '../../../components/common/CustomDialog';
import { Screen, Header, Card, Row, AppText, Button, IconButton, TextField, ListItem, IconTile } from '../../../components/ui';
import { noteRepository } from '../../../core/db/repositories/noteRepository';
import { NoteType, NoteFieldDef } from '../../../core/types/models';

/** Re-numbers `order` after a structural change. */
const renumber = (list: NoteFieldDef[]) => list.map((f, idx) => ({ ...f, order: idx }));

export default function FieldsEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const dir = useDirection();
  const { t } = useTranslation();
  const router = useRouter();
  const [noteType, setNoteType] = useState<NoteType | null>(null);
  const [fields, setFields] = useState<NoteFieldDef[]>([]);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    noteRepository.getNoteTypeById(id).then((nt) => {
      if (!nt) return;
      setNoteType(nt);
      try {
        setFields(JSON.parse(nt.fields_json || '[]'));
      } catch {
        setFields([]);
      }
    });
  }, [id]);

  const addField = () => {
    const name = newName.trim();
    if (!name) return;
    if (fields.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      CustomAlert.alert(t('common.warning'), t('note_types.field_exists'));
      return;
    }
    setFields([
      ...fields,
      { id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, name, order: fields.length, rtl: dir.rtl, sticky: false },
    ]);
    setNewName('');
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(renumber(next));
  };

  const toggleRtl = (index: number) => setFields(fields.map((f, i) => (i === index ? { ...f, rtl: !f.rtl } : f)));

  const remove = (index: number) => {
    if (fields.length <= 1) {
      CustomAlert.alert(t('common.error'), t('note_types.min_one_field'));
      return;
    }
    CustomAlert.alert(t('common.delete'), t('note_types.delete_field_msg', { name: fields[index].name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => setFields(renumber(fields.filter((_, i) => i !== index))) },
    ]);
  };

  const save = async () => {
    if (!noteType) return;
    setSaving(true);
    try {
      await noteRepository.updateNoteType(noteType.id, { fields });
      CustomAlert.alert(t('common.done'), t('note_types.fields_saved'));
      router.back();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      decor
      header={
        <Header
          title={t('note_types.fields_title')}
          subtitle={noteType?.name}
          icon="list"
          iconTone="sky"
          onBack={() => router.back()}
          rightElement={<Button title={t('common.save')} icon="checkmark" size="sm" loading={saving} onPress={save} disabled={!noteType} />}
        />
      }
    >
      {!noteType ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Card style={{ marginBottom: 18 }}>
            <AppText variant="title" weight="extrabold" style={{ marginBottom: 8 }}>
              {t('note_types.add_field')}
            </AppText>
            <Row gap={10} align="flex-start">
              <TextField value={newName} onChangeText={setNewName} placeholder={t('note_types.field_name')} icon="text" style={{ flex: 1, width: undefined, marginBottom: 0 }} />
              <IconButton icon="add" variant="primary" size={52} onPress={addField} accessibilityLabel={t('common.add')} />
            </Row>
          </Card>

          {fields.map((field, idx) => (
            <Card key={field.id} padding={0} style={{ marginBottom: 12, overflow: 'hidden' }}>
              <Row gap={12} style={{ padding: 14 }}>
                <IconTile icon="reorder-three" tone="sky" size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{field.name}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {t('note_types.field_index', { n: idx + 1 })}
                  </AppText>
                </View>
                <IconButton icon="chevron-up" size={36} disabled={idx === 0} onPress={() => move(idx, -1)} accessibilityLabel={t('note_types.move_up')} />
                <IconButton icon="chevron-down" size={36} disabled={idx === fields.length - 1} onPress={() => move(idx, 1)} accessibilityLabel={t('note_types.move_down')} />
              </Row>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <ListItem
                icon="swap-horizontal"
                tone="violet"
                title={t('note_types.rtl_label')}
                switchValue={!!field.rtl}
                onSwitchChange={() => toggleRtl(idx)}
                trailing={<IconButton icon="trash" variant="danger" size={36} onPress={() => remove(idx)} accessibilityLabel={t('common.delete')} />}
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
