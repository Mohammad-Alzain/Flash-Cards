import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { AppText, Row, Button, Badge, IconTile, PressableScale, EmptyState } from '../../components/ui';
import { queueBuilder, StudyCardItem } from '../../core/scheduler/queueBuilder';
import { Rating } from '../../core/scheduler/types';
import { cleanTextForQuiz } from '../../core/quiz/generator';

/** Nominal answer time recorded for quick-card reviews. */
const QUICK_ANSWER_MS = 4000;
const CLOSE_DELAY_MS = 300;

export default function QuickCardModal() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, shape, shadow, tone } = useTheme();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<StudyCardItem | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);

  // A due review card first, otherwise one new card.
  useEffect(() => {
    (async () => {
      try {
        const due = await queueBuilder.buildReviewQueue(undefined, undefined, 'due');
        if (due.length > 0) setCard(due[0]);
        else {
          const fresh = await queueBuilder.buildLearnQueue(undefined, 1);
          if (fresh.length > 0) setCard(fresh[0]);
        }
      } catch (e) {
        console.warn('Failed to load quick card:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const answer = async (rating: Rating) => {
    if (!card || answered) return;
    setAnswered(true);
    Haptics.notificationAsync(
      rating === Rating.Good ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
    await queueBuilder.answerCard(card, rating, QUICK_ANSWER_MS);
    setTimeout(() => router.back(), CLOSE_DELAY_MS);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <EmptyState
          illustration="all-done"
          title={t('quick_card.none_title')}
          description={t('quick_card.none_desc')}
          actionTitle={t('quick_card.continue')}
          actionIcon="home"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const values = Object.values(card.note_fields || {});
  const prompt = cleanTextForQuiz(card.note_fields?.Front || values[0] || t('quick_card.fallback_question'));
  const back = cleanTextForQuiz(card.note_fields?.Back || values[1] || t('quick_card.fallback_answer'));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Row justify="space-between" style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <Row gap={10}>
          <IconTile icon="flash" tone="amber" size={34} variant="solid" />
          <AppText variant="title" weight="extrabold">
            {t('quick_card.title')}
          </AppText>
        </Row>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <AppText variant="bodySm" weight="bold" color="textMuted">
            {t('quick_card.skip')} ✕
          </AppText>
        </Pressable>
      </Row>

      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        <PressableScale
          onPress={() => setFlipped(!flipped)}
          activeScale={0.98}
          style={[
            {
              minHeight: 300,
              borderRadius: shape.hero,
              borderWidth: 1,
              borderBottomWidth: 4,
              borderColor: colors.border,
              backgroundColor: colors.surfaceRaised,
              padding: 28,
              alignItems: 'center',
              justifyContent: 'center',
            },
            shadow(2),
          ]}
        >
          {!!card.deck_name && <Badge size="sm" variant="primary" icon="layers" label={card.deck_name} style={{ alignSelf: 'center', marginBottom: 14 }} />}
          <AppText variant="caption" color="textMuted" align="center" style={{ marginBottom: 10 }}>
            {flipped ? t('quick_card.back') : t('quick_card.front')}
          </AppText>
          <AppText variant="h1" align="center">
            {prompt}
          </AppText>
          {flipped ? (
            <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderColor: colors.border, width: '100%' }}>
              <AppText variant="h3" color="primary" align="center">
                {back}
              </AppText>
            </View>
          ) : (
            <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: 20 }}>
              👆 {t('quick_card.tap_hint')}
            </AppText>
          )}
        </PressableScale>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 }}>
        {!flipped ? (
          <Button title={t('quick_card.show_answer')} icon="eye" size="lg" fullWidth onPress={() => setFlipped(true)} />
        ) : (
          <Row gap={12}>
            <Button
              title={t('quick_card.dont_know')}
              icon="close-circle"
              variant="dangerSoft"
              size="lg"
              onPress={() => answer(Rating.Again)}
              style={{ flex: 1 }}
            />
            <Button title={t('quick_card.know_it')} icon="checkmark-circle" size="lg" color={tone('green').solid} onPress={() => answer(Rating.Good)} style={{ flex: 1 }} />
          </Row>
        )}
      </View>
    </SafeAreaView>
  );
}
