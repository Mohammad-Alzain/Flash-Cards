import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomAlert } from '../common/CustomDialog';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Button, Card, TextField, Chip } from '../ui';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { audioService } from '../../core/audio/audioService';

interface NoteEditorModalProps {
  visible: boolean;
  noteId: string | null;
  onClose: () => void;
  onSaved?: (updatedFields: Record<string, string>, updatedTags: string) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  visible,
  noteId,
  onClose,
  onSaved,
}) => {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const rtl = isRTL();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [noteTypeId, setNoteTypeId] = useState('');
  const [noteTypeName, setNoteTypeName] = useState('');
  const [fieldDefs, setFieldDefs] = useState<{ id: string; name: string; ord: number }[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [tags, setTags] = useState('');
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');

  // Add field inline
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldNameInput, setNewFieldNameInput] = useState('');
  const [addingFieldLoading, setAddingFieldLoading] = useState(false);

  useEffect(() => {
    if (!visible || !noteId) return;

    let mounted = true;
    setLoading(true);

    Promise.all([
      noteRepository.getNoteWithDetails(noteId),
      deckRepository.getAllWithCounts(),
    ])
      .then(([details, allDecks]) => {
        if (!mounted) return;
        setDecks(allDecks);

        if (details) {
          setNoteTypeId(details.noteType.id);
          setNoteTypeName(details.noteType.name);
          try {
            const flds = JSON.parse(details.noteType.fields_json || '[]');
            setFieldDefs(flds);
          } catch {
            setFieldDefs([
              { id: 'f0', name: 'Front', ord: 0 },
              { id: 'f1', name: 'Back', ord: 1 },
            ]);
          }

          setFields(details.fields);
          setTags(details.note.tags || '');
          setSelectedDeckId(details.deckId || (allDecks[0]?.id ?? ''));
        }
      })
      .catch((e) => {
        console.error('[NoteEditor] Load error:', e);
        CustomAlert.alert(t('common.error'), 'Failed to load card details.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [visible, noteId]);

  const handleAddNewField = async () => {
    if (!newFieldNameInput.trim() || !noteTypeId) return;
    setAddingFieldLoading(true);
    try {
      const updatedDefs = await noteRepository.addFieldToNoteType(
        noteTypeId,
        newFieldNameInput.trim(),
        rtl
      );
      setFieldDefs(updatedDefs as any);
      setFields((prev) => ({
        ...prev,
        [newFieldNameInput.trim()]: '',
      }));
      setNewFieldNameInput('');
      setIsAddingField(false);
      CustomAlert.alert(
        t('common.done'),
        rtl
          ? `تمت إضافة الحقل "${newFieldNameInput.trim()}" بنجاح إلى نمط البطاقة (${noteTypeName}).`
          : `Field "${newFieldNameInput.trim()}" added to note type (${noteTypeName}).`
      );
    } catch (e: any) {
      CustomAlert.alert(t('common.warning'), e.message || 'Failed to add field.');
    } finally {
      setAddingFieldLoading(false);
    }
  };

  const handleFieldChange = (fieldName: string, val: string) => {
    setFields((prev) => ({
      ...prev,
      [fieldName]: val,
    }));
  };

  const handlePlayAudioFromField = (content: string) => {
    const match = content.match(/\[sound:([^\]]+)\]/);
    if (match && match[1]) {
      audioService.play(match[1]);
    } else {
      CustomAlert.alert('Audio', 'No sound tag found in this field.');
    }
  };

  const handleSave = async () => {
    if (!noteId) return;

    setSaving(true);
    try {
      await noteRepository.updateNote(noteId, {
        fields,
        tags: tags.trim(),
        deckId: selectedDeckId,
      });

      if (onSaved) {
        onSaved(fields, tags.trim());
      }
      onClose();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        {/* Top Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surfaceRaised,
              borderBottomColor: colors.border,
              flexDirection: rtl ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text
              style={[
                styles.headerTitle,
                { color: colors.text, fontSize: typography.sizes.md },
              ]}
            >
              {t('common.edit')} ({noteTypeName || 'Note'})
            </Text>
          </View>

          <Button
            title={t('common.save')}
            variant="primary"
            size="sm"
            loading={saving}
            onPress={handleSave}
            icon={<Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
              {t('common.loading')}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { padding: spacing.lg }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Target Deck Selector */}
            <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
              <View
                style={[
                  styles.sectionHeaderRow,
                  { flexDirection: rtl ? 'row-reverse' : 'row' },
                ]}
              >
                <Ionicons
                  name="albums-outline"
                  size={18}
                  color={colors.primary}
                  style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
                />
                <Text
                  style={[
                    styles.sectionHeading,
                    {
                      color: colors.text,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {t('add_note.deck')}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.deckScroll}
              >
                {decks.map((d) => (
                  <Chip
                    key={d.id}
                    label={d.name}
                    selected={selectedDeckId === d.id}
                    onPress={() => setSelectedDeckId(d.id)}
                  />
                ))}
              </ScrollView>
            </Card>

            {/* Note Fields */}
            {fieldDefs.map((fDef) => {
              const val = fields[fDef.name] || '';
              const hasSound = val.includes('[sound:');

              return (
                <Card
                  key={fDef.id || fDef.name}
                  style={[styles.fieldCard, { marginBottom: spacing.md }]}
                >
                  <View
                    style={[
                      styles.fieldHeaderRow,
                      { flexDirection: rtl ? 'row-reverse' : 'row' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fieldLabel,
                        {
                          color: colors.primary,
                          fontSize: typography.sizes.sm,
                          fontWeight: 'bold',
                        },
                      ]}
                    >
                      {fDef.name}
                    </Text>

                    {hasSound && (
                      <Pressable
                        onPress={() => handlePlayAudioFromField(val)}
                        style={[
                          styles.soundPreviewBtn,
                          {
                            backgroundColor: colors.primary + '22',
                            flexDirection: rtl ? 'row-reverse' : 'row',
                          },
                        ]}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="volume-high-outline"
                          size={16}
                          color={colors.primary}
                        />
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 12,
                            marginLeft: rtl ? 0 : 4,
                            marginRight: rtl ? 4 : 0,
                          }}
                        >
                          Play Audio
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <TextField
                    value={val}
                    onChangeText={(txt) => handleFieldChange(fDef.name, txt)}
                    placeholder={`${fDef.name}...`}
                    multiline
                    numberOfLines={3}
                  />
                </Card>
              );
            })}

            {/* Add Field to Note Type Button / Form */}
            <View style={{ marginBottom: spacing.lg }}>
              {isAddingField ? (
                <Card style={[styles.fieldCard, { padding: spacing.md, backgroundColor: colors.surface }]}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: '700',
                      marginBottom: 8,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {rtl
                      ? `إضافة حقل جديد لنمط (${noteTypeName || 'البطاقة'})`
                      : `Add New Field to (${noteTypeName || 'Note Type'})`}
                  </Text>
                  <TextField
                    value={newFieldNameInput}
                    onChangeText={setNewFieldNameInput}
                    placeholder={
                      rtl
                        ? 'اسم الحقل الجديد (مثال: Audio, Example, ترجمة)...'
                        : 'New field name (e.g. Audio, Example)...'
                    }
                    style={{ marginBottom: 10 }}
                  />
                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }}>
                    <Button
                      title={rtl ? 'إلغاء' : 'Cancel'}
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        setIsAddingField(false);
                        setNewFieldNameInput('');
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title={rtl ? 'إضافة الحقل' : 'Add Field'}
                      variant="primary"
                      size="sm"
                      loading={addingFieldLoading}
                      onPress={handleAddNewField}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              ) : (
                <Button
                  title={
                    rtl
                      ? `+ إضافة حقل جديد لنمط (${noteTypeName || 'البطاقة'})`
                      : `+ Add Field to (${noteTypeName || 'Note Type'})`
                  }
                  variant="secondary"
                  size="md"
                  icon={<Ionicons name="add-circle-outline" size={18} color={colors.primary} />}
                  onPress={() => setIsAddingField(true)}
                />
              )}
            </View>

            {/* Tags */}
            <Card style={[styles.sectionCard, { marginBottom: spacing.lg }]}>
              <View
                style={[
                  styles.sectionHeaderRow,
                  { flexDirection: rtl ? 'row-reverse' : 'row' },
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={18}
                  color={colors.primary}
                  style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
                />
                <Text
                  style={[
                    styles.sectionHeading,
                    {
                      color: colors.text,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {t('add_note.tags')}
                </Text>
              </View>

              <TextField
                value={tags}
                onChangeText={setTags}
                placeholder="tag1, tag2, tag3"
              />
            </Card>

            {/* Action Buttons */}
            <View style={{ gap: 10, marginBottom: 40 }}>
              <Button
                title={t('common.save')}
                variant="primary"
                size="lg"
                loading={saving}
                onPress={handleSave}
                icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
              />

              <Button
                title={t('common.cancel')}
                variant="ghost"
                size="md"
                onPress={onClose}
              />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 4,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  content: {},
  sectionCard: {
    padding: 14,
  },
  fieldCard: {
    padding: 14,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  deckScroll: {
    flexDirection: 'row',
  },
  fieldHeaderRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {},
  soundPreviewBtn: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
});
