import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter, Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, AppText, Button, Row, StatTile } from '../../components/ui';
import { Illustration } from '../../components/illustrations';

export default function StudyCompleteScreen() {
  const { count = '0', xp = '0', mode = 'review', deckId } = useLocalSearchParams<{
    count?: string;
    xp?: string;
    mode?: string;
    deckId?: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const cardsCount = parseInt(count, 10) || 0;
  const xpEarned = parseInt(xp, 10) || 0;
  const isLearn = mode === 'learn';

  const startQuiz = () => {
    const quizCount = Math.max(5, Math.min(20, cardsCount));
    router.replace(`/quiz/play?mode=practice&count=${quizCount}${deckId ? `&deckId=${deckId}` : ''}` as Href);
  };

  return (
    <Screen decor edges={['top', 'left', 'right', 'bottom']} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <Illustration name="all-done" size={250} />
        <AppText variant="h1" align="center" style={{ marginTop: 8 }}>
          {t('study.session_complete')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: 6, marginBottom: 24, maxWidth: 320 }}>
          {t('study.complete_desc')}
        </AppText>
      </View>

      <Row gap={12} align="stretch" style={{ marginBottom: 28 }}>
        <StatTile
          icon={isLearn ? 'school' : 'checkmark-done'}
          tone={isLearn ? 'blue' : 'green'}
          value={cardsCount}
          label={isLearn ? t('study.cards_learned') : t('study.cards_reviewed')}
        />
        <StatTile icon="flash" tone="amber" value={t('study.xp_value', { count: xpEarned })} label={t('study.xp_earned')} />
      </Row>

      <Button title={t('study.quiz_learned')} icon="sparkles" variant="accent" size="lg" fullWidth onPress={startQuiz} style={{ marginBottom: 12 }} />
      <Button
        title={t('study.review_learned')}
        icon="repeat"
        size="lg"
        fullWidth
        onPress={() => router.replace(deckId ? `/study/review?deckId=${deckId}` : '/(tabs)/decks')}
        style={{ marginBottom: 12 }}
      />
      <Button title={t('study.back_home')} icon="home" variant="ghost" fullWidth onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
