import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
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
import { queueBuilder, StudyCardItem } from '../../core/scheduler/queueBuilder';
import { TtsService, cleanTextForTts } from '../../core/audio/ttsService';
import { audioService } from '../../core/audio/audioService';
import { mediaManager } from '../../core/media/mediaManager';
import { renderCard } from '../../core/render/templateEngine';

type PlaybackPhase = 'idle' | 'word' | 'thinking' | 'explanation' | 'example' | 'wait_next';

interface PodcastTracks {
  wordText: string;
  wordAudio: string | null;
  explanationText: string;
  explanationAudio: string | null;
  exampleText: string;
  exampleAudio: string | null;
  extraAudios: string[];
}

function extractPodcastTracks(card: StudyCardItem, rendered: any): PodcastTracks {
  const fields = card?.note_fields || {};

  const getSoundFrom = (str: string | undefined): string | null => {
    if (!str) return null;
    const sounds = audioService.extractSoundTags(str);
    return sounds.length > 0 ? sounds[0] : null;
  };

  // 1. Identify Word (Text & Audio)
  const wordKey =
    Object.keys(fields).find((k) =>
      /word|expression|front|term|vocabulary|الكلمة|المفردة|المصطلح/i.test(k)
    ) || Object.keys(fields)[0];

  const wordText = cleanTextForTts(fields[wordKey] || Object.values(fields)[0] || 'Question');

  let wordAudio: string | null = null;
  if (rendered?.frontAudio && rendered.frontAudio.length > 0) {
    wordAudio = rendered.frontAudio[0];
  } else {
    const wordAudioKey = Object.keys(fields).find((k) =>
      /word.*audio|audio.*word|front.*audio|sound|نطق|صوت.*الكلمة/i.test(k)
    );
    if (wordAudioKey) {
      wordAudio =
        getSoundFrom(fields[wordAudioKey]) ||
        (fields[wordAudioKey].endsWith('.mp3') ? fields[wordAudioKey] : null);
    }
    if (!wordAudio && wordKey) {
      wordAudio = getSoundFrom(fields[wordKey]);
    }
  }

  // 2. Identify Explanation / Meaning (Text & Audio)
  const explanationKey =
    Object.keys(fields).find((k) =>
      /meaning|definition|explanation|translation|back|المعنى|الشرح|الترجمة|التعريف/i.test(k)
    ) || Object.keys(fields)[1];

  const explanationText = cleanTextForTts(fields[explanationKey] || Object.values(fields)[1] || '');

  let explanationAudio: string | null = null;
  const explanationAudioKey = Object.keys(fields).find((k) =>
    /meaning.*audio|explanation.*audio|definition.*audio|translation.*audio|صوت.*المعنى|صوت.*الشرح|صوت.*الترجمة/i.test(k)
  );
  if (explanationAudioKey) {
    explanationAudio =
      getSoundFrom(fields[explanationAudioKey]) ||
      (fields[explanationAudioKey].endsWith('.mp3') ? fields[explanationAudioKey] : null);
  }

  // 3. Identify Example / Sentence (Text & Audio)
  const exampleKey =
    Object.keys(fields).find((k) =>
      /example|sentence|context|sample|المثال|الجملة|سياق/i.test(k)
    ) || (Object.keys(fields).length > 2 ? Object.keys(fields)[2] : null);

  const exampleText = exampleKey ? cleanTextForTts(fields[exampleKey]) : '';

  let exampleAudio: string | null = null;
  const exampleAudioKey = Object.keys(fields).find((k) =>
    /example.*audio|sentence.*audio|context.*audio|صوت.*المثال|صوت.*الجملة/i.test(k)
  );
  if (exampleAudioKey) {
    exampleAudio =
      getSoundFrom(fields[exampleAudioKey]) ||
      (fields[exampleAudioKey].endsWith('.mp3') ? fields[exampleAudioKey] : null);
  }

  // Distribute from rendered.backAudio if explanation or example audio not explicitly assigned
  const backAudios: string[] = rendered?.backAudio || [];
  let backIdx = 0;

  if (!explanationAudio && backAudios.length > backIdx) {
    explanationAudio = backAudios[backIdx];
    backIdx++;
  }
  if (!exampleAudio && backAudios.length > backIdx) {
    exampleAudio = backAudios[backIdx];
    backIdx++;
  }

  // Fallbacks: search field values for sound tags
  if (!explanationAudio && explanationKey) {
    explanationAudio = getSoundFrom(fields[explanationKey]);
  }
  if (!exampleAudio && exampleKey) {
    exampleAudio = getSoundFrom(fields[exampleKey]);
  }

  // Collect any remaining unused audio clips
  const usedSounds = new Set([wordAudio, explanationAudio, exampleAudio].filter(Boolean));
  const extraAudios: string[] = [];
  for (const a of backAudios) {
    if (!usedSounds.has(a) && !extraAudios.includes(a)) {
      extraAudios.push(a);
    }
  }
  for (const val of Object.values(fields)) {
    const s = getSoundFrom(val);
    if (s && !usedSounds.has(s) && !extraAudios.includes(s)) {
      extraAudios.push(s);
    }
  }

  return {
    wordText,
    wordAudio,
    explanationText,
    explanationAudio,
    exampleText,
    exampleAudio,
    extraAudios,
  };
}

