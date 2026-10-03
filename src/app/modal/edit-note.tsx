import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, TextField, Button, Card, Chip } from '../../components/ui';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { audioService } from '../../core/audio/audioService';

export default function EditNoteScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [noteTypeName, setNoteTypeName] = useState('');
  const [fieldDefs, setFieldDefs] = useState<{ id: string; name: string; ord: number }[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!noteId) {
      router.back();
      return;
    }

    Promise.all([
      noteRepository.getNoteWithDetails(noteId),
      deckRepository.getAllWithCounts(),
    ])
      .then(([details, allDecks]) => {
        setDecks(allDecks);
        if (details) {
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
        console.error('[EditNote] Load failed:', e);
        CustomAlert.alert(t('common.error'), 'Failed to load note.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [noteId]);

  const handleFieldChange = (name: string, val: string) => {
    setFields((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handlePlayAudio = (content: string) => {
    const match = content.match(/\[sound:([^\]]+)\]/);
    if (match && match[1]) {
      audioService.play(match[1]);
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

      CustomAlert.alert(t('common.done'), t('add_note.success'), [
        {
          text: t('common.close'),
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      CustomAlert.alert(t('common.error'), err.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={`${t('common.edit')} (${noteTypeName || 'Note'})`}
        onBack={() => router.back()}
        rightElement={
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        }
      />

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
          {/* Deck Picker */}
          <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons
                name="albums-outline"
                size={18}
                color={colors.primary}
                style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
              />
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: colors.text,
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.bold,
                    textAlign: rtl ? 'right' : 'left',
                  },
                ]}
              >
                {t('add_note.deck')}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {decks.map((deck) => (
                <Chip
                  key={deck.id}
                  label={deck.name}
                  selected={selectedDeckId === deck.id}
                  onPress={() => setSelectedDeckId(deck.id)}
                />
              ))}
            </ScrollView>
          </Card>

          {/* Fields */}
          {fieldDefs.map((fDef) => {
            const val = fields[fDef.name] || '';
            const hasSound = val.includes('[sound:');

            return (
              <Card key={fDef.id || fDef.name} style={[styles.sectionCard, { marginBottom: spacing.md }]}>
                <View style={[styles.fieldHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: typography.sizes.sm,
                      fontWeight: 'bold',
                    }}
                  >
                    {fDef.name}
                  </Text>
                  {hasSound && (
                    <Pressable
                      onPress={() => handlePlayAudio(val)}
                      style={[styles.audioBtn, { backgroundColor: colors.primary + '22' }]}
                      hitSlop={8}
                    >
                      <Ionicons name="volume-high-outline" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 12, marginLeft: 4 }}>Play Audio</Text>
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

          {/* Tags */}
          <Card style={[styles.sectionCard, { marginBottom: spacing.lg }]}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons
                name="pricetag-outline"
                size={18}
                color={colors.primary}
                style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
              />
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: colors.text,
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.bold,
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
              placeholder="tag1, tag2"
            />
          </Card>

          {/* Save Button */}
          <Button
            title={t('common.save')}
            variant="primary"
            size="lg"
            loading={saving}
            onPress={handleSave}
            icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
            style={{ marginBottom: 40 }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {},
  sectionCard: {
    padding: 14,
  },
  fieldLabel: {
    marginBottom: 4,
  },
  fieldHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
