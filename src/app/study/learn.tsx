import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { queueBuilder, StudyCardItem } from '../../core/scheduler/queueBuilder';
import { Rating } from '../../core/scheduler/types';
import { FlashCardFlip } from '../../components/card/FlashCardFlip';
import { ProgressBar, Badge, Button, Card } from '../../components/ui';
import { renderCard } from '../../core/render/templateEngine';
import { Ionicons } from '@expo/vector-icons';
import { NoteEditorModal } from '../../components/card/NoteEditorModal';
import { AIAssistantModal } from '../../components/card/AIAssistantModal';
import { audioService } from '../../core/audio/audioService';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';
import { deckRepository } from '../../core/db/repositories/deckRepository';
import { mediaManager } from '../../core/media/mediaManager';

export default function LearnNewScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [queue, setQueue] = useState<StudyCardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(true); // Always display full back/explanation side
  const [learnedCount, setLearnedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);

  const startTimeRef = useRef<number>(Date.now());

  // Load auto_play_audio setting
  useEffect(() => {
    settingsRepository.get('auto_play_audio', '1').then((val) => {
      setAutoPlayAudio(val !== '0');
    });
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  const [activeDeckId, setActiveDeckId] = useState<string | undefined>(deckId);

  useEffect(() => {
    let isCancelled = false;
    const init = async () => {
      let resolvedDeckId = deckId;
      if (!resolvedDeckId) {
        resolvedDeckId = (await deckRepository.getLastStudiedDeckId()) || undefined;
      }
      if (isCancelled) return;
      setActiveDeckId(resolvedDeckId);
      if (resolvedDeckId) {
        await deckRepository.setLastStudiedDeckId(resolvedDeckId);
      }
      const items = await queueBuilder.buildLearnQueue(resolvedDeckId, 15);
      if (isCancelled) return;
      setQueue(items);
      setLoading(false);
      startTimeRef.current = Date.now();
    };
    init();
    return () => {
      isCancelled = true;
    };
  }, [deckId]);

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
      mediaBaseUri: mediaManager.getMediaDirectory(),
    });
  }, [currentCard]);

  // Clean up audio on learn screen unmount
  useEffect(() => {
    return () => {
      audioService.stop();
    };
  }, []);

  // Auto-play audio when card appears
  useEffect(() => {
    if (!autoPlayAudio || !currentCard) return;

    let isCancelled = false;

    const playAudio = async () => {
      await new Promise((r) => setTimeout(r, 200));
      if (isCancelled) return;

      let anyPlayed = false;
      // Play front audio then back audio
      if (rendered?.frontAudio && rendered.frontAudio.length > 0) {
        for (const file of rendered.frontAudio) {
          if (isCancelled) break;
          await audioService.playAndWait(file);
        }
      }
      if (rendered?.backAudio && rendered.backAudio.length > 0) {
        for (const file of rendered.backAudio) {
          if (isCancelled) break;
          await audioService.playAndWait(file);
        }
      }
    };

    playAudio();

    return () => {
      isCancelled = true;
      audioService.stop();
    };
  }, [currentIndex, currentCard?.id, autoPlayAudio]);

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

    const audioList = [...(rendered?.frontAudio || []), ...(rendered?.backAudio || [])];
    if (audioList && audioList.length > 0) {
      for (const file of audioList) {
        await audioService.playAndWait(file);
      }
    }
  };

  const handleRate = async (rating: Rating) => {
    if (!currentCard) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    audioService.stop();

    const duration = Date.now() - startTimeRef.current;
    await queueBuilder.answerCard(currentCard, rating, duration);

    setLearnedCount((prev) => prev + 1);

    if (rating === Rating.Again) {
      // Re-queue card
      setQueue((prev) => [...prev, currentCard]);
    }

    if (currentIndex + 1 < queue.length || rating === Rating.Again) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(true);
      startTimeRef.current = Date.now();
    } else {
      router.replace(
        `/study/complete?count=${learnedCount + 1}&xp=${(learnedCount + 1) * 12}&mode=learn&deckId=${activeDeckId || deckId || ''}`
      );
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
          <Ionicons name="checkmark-done-circle-outline" size={54} color={colors.secondary} style={{ marginBottom: 12 }} />
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.xl,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            No New Cards Left!
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
            You have learned all available new cards in this deck. Add more or review due cards!
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

  const progress = queue.length > 0 ? Math.min(1, learnedCount / queue.length) : 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
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

        <View style={styles.topCenter}>
          <View style={[styles.progressRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <ProgressBar progress={progress} height={7} color={colors.secondary} />
            </View>
            <View
              style={[
                styles.badgePill,
                {
                  backgroundColor: `${colors.newCards}18`,
                  borderColor: colors.newCards,
                },
              ]}
            >
              <Text style={[styles.badgePillText, { color: colors.newCards }]}>
                {queue.length - currentIndex}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.topActionsRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 4 }]}>
          {/* Replay Sound / Audio */}
          <Pressable
            onPress={handleReplayAudio}
            hitSlop={6}
            style={styles.actionIconBtn}
          >
            <Ionicons name="volume-high-outline" size={19} color={colors.secondary} />
          </Pressable>

          {/* Auto-play Audio Toggle */}
          <Pressable
            onPress={handleToggleAutoPlay}
            hitSlop={6}
            style={[
              styles.actionIconBtn,
              {
                backgroundColor: autoPlayAudio ? `${colors.secondary}22` : 'transparent',
                borderRadius: 8,
              },
            ]}
          >
            <Ionicons
              name={autoPlayAudio ? 'musical-notes' : 'musical-note-outline'}
              size={19}
              color={autoPlayAudio ? colors.secondary : colors.textSecondary}
            />
          </Pressable>

          {/* AI Study Assistant Button */}
          <Pressable
            onPress={() => setAiModalVisible(true)}
            hitSlop={6}
            style={styles.actionIconBtn}
          >
            <Ionicons name="sparkles-outline" size={19} color={colors.primary} />
          </Pressable>

          {/* Edit Note Button */}
          <Pressable
            onPress={() => setEditModalVisible(true)}
            hitSlop={6}
            style={styles.actionIconBtn}
          >
            <Ionicons name="create-outline" size={19} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Stage Banner */}
      <View style={[styles.stageBanner, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons
            name="book-outline"
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.stageText, { color: colors.primary }]}>
            {rtl ? 'دراسة وفهم كلمة جديدة' : 'Learning New Card'}
            {currentCard?.deck_name ? ` • ${currentCard.deck_name}` : ''}
          </Text>
        </View>
      </View>

      {/* Center Card */}
      <View style={[styles.cardContainer, { padding: spacing.lg }]}>
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

      {/* Bottom Controls */}
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
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 10 }}>
          <Button
            title={rtl ? 'أعدها لاحقاً' : 'Review Later'}
            variant="ghost"
            size="lg"
            onPress={() => handleRate(Rating.Again)}
            style={{ flex: 1 }}
          />

          <Button
            title={rtl ? 'فهمتها (التالي)' : 'Understood (Next)'}
            variant="primary"
            size="lg"
            icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
            onPress={() => handleRate(Rating.Good)}
            style={{ flex: 2 }}
          />
        </View>
      </View>

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
  stageBanner: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageText: {
    fontSize: 13,
    fontWeight: 'bold',
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
  },
  topActionsRow: {
    alignItems: 'center',
  },
  actionIconBtn: {
    padding: 6,
  },
});