export default function PodcastModeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const rtl = isRTL();

  const [queue, setQueue] = useState<StudyCardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [phase, setPhase] = useState<PlaybackPhase>('idle');
  const [thinkingSeconds, setThinkingSeconds] = useState(3);
  const [remainingThinking, setRemainingThinking] = useState(3);
  const [speechRate, setSpeechRate] = useState(1.0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const queueRef = useRef<StudyCardItem[]>([]);
  queueRef.current = queue;

  // Load cards queue
  useEffect(() => {
    async function loadCards() {
      try {
        setLoading(true);
        const [reviewCards, learnCards] = await Promise.all([
          queueBuilder.buildReviewQueue(params.deckId),
          queueBuilder.buildLearnQueue(params.deckId),
        ]);
        let allCards = [...reviewCards, ...learnCards];

        // If no cards are due today, load all cards from the deck for listening practice
        if (allCards.length === 0) {
          allCards = await queueBuilder.buildReviewQueue(params.deckId, undefined, 'all');
        }

        setQueue(allCards);
      } catch (e) {
        console.warn('Failed to load queue for podcast mode:', e);
      } finally {
        setLoading(false);
      }
    }
    loadCards();

    return () => {
      TtsService.stop();
      audioService.stop();
    };
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

  // Main Podcast playback step loop: Word -> Thinking -> Explanation -> Example -> Next
  const playCurrentCard = async () => {
    if (!isPlayingRef.current) return;
    const cards = queueRef.current;
    const idx = currentIndexRef.current;
    if (idx >= cards.length) {
      setIsPlaying(false);
      setPhase('idle');
      return;
    }

    const card = cards[idx];
    const rendered = renderCard({
      frontTemplate: card.front_template,
      backTemplate: card.back_template,
      fields: card.note_fields,
      css: card.css,
      templateOrd: card.template_ord,
      deckName: card.deck_name,
    });

    const tracks = extractPodcastTracks(card, rendered);

    // 1. Play Word Audio (الكلمة)
    setPhase('word');
    let playedWord = false;
    if (tracks.wordAudio) {
      playedWord = await audioService.playAndWait(tracks.wordAudio);
    }
    if (!playedWord && tracks.wordText) {
      await new Promise<void>((resolve) => {
        TtsService.speak(tracks.wordText, {
          rate: speechRate,
          onDone: () => resolve(),
          onError: () => resolve(),
        });
      });
    }

    if (!isPlayingRef.current) return;

    // 2. Thinking Pause (فترة التفكير للتذكر)
    if (thinkingSeconds > 0) {
      setPhase('thinking');
      for (let s = thinkingSeconds; s > 0; s--) {
        if (!isPlayingRef.current) return;
        setRemainingThinking(s);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setRemainingThinking(0);
    }

    if (!isPlayingRef.current) return;

    // 3. Play Explanation Audio (مقطع الشرح / المعنى)
    setPhase('explanation');
    let playedExp = false;
    if (tracks.explanationAudio) {
      playedExp = await audioService.playAndWait(tracks.explanationAudio);
    }
    if (!playedExp && tracks.explanationText && !tracks.explanationText.includes('<img')) {
      await new Promise<void>((resolve) => {
        TtsService.speak(tracks.explanationText, {
          rate: speechRate,
          onDone: () => resolve(),
          onError: () => resolve(),
        });
      });
    }

    if (!isPlayingRef.current) return;

    // Brief natural pause between explanation and example
    await new Promise((r) => setTimeout(r, 700));

    if (!isPlayingRef.current) return;

    // 4. Play Example Audio (مقطع المثال)
    if (tracks.exampleAudio || (tracks.exampleText && !tracks.exampleText.includes('<img'))) {
      setPhase('example');
      let playedEx = false;
      if (tracks.exampleAudio) {
        playedEx = await audioService.playAndWait(tracks.exampleAudio);
      }
      if (!playedEx && tracks.exampleText) {
        await new Promise<void>((resolve) => {
          TtsService.speak(tracks.exampleText, {
            rate: speechRate,
            onDone: () => resolve(),
            onError: () => resolve(),
          });
        });
      }
    }

    if (!isPlayingRef.current) return;

    // 5. Play any extra audio clips on the card
    for (const extra of tracks.extraAudios) {
      if (!isPlayingRef.current) return;
      await new Promise((r) => setTimeout(r, 500));
      await audioService.playAndWait(extra);
    }

    if (!isPlayingRef.current) return;

    // 6. Brief pause before advancing to next card
    setPhase('wait_next');
    await new Promise((r) => setTimeout(r, 1200));

    if (!isPlayingRef.current) return;

    // 7. Advance to next card
    if (currentIndexRef.current + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsPlaying(false);
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (isPlaying) {
      playCurrentCard();
    } else {
      TtsService.stop();
      audioService.stop();
      setPhase('idle');
    }
  }, [isPlaying, currentIndex]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      TtsService.stop();
      audioService.stop();
    } else {
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    TtsService.stop();
    audioService.stop();
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    TtsService.stop();
    audioService.stop();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleReplay = () => {
    TtsService.stop();
    audioService.stop();
    if (isPlaying) {
      playCurrentCard();
    }
  };

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

  const currentCard = queue[currentIndex];
  const rendered = currentCard
    ? renderCard({
        frontTemplate: currentCard.front_template,
        backTemplate: currentCard.back_template,
        fields: currentCard.note_fields,
        css: currentCard.css,
        templateOrd: currentCard.template_ord,
        deckName: currentCard.deck_name,
      })
    : null;

  const currentTracks = currentCard ? extractPodcastTracks(currentCard, rendered) : null;

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
        onBack={() => {
          TtsService.stop();
          audioService.stop();
          router.back();
        }}
      />

      <View style={styles.content}>
        {/* Progress & Counter */}
        <View style={styles.progressRow}>
          <Text style={[styles.counterText, { color: theme.colors.textMuted }]}>
            {currentIndex + 1} / {queue.length}
          </Text>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <ProgressBar progress={(currentIndex + 1) / queue.length} height={8} />
          </View>
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
            {currentTracks?.wordText || '...'}
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Explanation & Example (Back) */}
          <Text style={[styles.previewLabel, { color: theme.colors.accent, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl ? 'الشرح والمثال' : (t('card.back') || 'Explanation & Example')}
          </Text>

          {phase !== 'word' && phase !== 'thinking' ? (
            <View>
              {currentTracks?.explanationText ? (
                <Text
                  style={[
                    styles.previewText,
                    {
                      color: phase === 'explanation' ? theme.colors.primary : theme.colors.text,
                      fontWeight: phase === 'explanation' ? 'bold' : '600',
                      textAlign: rtl ? 'right' : 'left',
                      marginBottom: currentTracks?.exampleText ? 6 : 0,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {currentTracks.explanationText}
                </Text>
              ) : null}

              {currentTracks?.exampleText ? (
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
                  "{currentTracks.exampleText}"
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
        <View style={styles.settingsRow}>
          <View style={styles.chipGroup}>
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

          <View style={styles.chipGroup}>
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
        <View style={styles.mediaBar}>
          <TouchableOpacity style={styles.secControlBtn} onPress={handlePrev} activeOpacity={0.7}>
            <Ionicons name="play-skip-back" size={26} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secControlBtn} onPress={handleReplay} activeOpacity={0.7}>
            <Ionicons name="repeat" size={24} color={theme.colors.text} />
          </TouchableOpacity>

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

          <TouchableOpacity style={styles.secControlBtn} onPress={handleNext} activeOpacity={0.7}>
            <Ionicons name="play-skip-forward" size={26} color={theme.colors.text} />
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
    gap: 20,
    paddingBottom: 16,
  },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderBottomWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
