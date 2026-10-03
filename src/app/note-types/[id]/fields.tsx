import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Pressable,
} from 'react-native';
import { CustomAlert } from '../../../components/common/CustomDialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { isRTL } from '../../../i18n';
import { Header, Card, Button, TextField } from '../../../components/ui';
import { noteRepository } from '../../../core/db/repositories/noteRepository';
import { NoteType, NoteFieldDef, CardTemplateDef } from '../../../core/types/models';

export default function FieldsEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [noteType, setNoteType] = useState<NoteType | null>(null);
  const [fields, setFields] = useState<NoteFieldDef[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      noteRepository.getNoteTypeById(id).then((nt) => {
        if (nt) {
          setNoteType(nt);
          try {
            setFields(JSON.parse(nt.fields_json || '[]'));
          } catch (e) {
            setFields([]);
          }
        }
      });
    }
  }, [id]);

  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    const name = newFieldName.trim();
    if (fields.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      CustomAlert.alert(t('common.warning'), rtl ? 'يوجد حقل بهذا الاسم مسبقاً.' : 'A field with this name already exists.');
      return;
    }

    const newField: NoteFieldDef = {
      id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name,
      order: fields.length,
      rtl: rtl, // default to app RTL
      sticky: false,
    };

    setFields([...fields, newField]);
    setNewFieldName('');
  };

  const handleToggleRTL = (index: number) => {
    const updated = [...fields];
    updated[index].rtl = !updated[index].rtl;
    setFields(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...fields];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    updated.forEach((f, idx) => (f.order = idx));
    setFields(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === fields.length - 1) return;
    const updated = [...fields];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    updated.forEach((f, idx) => (f.order = idx));
    setFields(updated);
  };

  const handleDelete = (index: number) => {
    if (fields.length <= 1) {
      CustomAlert.alert(t('common.error'), rtl ? 'يجب أن يحتوي نمط البطاقة على حقل واحد على الأقل.' : 'A note type must have at least one field.');
      return;
    }
    const fieldName = fields[index].name;
    CustomAlert.alert(
      t('common.delete'),
      rtl
        ? `هل أنت متأكد من حذف الحقل "${fieldName}"؟ تأكد من أنه غير مستخدم في قوالب البطاقات.`
        : `Delete field "${fieldName}"? Make sure it is not required by your card templates.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            const updated = fields.filter((_, i) => i !== index);
            updated.forEach((f, idx) => (f.order = idx));
            setFields(updated);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!noteType) return;
    setSaving(true);
    try {
      await noteRepository.updateNoteType(noteType.id, {
        fields,
      });
      CustomAlert.alert(t('common.done'), rtl ? 'تم حفظ الحقول وتحديث البطاقات بنجاح.' : 'Fields saved and cards updated successfully!');
      router.back();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!noteType) return null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('note_types.fields_title')}
        subtitle={noteType.name}
        onBack={() => router.back()}
        rightElement={
          <Button
            title={t('common.save')}
            variant="primary"
            size="sm"
            loading={saving}
            onPress={handleSave}
          />
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Add Field Box */}
        <Card style={[styles.addCard, { marginBottom: spacing.lg }]}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.bold,
                textAlign: rtl ? 'right' : 'left',
                marginBottom: spacing.xs,
              },
            ]}
          >
            {t('note_types.add_field')}
          </Text>

          <View style={[styles.addRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}>
              <TextField
                value={newFieldName}
                onChangeText={setNewFieldName}
                placeholder={t('note_types.field_name')}
                style={{ marginBottom: 0 }}
              />
            </View>
            <Button
              title={`+ ${t('common.add')}`}
              variant="secondary"
              size="md"
              onPress={handleAddField}
            />
          </View>
        </Card>

        {/* Fields List */}
        {fields.map((field, idx) => (
          <Card key={field.id} style={[styles.fieldCard, { marginBottom: spacing.md }]}>
            <View style={[styles.fieldRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={styles.fieldInfoCol}>
                <Text
                  style={[
                    styles.fieldName,
                    {
                      color: colors.text,
                      fontSize: typography.sizes.md,
                      fontWeight: typography.weights.bold,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {field.name}
                </Text>
                <Text
                  style={[
                    styles.fieldOrder,
                    {
                      color: colors.textSecondary,
                      fontSize: typography.sizes.xs,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  Index: {idx + 1}
                </Text>
              </View>

              {/* Reorder Buttons */}
              <View style={[styles.reorderGroup, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Pressable
                  onPress={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                  style={[styles.arrowBtn, { backgroundColor: colors.surface, opacity: idx === 0 ? 0.3 : 1 }]}
                >
                  <Text style={{ color: colors.text, fontSize: 16 }}>▲</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleMoveDown(idx)}
                  disabled={idx === fields.length - 1}
                  style={[styles.arrowBtn, { backgroundColor: colors.surface, opacity: idx === fields.length - 1 ? 0.3 : 1 }]}
                >
                  <Text style={{ color: colors.text, fontSize: 16 }}>▼</Text>
                </Pressable>
              </View>
            </View>

            {/* RTL Switch & Delete */}
            <View
              style={[
                styles.optionsRow,
                {
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  borderTopColor: colors.border,
                  marginTop: spacing.sm,
                  paddingTop: spacing.sm,
                },
              ]}
            >
              <View style={[styles.rtlOption, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    marginRight: rtl ? 0 : 6,
                    marginLeft: rtl ? 6 : 0,
                  }}
                >
                  {t('note_types.rtl_label')}
                </Text>
                <Switch
                  value={field.rtl}
                  onValueChange={() => handleToggleRTL(idx)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>

              <Button
                title={t('common.delete')}
                variant="ghost"
                size="sm"
                onPress={() => handleDelete(idx)}
              />
            </View>
          </Card>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  addCard: {},
  sectionTitle: {},
  addRow: {
    alignItems: 'center',
  },
  fieldCard: {},
  fieldRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldInfoCol: {
    flex: 1,
  },
  fieldName: {},
  fieldOrder: {
    marginTop: 2,
  },
  reorderGroup: {
    alignItems: 'center',
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  optionsRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  rtlOption: {
    alignItems: 'center',
  },
});
