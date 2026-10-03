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
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, TextField, Button, Card } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { NoteType } from '../../core/types/models';

export default function AddNoteModal() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [selectedNoteTypeId, setSelectedNoteTypeId] = useState<string>('');

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorFront, setErrorFront] = useState('');

  useEffect(() => {
    Promise.all([
      deckRepository.getAllWithCounts(),
      noteRepository.getAllNoteTypes(),
    ]).then(([d, nt]) => {
      setDecks(d);
      setNoteTypes(nt);
      if (d.length > 0) setSelectedDeckId(d[0].id);
      if (nt.length > 0) setSelectedNoteTypeId(nt[0].id);
    });
  }, []);

  const handleSave = async () => {
    if (!front.trim()) {
      setErrorFront(t('add_note.error_empty'));
      return;
    }
    setErrorFront('');

    if (!selectedDeckId || !selectedNoteTypeId) {
      CustomAlert.alert(t('common.error'), t('import_wizard.select_deck_notetype') || 'Please ensure a deck and note type are selected.');
      return;
    }

    setSaving(true);
    try {
      const result = await noteRepository.createNoteWithCards({
        deckId: selectedDeckId,
        noteTypeId: selectedNoteTypeId,
        fields: {
          Front: front.trim(),
          Back: back.trim(),
        },
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
            setFront('');
            setBack('');
          },
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
        title={t('add_note.title')}
        onBack={() => router.back()}
        rightElement={
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Deck Picker */}
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
            {t('add_note.deck')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
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

        {/* Front Field */}
        <TextField
          label={t('add_note.front')}
          placeholder={t('add_note.front_placeholder')}
          value={front}
          onChangeText={(txt) => {
            setFront(txt);
            if (txt) setErrorFront('');
          }}
          multiline
          numberOfLines={3}
          error={errorFront}
        />

        {/* Back Field */}
        <TextField
          label={t('add_note.back')}
          placeholder={t('add_note.back_placeholder')}
          value={back}
          onChangeText={setBack}
          multiline
          numberOfLines={4}
        />

        {/* Tags Field */}
        <TextField
          label={t('add_note.tags')}
          placeholder={t('add_note.tags_placeholder')}
          value={tags}
          onChangeText={setTags}
        />

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
    marginRight: 8,
  },
});
