import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection, alpha, ToneName } from '../../theme';
import { Header, Card, Row, AppText, ProgressBar, ChoiceChips, IconButton, PressableScale, GradientFill, EmptyState, IconName } from '../../components/ui';
import { queueBuilder } from '../../core/scheduler/queueBuilder';
import { deckRepository } from '../../core/db/repositories/deckRepository';
import { usePodcastPlayer } from '../../core/audio/usePodcastPlayer';

const THINKING_OPTIONS = [2, 3, 5, 8];
const SPEED_OPTIONS = [0.8, 1.0, 1.2];
const ORB = 168;

const PHASES: Record<string, { tone: ToneName; icon: IconName; key: string }> = {
  word: { tone: 'blue', icon: 'volume-medium', key: 'podcast.phase_word' },
  thinking: { tone: 'amber', icon: 'hourglass', key: 'podcast.phase_thinking' },
  explanation: { tone: 'green', icon: 'volume-high', key: 'podcast.phase_explanation' },
  example: { tone: 'violet', icon: 'chatbubble-ellipses', key: 'podcast.phase_example' },
  wait_next: { tone: 'sky', icon: 'play-skip-forward', key: 'podcast.phase_next' },
  idle: { tone: 'slate', icon: 'headset', key: 'podcast.phase_idle' },
};

