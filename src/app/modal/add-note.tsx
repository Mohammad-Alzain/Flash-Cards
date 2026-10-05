import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, TextField, Button, Card } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { getDatabase } from '../../core/db/connection';
import { NoteType } from '../../core/types/models';

interface FieldDef {
  id: string;
  name: string;
  ord: number;
}

export default function AddNoteModal() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const rtl = isRTL();

  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(params.deckId || '');
  const [selectedNoteTypeId, setSelectedNoteTypeId] = useState<string>('');

  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [firstFieldError, setFirstFieldError] = useState('');

  // 1. Initial Load: Decks and Note Types
  useEffect(() => {
    Promise.all([
      deckRepository.getAllWithCounts(),
      noteRepository.getAllNoteTypes(),
    ]).then(([d, nt]) => {
      setDecks(d);
      setNoteTypes(nt);

      const targetDeckId = params.deckId && d.some((item) => item.id === params.deckId)
        ? params.deckId
        : (d.length > 0 ? d[0].id : '');

      setSelectedDeckId(targetDeckId);
      if (nt.length > 0) {
        setSelectedNoteTypeId(nt[0].id);
      }
    });
  }, [params.deckId]);

  // 2. When Deck Changes: Auto-detect the Note Type used by this deck
  useEffect(() => {
    if (!selectedDeckId) return;

    let isMounted = true;
    getDatabase().then(async (db) => {
      try {
        const row = await db.getFirstAsync<{ note_type_id: string }>(
          `SELECT n.note_type_id FROM notes n
           JOIN cards c ON c.note_id = n.id
           WHERE c.deck_id = ?
           LIMIT 1;`,
          selectedDeckId
        );
        if (isMounted && row?.note_type_id) {
          setSelectedNoteTypeId(row.note_type_id);
        }
      } catch (e) {
        // Fallback to currently selected note type
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedDeckId]);

  // 3. When Note Type Changes: Parse its actual fields dynamically
  useEffect(() => {
    if (!selectedNoteTypeId) return;

    const currentNt = noteTypes.find((nt) => nt.id === selectedNoteTypeId);
    if (currentNt) {
      try {
        const parsed = JSON.parse(currentNt.fields_json || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          const defs: FieldDef[] = parsed.map((item: any, idx: number) => ({
            id: item.id || `f_${idx}`,
            name: typeof item === 'string' ? item : item.name || `Field ${idx + 1}`,
            ord: idx,
          }));
          setFieldDefs(defs);
          return;
        }
      } catch (e) {}
    }

    // Default fallback
    setFieldDefs([
      { id: 'f0', name: 'Front', ord: 0 },
      { id: 'f1', name: 'Back', ord: 1 },
    ]);
  }, [selectedNoteTypeId, noteTypes]);

  const handleFieldChange = (fieldName: string, text: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldName]: text,
    }));
    if (fieldName === (fieldDefs[0]?.name || 'Front') && text.trim()) {
      setFirstFieldError('');
    }
  };

  const handleSave = async () => {
    const firstField = fieldDefs[0]?.name || 'Front';
    if (!fieldValues[firstField]?.trim()) {
      setFirstFieldError(t('add_note.error_empty') || 'يرجى إدخال الحقل الأول على الأقل');
      return;
    }
    setFirstFieldError('');

    if (!selectedDeckId || !selectedNoteTypeId) {
      CustomAlert.alert(
        t('common.error'),
        t('import_wizard.select_deck_notetype') || 'يرجى التأكد من اختيار الرزمة ونوع البطاقة.'
      );
      return;
    }

    setSaving(true);
    try {
      await noteRepository.createNoteWithCards({
        deckId: selectedDeckId,
        noteTypeId: selectedNoteTypeId,
        fields: fieldValues,
        tags: tags.trim(),
      });

      CustomAlert.alert(t('common.done'), t('add_note.success'), [
        {
          text: t('common.close'),
          onPress: () => router.back(),
        },
        {
          text: t('common.add') + ' +',
          onPress: () => {
            setFieldValues({});
            setFirstFieldError('');
          },
        },
      ]);
    } catch (err: any) {
      CustomAlert.alert(t('common.error'), err.message || 'فشل في حفظ البطاقة');
    } finally {
      setSaving(false);
    }
  };

  const selectedDeck = decks.find((d) => d.id === selectedDeckId);
  const selectedNoteType = noteTypes.find((nt) => nt.id === selectedNoteTypeId);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('add_note.title')}
        onBack={() => router.back()}
        rightElement={
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* 1. Deck Picker */}
        <View style={styles.section}>
          <Text
            style={[
              styles.fieldLabel,
              {
                color: colors.text,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.bold,
                textAlign: rtl ? 'right' : 'left',
                marginBottom: spacing.xs,
              },
            ]}
          >
            {t('add_note.deck')} ({selectedDeck?.name || ''})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {decks.map((deck) => (
              <Pressable
                key={deck.id}
                onPress={() => setSelectedDeckId(deck.id)}
                style={[
                  styles.selectorChip,
                  {
                    backgroundColor: selectedDeckId === deck.id ? colors.primaryLight : colors.surface,
                    borderColor: selectedDeckId === deck.id ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selectedDeckId === deck.id ? colors.primary : colors.text,
                    fontWeight: selectedDeckId === deck.id ? 'bold' : 'normal',
                    fontSize: typography.sizes.sm,
                  }}
                >
                  {deck.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* 2. Note Type Picker */}
        {noteTypes.length > 1 && (
          <View style={styles.section}>
            <Text
              style={[
                styles.fieldLabel,
                {
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                  marginBottom: spacing.xs,
                },
              ]}
            >
              {rtl ? 'نوع البطاقة (القالب):' : 'Note Type (Template):'} {selectedNoteType?.name || ''}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {noteTypes.map((nt) => (
                <Pressable
                  key={nt.id}
                  onPress={() => setSelectedNoteTypeId(nt.id)}
                  style={[
                    styles.selectorChip,
                    {
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      backgroundColor: selectedNoteTypeId === nt.id ? colors.primary + '18' : colors.surfaceRaised,
                      borderColor: selectedNoteTypeId === nt.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selectedNoteTypeId === nt.id ? colors.primary : colors.textSecondary,
                      fontWeight: selectedNoteTypeId === nt.id ? 'bold' : 'normal',
                      fontSize: typography.sizes.xs,
                    }}
                  >
                    {nt.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 3. Dynamic Fields of the Selected Deck's Note Type */}
        <View style={styles.section}>
          <Text
            style={[
              styles.fieldLabel,
              {
                color: colors.text,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.bold,
                textAlign: rtl ? 'right' : 'left',
                marginBottom: spacing.sm,
              },
            ]}
          >
            {rtl ? 'حقول الرزمة المستهدفة:' : 'Deck Fields:'}
          </Text>

          {fieldDefs.map((fDef, idx) => {
            const isFirst = idx === 0;
            const val = fieldValues[fDef.name] || '';
            return (
              <View key={fDef.id || fDef.name} style={{ marginBottom: spacing.sm }}>
                <TextField
                  label={fDef.name}
                  placeholder={`${rtl ? 'أدخل' : 'Enter'} ${fDef.name}...`}
                  value={val}
                  onChangeText={(txt) => handleFieldChange(fDef.name, txt)}
                  multiline
                  numberOfLines={isFirst ? 3 : 4}
                  error={isFirst ? firstFieldError : undefined}
                />
              </View>
            );
          })}
        </View>

        {/* 4. Tags Field */}
        <View style={styles.section}>
          <TextField
            label={t('add_note.tags')}
            placeholder={t('add_note.tags_placeholder')}
            value={tags}
            onChangeText={setTags}
          />
        </View>

        {/* 5. Save Button */}
        <Button
          title={t('add_note.save_button')}
          variant="primary"
          size="lg"
          loading={saving}
          onPress={handleSave}
          style={{ marginTop: spacing.md }}
        />

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
  section: {
    marginBottom: 16,
  },
  fieldLabel: {},
  horizontalScroll: {
    flexDirection: 'row',
  },
  selectorChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
