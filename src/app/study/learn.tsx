import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { queueBuilder, StudyCardItem } from '../../core/scheduler/queueBuilder';
import { Rating } from '../../core/scheduler/types';
import { FlashCardFlip } from '../../components/card/FlashCardFlip';
import { Button, IconButton, Row, AppText, IconTile } from '../../components/ui';
import { audioService } from '../../core/audio/audioService';
import { deckRepository } from '../../core/db/repositories/deckRepository';
import {
  useRenderedCard,
  useAutoPlayAudio,
  useAutoPlaySequence,
  useStopAudioOnUnmount,
  playSequence,
  tapHaptic,
  patchQueueItem,
} from '../../features/study/studyHooks';
import { StudyTopBar } from '../../features/study/components/StudyTopBar';
import { StudyStateView } from '../../features/study/components/StudyStateView';
import { StudyCardModals } from '../../features/study/components/StudyCardModals';

/** XP awarded per learned card (shown on the completion screen). */
const XP_PER_LEARN = 12;

export default function LearnNewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { colors, tone } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [queue, setQueue] = useState<StudyCardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(true); // Learn mode shows the full back/explanation side
  const [learnedCount, setLearnedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(20);
  const [editVisible, setEditVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [activeDeckId, setActiveDeckId] = useState<string | undefined>(deckId);
  const startTimeRef = useRef<number>(Date.now());

  const { autoPlay, toggle: toggleAutoPlay } = useAutoPlayAudio();
  const currentCard = queue[currentIndex];
  const rendered = useRenderedCard(currentCard);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolvedDeckId = deckId;
      if (!resolvedDeckId) {
        resolvedDeckId = (await deckRepository.getLastStudiedDeckId()) || undefined;
      }
      if (cancelled) return;
      setActiveDeckId(resolvedDeckId);
      if (resolvedDeckId) await deckRepository.setLastStudiedDeckId(resolvedDeckId);

      const [{ remaining, dailyLimit: targetLimit, learnedToday }, items] = await Promise.all([
        queueBuilder.getRemainingNewCardsToday(resolvedDeckId),
        queueBuilder.buildLearnQueue(resolvedDeckId),
      ]);
      if (cancelled) return;
      setDailyLimit(targetLimit);
      setDailyLimitReached(learnedToday >= targetLimit);
      setQueue(items);
      setLoading(false);
      startTimeRef.current = Date.now();
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  useStopAudioOnUnmount();
  // Learn mode shows both sides at once, so play front then back audio.
  useAutoPlaySequence(
    autoPlay && !!currentCard,
    () => [...(rendered?.frontAudio || []), ...(rendered?.backAudio || [])],
    [currentIndex, currentCard?.id]
  );

  const handleReplayAudio = async () => {
    tapHaptic();
    await playSequence([...(rendered?.frontAudio || []), ...(rendered?.backAudio || [])]);
  };

  const handleRate = async (rating: Rating) => {
    if (!currentCard) return;
    tapHaptic();
    audioService.stop();

    const duration = Date.now() - startTimeRef.current;
    const next = await queueBuilder.answerCard(currentCard, rating, duration);
    setLearnedCount((prev) => prev + 1);

    if (rating === Rating.Again) {
      const updatedCard: StudyCardItem = {
        ...currentCard,
        state: next.cardState,
        reps: next.reps,
        lapses: next.lapses,
        ease_factor: next.easeFactor,
        interval_days: next.intervalDays,
        due: next.due,
      };
      setQueue((prev) => [...prev, updatedCard]);
    }

    if (currentIndex + 1 < queue.length || rating === Rating.Again) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(true);
      startTimeRef.current = Date.now();
    } else {
      const done = learnedCount + 1;
      router.replace(
        `/study/complete?count=${done}&xp=${done * XP_PER_LEARN}&mode=learn&deckId=${activeDeckId || deckId || ''}`
      );
    }
  };

  if (loading) return <StudyStateView loading />;

  if (!currentCard || currentIndex >= queue.length) {
    const title = dailyLimitReached ? t('study.daily_limit_reached_title') : t('study.no_new_title');
    const description = dailyLimitReached
      ? t('study.daily_limit_reached_desc', { count: dailyLimit })
      : t('study.no_new_desc');

    return (
      <StudyStateView
        illustration="learn"
        title={title}
        description={description}
        onAction={() => router.replace('/(tabs)')}
      />
    );
  }

  const progress = queue.length > 0 ? Math.min(1, learnedCount / queue.length) : 0;
  const learnTone = tone('blue');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <StudyTopBar
        progress={progress}
        remaining={queue.length - currentIndex}
        color={learnTone.fg}
        badgeVariant="new"
        onClose={() => router.back()}
        actions={
          <>
            <IconButton icon="volume-high" onPress={handleReplayAudio} size={40} accessibilityLabel={t('study.tool_audio')} />
            <IconButton
              icon={autoPlay ? 'musical-notes' : 'musical-note-outline'}
              variant={autoPlay ? 'tinted' : 'surface'}
              onPress={toggleAutoPlay}
              size={40}
              accessibilityLabel={t('study.tool_autoplay')}
            />
          </>
        }
      />

      {/* Stage banner */}
      <Row gap={10} style={{ marginHorizontal: 16, marginBottom: 4, padding: 10, borderRadius: 16, backgroundColor: learnTone.bg }}>
        <IconTile icon="school" tone="blue" size={32} variant="solid" />
        <AppText variant="bodySm" weight="extrabold" color={learnTone.fg} numberOfLines={1} style={{ flex: 1 }}>
          {t('study.learning_banner')}
          {currentCard.deck_name ? ` · ${currentCard.deck_name}` : ''}
        </AppText>
        <IconButton icon="sparkles" variant="ghost" size={34} color={colors.primary} onPress={() => setAiVisible(true)} accessibilityLabel={t('study.tool_ai')} />
        <IconButton icon="create" variant="ghost" size={34} onPress={() => setEditVisible(true)} accessibilityLabel={t('study.tool_edit')} />
      </Row>

      <View style={{ flex: 1, padding: 16 }}>
        <FlashCardFlip
          frontHtml={rendered?.frontHtml || ''}
          backHtml={rendered?.backHtml || ''}
          css={currentCard.css}
          templateOrd={currentCard.template_ord}
          isFlipped={isFlipped}
          onFlip={() => {
            audioService.stop();
            setIsFlipped(!isFlipped);
          }}
          onAudioPlay={(file) => audioService.play(file)}
        />
      </View>

      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
        <Row gap={10}>
          <Button title={t('study.review_later')} icon="time" variant="ghost" size="lg" onPress={() => handleRate(Rating.Again)} style={{ flex: 1 }} />
          <Button title={t('study.understood')} icon="checkmark-circle" size="lg" color={learnTone.solid} onPress={() => handleRate(Rating.Good)} style={{ flex: 1.6 }} />
        </Row>
      </SafeAreaView>

      <StudyCardModals
        card={currentCard}
        editVisible={editVisible}
        aiVisible={aiVisible}
        onCloseEdit={() => setEditVisible(false)}
        onCloseAI={() => setAiVisible(false)}
        onNoteSaved={(fields, tags) => setQueue((q) => patchQueueItem(q, currentIndex, fields, tags))}
      />
    </SafeAreaView>
  );
}