export default function PodcastModeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId: string }>();
  const { t } = useTranslation();
  const { colors, tone, shadow } = useTheme();
  const dir = useDirection();
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;

  const p = usePodcastPlayer();

  // Load the deck's cards into the global background player.
  useEffect(() => {
    (async () => {
      // Don't restart a queue that's already playing.
      if (p.queue.length > 0 && p.isPlaying) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (params.deckId) deckRepository.setLastStudiedDeckId(params.deckId).catch(() => {});
        const [review, learn] = await Promise.all([
          queueBuilder.buildReviewQueue(params.deckId),
          queueBuilder.buildLearnQueue(params.deckId),
        ]);
        let all = [...review, ...learn];
        // Nothing due: listen to the whole deck instead.
        if (all.length === 0) all = await queueBuilder.buildReviewQueue(params.deckId, undefined, 'all');
        p.setQueue(all, 0, all[0]?.deck_name || 'Flashcards Podcast');
      } catch (e) {
        console.warn('Failed to load queue for podcast mode:', e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.deckId]);

  // Pulse while audio is speaking.
  useEffect(() => {
    if (p.phase === 'word' || p.phase === 'explanation' || p.phase === 'example') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [p.phase, pulse]);

  const header = <Header title={t('study.podcastMode')} icon="headset" iconTone="sky" onBack={() => router.back()} />;

  if (loading || p.queue.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator size="large" color={colors.primary} /> : <EmptyState illustration="audio" title={t('podcast.empty')} description="" />}
        </View>
      </SafeAreaView>
    );
  }

  const phase = PHASES[p.phase] ?? PHASES.idle;
  const phaseTone = tone(phase.tone);
  const revealed = p.phase !== 'word' && p.phase !== 'thinking';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Row gap={12} style={{ marginBottom: 12 }}>
          <AppText variant="bodySm" weight="extrabold" color="textMuted">
            {p.currentIndex + 1} / {p.queue.length}
          </AppText>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={(p.currentIndex + 1) / p.queue.length} height={8} />
          </View>
        </Row>

        <Row
          gap={8}
          justify="center"
          style={{
            alignSelf: 'center',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: p.isPlaying ? alpha(colors.primary, 0.12) : colors.surface,
          }}
        >
          <Ionicons name={p.isPlaying ? 'radio' : 'pause-circle'} size={15} color={p.isPlaying ? colors.primary : colors.textMuted} />
          <AppText variant="caption" weight="bold" color={p.isPlaying ? 'primary' : 'textMuted'}>
            {p.isPlaying ? t('podcast.bg_playing') : t('podcast.bg_paused')}
          </AppText>
        </Row>

        {/* Orb */}
        <View style={{ alignItems: 'center', marginVertical: 22 }}>
          <View style={{ width: ORB + 56, height: ORB + 56, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: ORB + 56, height: ORB + 56, borderRadius: 999, backgroundColor: alpha(phaseTone.fg, 0.08) }} />
            <View style={{ position: 'absolute', width: ORB + 26, height: ORB + 26, borderRadius: 999, backgroundColor: alpha(phaseTone.fg, 0.12) }} />
            <Animated.View style={[{ width: ORB, height: ORB, borderRadius: ORB / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pulse }] }, shadow(3, phaseTone.solid)]}>
              <GradientFill colors={[phaseTone.fg, phaseTone.solid]} radius={ORB / 2} />
              <Ionicons name={phase.icon} size={60} color="#FFFFFF" />
            </Animated.View>
          </View>
          <AppText variant="h3" align="center" style={{ marginTop: 6 }}>
            {t(phase.key, { count: p.remainingThinking })}
          </AppText>
        </View>

        {/* Card preview */}
        <Card style={{ marginBottom: 16 }}>
          <AppText variant="caption" weight="extrabold" color="primary">
            {t('podcast.front_label')}
          </AppText>
          <AppText variant="h3" numberOfLines={2} style={{ marginTop: 2 }}>
            {p.tracks?.wordText || '…'}
          </AppText>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
          <AppText variant="caption" weight="extrabold" color="accent">
            {t('podcast.back_label')}
          </AppText>
          {revealed ? (
            <>
              {!!p.tracks?.explanationText && (
                <AppText variant="body" weight={p.phase === 'explanation' ? 'extrabold' : 'semibold'} color={p.phase === 'explanation' ? 'primary' : 'text'} numberOfLines={2} style={{ marginTop: 2 }}>
                  {p.tracks.explanationText}
                </AppText>
              )}
              {!!p.tracks?.exampleText && (
                <AppText variant="bodySm" color={p.phase === 'example' ? tone('violet').fg : 'textSecondary'} numberOfLines={3} style={{ fontStyle: 'italic', marginTop: 6 }}>
                  “{p.tracks.exampleText}”
                </AppText>
              )}
            </>
          ) : (
            <AppText variant="body" color="textMuted" style={{ marginTop: 2 }}>
              ••••••••••••
            </AppText>
          )}
        </Card>

        <ChoiceChips
          label={t('podcast.thinking')}
          labelIcon="hourglass"
          options={THINKING_OPTIONS.map((s) => ({ value: s, label: `${s}s` }))}
          value={p.thinkingSeconds}
          onChange={p.setThinkingSeconds}
        />
        <ChoiceChips
          label={t('podcast.speed')}
          labelIcon="speedometer"
          options={SPEED_OPTIONS.map((r) => ({ value: r, label: `${r}x` }))}
          value={p.speechRate}
          onChange={p.setSpeechRate}
        />
      </ScrollView>

      {/* Transport */}
      <Row justify="space-evenly" style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
        <IconButton icon={dir.pick('play-skip-back', 'play-skip-forward')} onPress={p.prev} size={48} accessibilityLabel={t('podcast.prev')} />
        <IconButton icon="repeat" onPress={p.replayCurrent} size={48} accessibilityLabel={t('podcast.replay')} />
        <PressableScale
          onPress={p.togglePlay}
          haptic
          activeScale={0.92}
          accessibilityLabel={p.isPlaying ? t('podcast.pause') : t('podcast.play')}
          style={[{ width: 74, height: 74, borderRadius: 37, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, shadow(3, colors.primary)]}
        >
          <GradientFill colors={[colors.primary, colors.accent]} radius={37} />
          <Ionicons name={p.isPlaying ? 'pause' : 'play'} size={34} color="#FFFFFF" style={{ marginLeft: p.isPlaying ? 0 : 3 }} />
        </PressableScale>
        <IconButton icon={dir.pick('play-skip-forward', 'play-skip-back')} onPress={p.next} size={48} accessibilityLabel={t('podcast.next')} />
        <IconButton icon="stop" variant="danger" onPress={p.stop} size={48} accessibilityLabel={t('podcast.stop')} />
      </Row>
    </SafeAreaView>
  );
}
