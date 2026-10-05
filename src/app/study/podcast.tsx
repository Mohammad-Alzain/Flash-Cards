import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { isRTL } from '../../i18n';
import { Header } from '../../components/ui/Header';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { queueBuilder } from '../../core/scheduler/queueBuilder';
import { deckRepository } from '../../core/db/repositories/deckRepository';
import { usePodcastPlayer } from '../../core/audio/usePodcastPlayer';

export default function PodcastModeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const rtl = isRTL();

  const [loading, setLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const {
    isPlaying,
    currentIndex,
    queue,
    phase,
    remainingThinking,
    thinkingSeconds,
    speechRate,
    currentCard,
    tracks,
    play,
    pause,
    togglePlay,
    next,
    prev,
    replayCurrent,
    stop,
    setThinkingSeconds,
    setSpeechRate,
    setQueue,
  } = usePodcastPlayer();

  // Load cards queue into global background player
  useEffect(() => {
    async function loadCards() {
      // If player already has a queue with cards for this deck and is playing, don't restart
      if (queue.length > 0 && isPlaying) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (params.deckId) {
          deckRepository.setLastStudiedDeckId(params.deckId).catch(() => {});
        }
        const [reviewCards, learnCards] = await Promise.all([
          queueBuilder.buildReviewQueue(params.deckId),
          queueBuilder.buildLearnQueue(params.deckId),
        ]);
        let allCards = [...reviewCards, ...learnCards];

        // If no cards are due today, load all cards from the deck for listening practice
        if (allCards.length === 0) {
          allCards = await queueBuilder.buildReviewQueue(params.deckId, undefined, 'all');
        }

        const deckName = allCards[0]?.deck_name || 'Flashcards Podcast';
        setQueue(allCards, 0, deckName);
      } catch (e) {
        console.warn('Failed to load queue for podcast mode:', e);
      } finally {
        setLoading(false);
      }
    }
    loadCards();
  }, [params.deckId]);

  // Pulse animation when speaking or playing audio
  useEffect(() => {
    if (phase === 'word' || phase === 'explanation' || phase === 'example') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
        <Header title={t('study.podcastMode') || 'Podcast Mode'} onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textMuted, marginTop: 12 }}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (queue.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
        <Header title={t('study.podcastMode') || 'Podcast Mode'} onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="headset-outline" size={54} color={theme.colors.primary} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            {rtl ? 'لا توجد بطاقات في هذه الرزمة للاستماع إليها!' : 'No cards found in this deck!'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Phase color & status text mapping
  const getPhaseOrbColor = () => {
    switch (phase) {
      case 'word':
        return '#3B82F6'; // Blue
      case 'thinking':
        return '#F59E0B'; // Amber
      case 'explanation':
        return '#10B981'; // Emerald Green
      case 'example':
        return '#8B5CF6'; // Purple
      case 'wait_next':
        return '#06B6D4'; // Cyan
      default:
        return theme.colors.surface;
    }
  };

  const getPhaseStatusText = () => {
    switch (phase) {
      case 'word':
        return rtl ? 'تشغيل الكلمة...' : 'Playing Word...';
      case 'thinking':
        return rtl
          ? `فترة التفكير... (${remainingThinking} ث)`
          : `Thinking... (${remainingThinking}s)`;
      case 'explanation':
        return rtl ? 'تشغيل مقطع الشرح...' : 'Playing Explanation...';
      case 'example':
        return rtl ? 'تشغيل مقطع المثال...' : 'Playing Example...';
      case 'wait_next':
        return rtl ? 'الانتقال للكلمة التالية...' : 'Next Word...';
      default:
        return rtl ? 'متوقف مؤقتاً' : 'Paused';
    }
  };

  const getPhaseIcon = () => {
    switch (phase) {
      case 'word':
        return 'volume-medium-outline';
      case 'thinking':
        return 'hourglass-outline';
      case 'explanation':
        return 'volume-high-outline';
      case 'example':
        return 'chatbubble-ellipses-outline';
      case 'wait_next':
        return 'play-skip-forward-outline';
      default:
        return 'headset-outline';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={rtl ? 'وضع البودكاست والاستماع' : (t('study.podcastMode') || 'Podcast Mode')}
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        {/* Progress & Counter */}
        <View style={[styles.progressRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.counterText, { color: theme.colors.textMuted }]}>
            {currentIndex + 1} / {queue.length}
          </Text>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <ProgressBar progress={(currentIndex + 1) / queue.length} height={8} />
          </View>
        </View>

        {/* Background Status Indicator */}
        <View
          style={[
            styles.bgStatusPill,
            {
              backgroundColor: isPlaying
                ? (theme.colors.primary + '18')
                : (theme.colors.surface),
              borderColor: isPlaying ? theme.colors.primary : theme.colors.border,
              flexDirection: rtl ? 'row-reverse' : 'row',
              gap: 8,
            },
          ]}
        >
          <Ionicons
            name={isPlaying ? 'radio' : 'pause-circle-outline'}
            size={16}
            color={isPlaying ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.bgStatusText,
              { color: isPlaying ? theme.colors.primary : theme.colors.textMuted },
            ]}
          >
            {isPlaying
              ? (rtl ? 'يعمل في الخلفية • المشغل نشط في الإشعارات' : 'Playing in background • Active in notifications')
              : (rtl ? 'المشغل متوقف مؤقتاً' : 'Player paused')}
          </Text>
        </View>

        {/* Visual Pulse Waveform Orb */}
        <View style={styles.orbContainer}>
          <Animated.View
            style={[
              styles.audioOrb,
              {
                backgroundColor: getPhaseOrbColor(),
                borderColor: theme.colors.border,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Ionicons
              name={getPhaseIcon()}
              size={52}
              color={phase === 'idle' ? theme.colors.textMuted : '#ffffff'}
            />
          </Animated.View>

          <Text style={[styles.phaseStatus, { color: theme.colors.text }]}>
            {getPhaseStatusText()}
          </Text>
        </View>

        {/* Card Content Card */}
        <Card style={styles.cardPreview}>
          {/* Word (Front) */}
          <Text style={[styles.previewLabel, { color: theme.colors.primary, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl ? 'الكلمة / السؤال' : (t('card.front') || 'Word / Front')}
          </Text>
          <Text
            style={[styles.previewText, { color: theme.colors.text, textAlign: rtl ? 'right' : 'left' }]}
            numberOfLines={2}
          >
            {tracks?.wordText || '...'}
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Explanation & Example (Back) */}
          <Text style={[styles.previewLabel, { color: theme.colors.accent, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl ? 'الشرح والمثال' : (t('card.back') || 'Explanation & Example')}
          </Text>

          {phase !== 'word' && phase !== 'thinking' ? (
            <View>
              {tracks?.explanationText ? (
                <Text
                  style={[
                    styles.previewText,
                    {
                      color: phase === 'explanation' ? theme.colors.primary : theme.colors.text,
                      fontWeight: phase === 'explanation' ? 'bold' : '600',
                      textAlign: rtl ? 'right' : 'left',
                      marginBottom: tracks?.exampleText ? 6 : 0,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {tracks.explanationText}
                </Text>
              ) : null}

              {tracks?.exampleText ? (
                <Text
                  style={[
                    styles.previewText,
                    {
                      color: phase === 'example' ? '#8B5CF6' : theme.colors.textSecondary,
                      fontStyle: 'italic',
                      fontSize: 14,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                  numberOfLines={3}
                >
                  "{tracks.exampleText}"
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.previewText, { color: theme.colors.textMuted, textAlign: rtl ? 'right' : 'left' }]}>
              ••••••••••••
            </Text>
          )}
        </Card>

        {/* Settings Bar (Thinking duration & Speed) */}
        <View style={[styles.settingsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <View style={[styles.chipGroup, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.chipGroupLabel, { color: theme.colors.textMuted }]}>
              {rtl ? 'التفكير:' : (t('study.delay') || 'Pause:')}
            </Text>
            {[2, 3, 5, 8].map((sec) => (
              <TouchableOpacity
                key={sec}
                style={[
                  styles.smallChip,
                  {
                    backgroundColor: thinkingSeconds === sec ? theme.colors.primary : theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setThinkingSeconds(sec)}
              >
                <Text
                  style={[
                    styles.smallChipText,
                    { color: thinkingSeconds === sec ? '#ffffff' : theme.colors.text },
                  ]}
                >
                  {sec}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.chipGroup, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.chipGroupLabel, { color: theme.colors.textMuted }]}>
              {rtl ? 'السرعة:' : (t('study.speed') || 'Speed:')}
            </Text>
            {[0.8, 1.0, 1.2].map((rate) => (
              <TouchableOpacity
                key={rate}
                style={[
                  styles.smallChip,
                  {
                    backgroundColor: speechRate === rate ? theme.colors.primary : theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setSpeechRate(rate)}
              >
                <Text
                  style={[
                    styles.smallChipText,
                    { color: speechRate === rate ? '#ffffff' : theme.colors.text },
                  ]}
                >
                  {rate}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Media Controls Bar */}
        <View style={[styles.mediaBar, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {/* Previous Card */}
          <TouchableOpacity style={styles.secControlBtn} onPress={prev} activeOpacity={0.7}>
            <Ionicons name={rtl ? 'play-skip-forward' : 'play-skip-back'} size={26} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Replay Current Card */}
          <TouchableOpacity style={styles.secControlBtn} onPress={replayCurrent} activeOpacity={0.7}>
            <Ionicons name="repeat" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Play / Pause Toggle Button */}
          <TouchableOpacity
            style={[
              styles.playBtn,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={togglePlay}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={36}
              color="#ffffff"
              style={{ marginLeft: isPlaying ? 0 : 3 }}
            />
          </TouchableOpacity>

          {/* Next Card */}
          <TouchableOpacity style={styles.secControlBtn} onPress={next} activeOpacity={0.7}>
            <Ionicons name={rtl ? 'play-skip-back' : 'play-skip-forward'} size={26} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Stop Button */}
          <TouchableOpacity
            style={[styles.secControlBtn, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
            onPress={stop}
            activeOpacity={0.7}
          >
            <Ionicons name="stop" size={20} color={theme.colors.error || '#EF4444'} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bgStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
    marginVertical: 4,
  },
  bgStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orbContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  audioOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  phaseStatus: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  cardPreview: {
    padding: 16,
    minHeight: 140,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  smallChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderBottomWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
