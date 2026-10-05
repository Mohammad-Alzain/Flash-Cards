import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import { queueBuilder, StudyCardItem } from '../../core/scheduler/queueBuilder';
import { Rating } from '../../core/scheduler/types';
import { previewSM2Intervals } from '../../core/scheduler/sm2';
import { FlashCardFlip } from '../../components/card/FlashCardFlip';
import { Whiteboard } from '../../components/card/Whiteboard';
import { Button, IconButton, AppText } from '../../components/ui';
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
import { StudyToolStrip, StudyTool } from '../../features/study/components/StudyToolStrip';
import { RatingBar } from '../../features/study/components/RatingBar';
import { CardActionsSheet, CardAction } from '../../features/study/components/CardActionsSheet';
import { StudyStateView } from '../../features/study/components/StudyStateView';
import { StudyCardModals } from '../../features/study/components/StudyCardModals';

/** XP awarded per reviewed card (shown on the completion screen). */
const XP_PER_REVIEW = 10;

export default function ReviewScreen() {
  const { deckId, mode, cardIds } = useLocalSearchParams<{ deckId?: string; mode?: string; cardIds?: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [queue, setQueue] = useState<StudyCardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [initialQueueLength, setInitialQueueLength] = useState(0);
  const [loading, setLoading] = useState(true);
  const [whiteboardVisible, setWhiteboardVisible] = useState(false);
  const [history, setHistory] = useState<string[]>([]); // card ids, for undo
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const cardStartTimeRef = useRef<number>(Date.now());

  const { autoPlay, toggle: toggleAutoPlay } = useAutoPlayAudio();
  const currentCard = queue[currentIndex];
  const rendered = useRenderedCard(currentCard);

  useEffect(() => {
    if (deckId) deckRepository.setLastStudiedDeckId(deckId).catch(() => {});
    const specificIds = cardIds ? cardIds.split(',').filter(Boolean) : undefined;
    const studyMode = (mode as any) || (specificIds ? 'selected' : 'due');
    queueBuilder.buildReviewQueue(deckId, undefined, studyMode, specificIds).then((items) => {
      setQueue(items);
      setInitialQueueLength(items.length);
      setLoading(false);
      cardStartTimeRef.current = Date.now();
    });
  }, [deckId, mode, cardIds]);

  useStopAudioOnUnmount();
  // Front audio when a card appears; back audio once the answer is revealed.
  useAutoPlaySequence(autoPlay && !!currentCard && !isFlipped, () => rendered?.frontAudio, [currentIndex, currentCard?.id]);
  useAutoPlaySequence(autoPlay && !!currentCard && isFlipped, () => rendered?.backAudio, [isFlipped]);

  const handleReplayAudio = async () => {
    tapHaptic();
    await playSequence(isFlipped ? rendered?.backAudio : rendered?.frontAudio);
  };

  const handleFlip = () => {
    audioService.stop();
    setIsFlipped(!isFlipped);
  };

  const handleRate = async (rating: Rating) => {
    if (!currentCard) return;
    audioService.stop();
    tapHaptic(rating === Rating.Again ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    const duration = Date.now() - cardStartTimeRef.current;
    await queueBuilder.answerCard(currentCard, rating, duration);

    setHistory((prev) => [...prev, currentCard.id]);
    setReviewedCount((prev) => prev + 1);

    // A failed card (Again) is re-queued at the end of the session.
    if (rating === Rating.Again) {
      setQueue((prev) => [...prev, currentCard]);
    }

    if (currentIndex + 1 < queue.length || rating === Rating.Again) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
      cardStartTimeRef.current = Date.now();
    } else {
      const done = reviewedCount + 1;
      router.replace(`/study/complete?count=${done}&xp=${done * XP_PER_REVIEW}&deckId=${deckId || ''}`);
    }
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastCardId = history[history.length - 1];
    const success = await queueBuilder.undoLastReview(lastCardId);
    if (success) {
      setHistory((prev) => prev.slice(0, -1));
      setReviewedCount((prev) => Math.max(0, prev - 1));
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
        setIsFlipped(false);
      }
    }
  };

  const handleAction = async (action: CardAction) => {
    if (!currentCard) return;
    setMenuVisible(false);

    if (action === 'suspend') {
      await queueBuilder.suspendCard(currentCard.id);
      CustomAlert.alert(t('study.suspend'), t('study.suspended_msg'));
    } else if (action === 'bury') {
      await queueBuilder.buryCard(currentCard.id);
      CustomAlert.alert(t('study.bury'), t('study.buried_msg'));
    } else if (action === 'reset') {
      await queueBuilder.resetCard(currentCard.id);
      CustomAlert.alert(t('study.reset'), t('study.reset_msg'));
    }

    if (currentIndex + 1 < queue.length) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      router.replace('/(tabs)');
    }
  };

  if (loading) return <StudyStateView loading />;

  if (!currentCard || currentIndex >= queue.length) {
    return (
      <StudyStateView
        illustration="sleep"
        title={t('home.all_done_title')}
        description={t('home.all_done_subtitle')}
        onAction={() => router.replace('/(tabs)')}
      />
    );
  }

  const intervals = previewSM2Intervals(currentCard);
  const progress = initialQueueLength > 0 ? Math.min(1, reviewedCount / initialQueueLength) : 0;

  const tools: StudyTool[] = [
    { key: 'audio', label: t('study.tool_audio'), icon: 'volume-high', onPress: handleReplayAudio },
    { key: 'auto', label: t('study.tool_autoplay'), icon: autoPlay ? 'musical-notes' : 'musical-note-outline', active: autoPlay, onPress: toggleAutoPlay },
    { key: 'draw', label: t('study.tool_draw'), icon: 'brush', active: whiteboardVisible, onPress: () => setWhiteboardVisible(!whiteboardVisible) },
    { key: 'podcast', label: t('study.tool_podcast'), icon: 'headset', onPress: () => router.push(`/study/podcast?deckId=${deckId || ''}`) },
    { key: 'ai', label: t('study.tool_ai'), icon: 'sparkles', onPress: () => setAiVisible(true) },
    { key: 'edit', label: t('study.tool_edit'), icon: 'create', onPress: () => setEditVisible(true) },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <StudyTopBar
        progress={progress}
        remaining={queue.length - currentIndex}
        onClose={() => router.back()}
        actions={
          <>
            {history.length > 0 && (
              <IconButton icon="arrow-undo" onPress={handleUndo} size={40} accessibilityLabel={t('study.undo')} />
            )}
            <IconButton icon="ellipsis-horizontal" onPress={() => setMenuVisible(true)} size={40} accessibilityLabel={t('study.actions')} />
          </>
        }
      />
      <StudyToolStrip tools={tools} />

      <View style={{ flex: 1, padding: 16 }}>
        <FlashCardFlip
          frontHtml={rendered?.frontHtml || ''}
          backHtml={rendered?.backHtml || ''}
          css={currentCard.css}
          templateOrd={currentCard.template_ord}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          onAudioPlay={(file) => audioService.play(file)}
        />
        <Whiteboard visible={whiteboardVisible} onClose={() => setWhiteboardVisible(false)} />
      </View>

      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
        {!isFlipped ? (
          <>
            <Button title={t('study.show_answer')} icon="eye" size="lg" fullWidth onPress={handleFlip} />
            <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: 6 }}>
              {t('study.tap_to_flip')}
            </AppText>
          </>
        ) : (
          <RatingBar intervals={intervals} onRate={handleRate} />
        )}
      </SafeAreaView>

      <CardActionsSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onAction={handleAction}
        autoPlay={autoPlay}
        onToggleAutoPlay={toggleAutoPlay}
      />
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
