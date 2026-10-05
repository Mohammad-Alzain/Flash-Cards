import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import {
  queueBuilder,
  StudyCardItem,
} from '../../core/scheduler/queueBuilder';
import { Rating } from '../../core/scheduler/types';
import { previewSM2Intervals } from '../../core/scheduler/sm2';
import { FlashCardFlip } from '../../components/card/FlashCardFlip';
import { ProgressBar, Badge, Button, Card } from '../../components/ui';
import { renderCard } from '../../core/render/templateEngine';
import { Whiteboard } from '../../components/card/Whiteboard';
import { TtsService } from '../../core/audio/ttsService';
import { Ionicons } from '@expo/vector-icons';
import { NoteEditorModal } from '../../components/card/NoteEditorModal';
import { AIAssistantModal } from '../../components/card/AIAssistantModal';
import { audioService } from '../../core/audio/audioService';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';
import { mediaManager } from '../../core/media/mediaManager';

export default function ReviewScreen() {
  const { deckId, mode, cardIds } = useLocalSearchParams<{ deckId?: string; mode?: string; cardIds?: string }>();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [queue, setQueue] = useState<StudyCardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [initialQueueLength, setInitialQueueLength] = useState(0);
  const [loading, setLoading] = useState(true);
  const [whiteboardVisible, setWhiteboardVisible] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);

  // History for Undo
  const [history, setHistory] = useState<string[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);

  // Timer
  const cardStartTimeRef = useRef<number>(Date.now());

  // Load auto_play_audio setting
  useEffect(() => {
    settingsRepository.get('auto_play_audio', '1').then((val) => {
      setAutoPlayAudio(val !== '0');
    });
  }, []);

  useEffect(() => {
    const specificIds = cardIds ? cardIds.split(',').filter(Boolean) : undefined;
    const studyMode = (mode as any) || (specificIds ? 'selected' : 'due');
    queueBuilder.buildReviewQueue(deckId, undefined, studyMode, specificIds).then((items) => {
      setQueue(items);
      setInitialQueueLength(items.length);
      setLoading(false);
      cardStartTimeRef.current = Date.now();
    });
  }, [deckId, mode, cardIds]);

  const currentCard = queue[currentIndex];

  const rendered = useMemo(() => {
    if (!currentCard) return null;
    return renderCard({
      frontTemplate: currentCard.front_template,
      backTemplate: currentCard.back_template,
      fields: currentCard.note_fields,
      css: currentCard.css,
      templateOrd: currentCard.template_ord,
      deckName: currentCard.deck_name,
      tags: currentCard.tags,
      mediaBaseUri: mediaManager.getMediaDirectory(),
    });
  }, [currentCard]);

  // Auto-play front audio when card appears
  useEffect(() => {
    if (!autoPlayAudio || !currentCard || isFlipped) return;

    let isCancelled = false;
    const playFront = async () => {
      await new Promise((r) => setTimeout(r, 200));
      if (isCancelled) return;
      if (rendered?.frontAudio && rendered.frontAudio.length > 0) {
        let anyPlayed = false;
        for (const file of rendered.frontAudio) {
          if (isCancelled) break;
          const ok = await audioService.playAndWait(file);
          if (ok) anyPlayed = true;
        }
        if (!anyPlayed && !isCancelled) {
          const frontText =
            currentCard?.note_fields?.Front ||
            Object.values(currentCard?.note_fields || {})[0] ||
            '';
          if (frontText) {
            console.log(`[MEDIA] Front audio file not found, falling back to TTS: "${frontText}"`);
            await TtsService.speak(frontText);
          }
        }
      }
    };

    playFront();

    return () => {
      isCancelled = true;
      audioService.stop();
    };
  }, [currentIndex, currentCard?.id, autoPlayAudio]);

  // Auto-play back audio when card is flipped (answer revealed)
  useEffect(() => {
    if (!autoPlayAudio || !currentCard || !isFlipped) return;

    let isCancelled = false;
    const playBack = async () => {
      await new Promise((r) => setTimeout(r, 200));
      if (isCancelled) return;
      if (rendered?.backAudio && rendered.backAudio.length > 0) {
        let anyPlayed = false;
        for (const file of rendered.backAudio) {
          if (isCancelled) break;
          const ok = await audioService.playAndWait(file);
          if (ok) anyPlayed = true;
        }
        if (!anyPlayed && !isCancelled) {
          const backText =
            currentCard?.note_fields?.Back ||
            Object.values(currentCard?.note_fields || {})[1] ||
            '';
          if (backText) {
            console.log(`[MEDIA] Back audio file not found, falling back to TTS: "${backText}"`);
            await TtsService.speak(backText);
          }
        }
      }
    };

    playBack();

    return () => {
      isCancelled = true;
      audioService.stop();
    };
  }, [isFlipped, autoPlayAudio]);

  const handleToggleAutoPlay = async () => {
    const nextVal = !autoPlayAudio;
    setAutoPlayAudio(nextVal);
    await settingsRepository.set('auto_play_audio', nextVal ? '1' : '0');
    if (!nextVal) {
      audioService.stop();
    }
  };

  const handleReplayAudio = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    const audioList = isFlipped ? rendered?.backAudio : rendered?.frontAudio;
    let anyPlayed = false;
    if (audioList && audioList.length > 0) {
      for (const file of audioList) {
        const ok = await audioService.playAndWait(file);
        if (ok) anyPlayed = true;
      }
    }
    if (!anyPlayed) {
      const textToSpeak = isFlipped
        ? currentCard?.note_fields?.Back || Object.values(currentCard?.note_fields || {})[1] || ''
        : currentCard?.note_fields?.Front || Object.values(currentCard?.note_fields || {})[0] || '';
      if (textToSpeak) {
        console.log(`[MEDIA] Replay audio fallback to TTS: "${textToSpeak}"`);
        TtsService.speak(textToSpeak);
      }
    }
  };

  const handleFlip = () => {
    audioService.stop();
    setIsFlipped(!isFlipped);
  };

  const handleRate = async (rating: Rating) => {
    if (!currentCard) return;

    try {
      Haptics.impactAsync(
        rating === Rating.Again
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
    } catch (e) {}

    const duration = Date.now() - cardStartTimeRef.current;
    await queueBuilder.answerCard(currentCard, rating, duration);

    setHistory((prev) => [...prev, currentCard.id]);
    setReviewedCount((prev) => prev + 1);

    // If card was failed (Again), re-queue it at the end of the session
    if (rating === Rating.Again) {
      setQueue((prev) => [...prev, currentCard]);
    }

    if (currentIndex + 1 < queue.length || rating === Rating.Again) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
      cardStartTimeRef.current = Date.now();
    } else {
      // Completed session!
      router.replace(
        `/study/complete?count=${reviewedCount + 1}&xp=${(reviewedCount + 1) * 10}&deckId=${deckId || ''}`
      );
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

  const handleAction = async (action: 'suspend' | 'bury' | 'reset') => {
    if (!currentCard) return;
    setMenuVisible(false);

    if (action === 'suspend') {
      await queueBuilder.suspendCard(currentCard.id);
      CustomAlert.alert(t('study.suspend'), 'Card suspended.');
    } else if (action === 'bury') {
      await queueBuilder.buryCard(currentCard.id);
      CustomAlert.alert(t('study.bury'), 'Card buried until tomorrow.');
    } else if (action === 'reset') {
      await queueBuilder.resetCard(currentCard.id);
      CustomAlert.alert(t('study.reset'), 'Card progress reset to New.');
    }

    // Advance to next card
    if (currentIndex + 1 < queue.length) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      router.replace('/(tabs)');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentCard || currentIndex >= queue.length) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <Ionicons name="trophy-outline" size={54} color={colors.primary} style={{ marginBottom: 12 }} />
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.xl,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            {t('home.all_done_title')}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.sizes.sm,
              textAlign: 'center',
              marginTop: 6,
              maxWidth: 280,
            }}
          >
            {t('home.all_done_subtitle')}
          </Text>
          <Button
            title={t('study.back_home')}
            variant="primary"
            size="md"
            onPress={() => router.replace('/(tabs)')}
            style={{ marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Previews
  const intervals = previewSM2Intervals(currentCard);

  const progress =
    initialQueueLength > 0 ? Math.min(1, reviewedCount / initialQueueLength) : 0;
  const remaining = queue.length - currentIndex;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* ── Tier 1: Main Header (Nav, Wide Progress Bar, Undo, Menu) ── */}
      <View
        style={[
          styles.topBar,
          {
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            flexDirection: rtl ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>

        {/* Generous Center Progress Section */}
        <View style={styles.topCenter}>
          <View style={[styles.progressRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <ProgressBar progress={progress} height={7} color={colors.primary} />
            </View>
            <View
              style={[
                styles.badgePill,
                {
                  backgroundColor: `${colors.dueCards}18`,
                  borderColor: colors.dueCards,
                },
              ]}
            >
              <Text style={[styles.badgePillText, { color: colors.dueCards }]}>
                {remaining}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Corner: Undo + Menu */}
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
          {history.length > 0 && (
            <Pressable
              onPress={handleUndo}
              hitSlop={8}
              style={styles.actionIconBtn}
            >
              <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
            </Pressable>
          )}

          <Pressable
            onPress={() => setMenuVisible(true)}
            hitSlop={8}
            style={styles.actionIconBtn}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* ── Tier 2: Study Tools Bar (Audio, Auto, Brush, Headset, Edit) ── */}
      <View
        style={[
          styles.studyToolsBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            flexDirection: rtl ? 'row-reverse' : 'row',
          },
        ]}
      >
        {/* Replay Sound */}
        <Pressable
          onPress={handleReplayAudio}
          hitSlop={6}
          style={({ pressed }) => [
            styles.toolChip,
            { backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.7 : 1, flexDirection: rtl ? 'row-reverse' : 'row' },
          ]}
        >
          <Ionicons name="volume-high-outline" size={16} color={colors.primary} />
          <Text style={[styles.toolChipText, { color: colors.text }]}>
            {rtl ? 'صوت' : 'Audio'}
          </Text>
        </Pressable>

        {/* Auto-play Audio Toggle */}
        <Pressable
          onPress={handleToggleAutoPlay}
          hitSlop={6}
          style={({ pressed }) => [
            styles.toolChip,
            {
              backgroundColor: autoPlayAudio ? `${colors.primary}18` : colors.surfaceRaised,
              borderColor: autoPlayAudio ? colors.primary : colors.border,
              opacity: pressed ? 0.7 : 1,
              flexDirection: rtl ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Ionicons
            name={autoPlayAudio ? 'musical-notes' : 'musical-note-outline'}
            size={16}
            color={autoPlayAudio ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.toolChipText,
              {
                color: autoPlayAudio ? colors.primary : colors.textSecondary,
              },
            ]}
          >
            {rtl ? 'تلقائي' : 'Auto'}
          </Text>
        </Pressable>

        {/* Whiteboard Scratchpad */}
        <Pressable
          onPress={() => setWhiteboardVisible(!whiteboardVisible)}
          hitSlop={6}
          style={({ pressed }) => [
            styles.toolChip,
            {
              backgroundColor: whiteboardVisible ? `${colors.primary}22` : colors.surfaceRaised,
              borderColor: whiteboardVisible ? colors.primary : colors.border,
              opacity: pressed ? 0.7 : 1,
              flexDirection: rtl ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Ionicons name="brush-outline" size={16} color={colors.primary} />
          <Text style={[styles.toolChipText, { color: colors.text }]}>
            {rtl ? 'مسودة' : 'Draw'}
          </Text>
        </Pressable>

        {/* Podcast Mode */}
        <Pressable
          onPress={() => router.push(`/study/podcast?deckId=${deckId || ''}`)}
          hitSlop={6}
          style={({ pressed }) => [
            styles.toolChip,
            { backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.7 : 1, flexDirection: rtl ? 'row-reverse' : 'row' },
          ]}
        >
          <Ionicons name="headset-outline" size={16} color={colors.accent} />
          <Text style={[styles.toolChipText, { color: colors.text }]}>
            {rtl ? 'بودكاست' : 'Podcast'}
          </Text>
        </Pressable>

        {/* AI Study Assistant */}
        <Pressable
          onPress={() => setAiModalVisible(true)}
          hitSlop={6}
          style={({ pressed }) => [
            styles.toolChip,
            { backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.7 : 1, flexDirection: rtl ? 'row-reverse' : 'row' },
          ]}
        >
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={[styles.toolChipText, { color: colors.text }]}>
            {rtl ? 'شرح ذكي' : 'AI Help'}
          </Text>
        </Pressable>

        {/* Edit Note */}
        <Pressable
          onPress={() => setEditModalVisible(true)}
          hitSlop={6}
          style={({ pressed }) => [
            styles.toolChip,
            { backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.7 : 1, flexDirection: rtl ? 'row-reverse' : 'row' },
          ]}
        >
          <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.toolChipText, { color: colors.text }]}>
            {rtl ? 'تعديل' : 'Edit'}
          </Text>
        </Pressable>
      </View>

      {/* Center 3D Flip Card */}
      <View style={[styles.cardContainer, { padding: spacing.lg }]}>
        <FlashCardFlip
          frontHtml={rendered?.frontHtml || ''}
          backHtml={rendered?.backHtml || ''}
          css={currentCard.css}
          templateOrd={currentCard.template_ord}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          onAudioPlay={(file) => audioService.play(file)}
        />
        <Whiteboard
          visible={whiteboardVisible}
          onClose={() => setWhiteboardVisible(false)}
        />
      </View>

      {/* Bottom Buttons */}
      <View
        style={[
          styles.bottomControls,
          {
            backgroundColor: colors.surfaceRaised,
            borderTopColor: colors.border,
            padding: spacing.md,
          },
        ]}
      >
        {!isFlipped ? (
          <Button
            title={t('study.show_answer')}
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleFlip}
          />
        ) : (
          <View style={[styles.ratingsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {/* Again */}
            <Pressable
              onPress={() => handleRate(Rating.Again)}
              style={({ pressed }) => [
                styles.ratingBox,
                {
                  backgroundColor: `${colors.error}12`,
                  borderColor: colors.error,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.ratingInterval, { color: colors.error }]}>
                {intervals[Rating.Again].buttonLabel}
              </Text>
              <Text style={[styles.ratingLabel, { color: colors.error }]}>
                {t('study.again')}
              </Text>
            </Pressable>

            {/* Hard */}
            <Pressable
              onPress={() => handleRate(Rating.Hard)}
              style={({ pressed }) => [
                styles.ratingBox,
                {
                  backgroundColor: `${colors.warning}14`,
                  borderColor: colors.warning,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.ratingInterval, { color: colors.warning }]}>
                {intervals[Rating.Hard].buttonLabel}
              </Text>
              <Text style={[styles.ratingLabel, { color: colors.warning }]}>
                {t('study.hard')}
              </Text>
            </Pressable>

            {/* Good */}
            <Pressable
              onPress={() => handleRate(Rating.Good)}
              style={({ pressed }) => [
                styles.ratingBox,
                {
                  backgroundColor: `${colors.primary}14`,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.ratingInterval, { color: colors.primary }]}>
                {intervals[Rating.Good].buttonLabel}
              </Text>
              <Text style={[styles.ratingLabel, { color: colors.primary }]}>
                {t('study.good')}
              </Text>
            </Pressable>

            {/* Easy */}
            <Pressable
              onPress={() => handleRate(Rating.Easy)}
              style={({ pressed }) => [
                styles.ratingBox,
                {
                  backgroundColor: `${colors.dueCards}14`,
                  borderColor: colors.dueCards,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.ratingInterval, { color: colors.dueCards }]}>
                {intervals[Rating.Easy].buttonLabel}
              </Text>
              <Text style={[styles.ratingLabel, { color: colors.dueCards }]}>
                {t('study.easy')}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Card Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuVisible(false)}
        >
          <Card style={[styles.menuCard, { backgroundColor: colors.surfaceRaised }]}>
            <Text
              style={[
                styles.menuHeading,
                { color: colors.text, marginBottom: spacing.md },
              ]}
            >
              {t('study.actions')}
            </Text>

            <Button
              title={t('study.suspend')}
              variant="ghost"
              size="md"
              onPress={() => handleAction('suspend')}
              style={{ marginBottom: 8 }}
            />

            <Button
              title={t('study.bury')}
              variant="ghost"
              size="md"
              onPress={() => handleAction('bury')}
              style={{ marginBottom: 8 }}
            />

            <Button
              title={`${rtl ? 'تشغيل الصوت تلقائياً' : 'Auto-play Audio'}: ${autoPlayAudio ? (rtl ? 'مفعّل' : 'ON') : (rtl ? 'معطّل' : 'OFF')}`}
              variant="ghost"
              size="md"
              onPress={() => {
                handleToggleAutoPlay();
                setMenuVisible(false);
              }}
              style={{ marginBottom: 8 }}
            />

            <Button
              title={t('study.reset')}
              variant="danger"
              size="md"
              onPress={() => handleAction('reset')}
              style={{ marginBottom: 8 }}
            />

            <Button
              title={t('common.cancel')}
              variant="ghost"
              size="sm"
              onPress={() => setMenuVisible(false)}
            />
          </Card>
        </Pressable>
      </Modal>

      {/* Note Editor Modal */}
      <NoteEditorModal
        visible={editModalVisible}
        noteId={currentCard ? currentCard.note_id : null}
        onClose={() => setEditModalVisible(false)}
        onSaved={(updatedFields, updatedTags) => {
          if (!currentCard) return;
          setQueue((prevQueue) => {
            const nextQueue = [...prevQueue];
            if (nextQueue[currentIndex]) {
              nextQueue[currentIndex] = {
                ...nextQueue[currentIndex],
                note_fields: updatedFields,
                tags: updatedTags,
              };
            }
            return nextQueue;
          });
        }}
      />

      {currentCard && (
        <AIAssistantModal
          visible={aiModalVisible}
          onClose={() => setAiModalVisible(false)}
          cardId={currentCard.id}
          front={currentCard.note_fields?.Front || Object.values(currentCard.note_fields || {})[0] || ''}
          back={currentCard.note_fields?.Back || Object.values(currentCard.note_fields || {})[1] || ''}
          deckName={currentCard.deck_name}
          fields={currentCard.note_fields}
        />
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
    padding: 32,
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  topCenter: {
    flex: 1,
    marginHorizontal: 10,
  },
  progressRow: {
    alignItems: 'center',
    width: '100%',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  studyToolsBar: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolChip: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  toolChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionIconBtn: {
    padding: 6,
  },
  cardContainer: {
    flex: 1,
  },
  bottomControls: {
    borderTopWidth: 1,
    minHeight: 74,
    justifyContent: 'center',
  },
  ratingsRow: {
    justifyContent: 'space-between',
    width: '100%',
  },
  ratingBox: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingInterval: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 32,
  },
  menuCard: {
    padding: 24,
  },
  menuHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
