import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter, Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useDirection } from '../../theme';
import {
  Screen,
  Header,
  Card,
  Row,
  AppText,
  Badge,
  Button,
  StatTile,
  SectionHeader,
  ChoiceChips,
  ProgressRing,
  IconTile,
} from '../../components/ui';
import { Illustration } from '../../components/illustrations';
import { useQuizResults, AnswerDetail, ResultFilter } from '../../features/quiz/useQuizResults';
import { AnswerReviewCard } from '../../features/quiz/components/AnswerReviewCard';
import { OverrideSheet } from '../../features/quiz/components/OverrideSheet';

const KNOWN_MODES = ['random', 'exam', 'survival', 'matching', 'mistakes', 'written_ai', 'mixed', 'practice'];

export default function QuizResultsScreen() {
  const { score = '0', xp = '0', mode = 'random', attemptId } = useLocalSearchParams<{
    score?: string;
    correct?: string;
    total?: string;
    xp?: string;
    mode?: string;
    attemptId?: string;
  }>();
  const { t } = useTranslation();
  const dir = useDirection();
  const router = useRouter();
  const r = useQuizResults({ score, xp, attemptId });
  const [overrideTarget, setOverrideTarget] = useState<AnswerDetail | null>(null);

  const modeKey = mode.toLowerCase() === 'match' ? 'matching' : mode.toLowerCase();
  const modeName = KNOWN_MODES.includes(modeKey) ? t(`quiz_results.mode_${modeKey}`) : mode.toUpperCase();

  const filterOptions: { value: ResultFilter; label: string }[] = [
    { value: 'all', label: t('quiz_results.filter_all', { count: r.counts.all }) },
    ...(r.counts.incorrect > 0 ? [{ value: 'incorrect' as const, label: t('quiz_results.filter_incorrect', { count: r.counts.incorrect }) }] : []),
    ...(r.counts.partial > 0 ? [{ value: 'partial' as const, label: t('quiz_results.filter_partial', { count: r.counts.partial }) }] : []),
    { value: 'correct', label: t('quiz_results.filter_correct', { count: r.counts.correct }) },
  ];

  return (
    <Screen
      decor
      header={<Header title={t('quiz_results.title')} onBack={() => router.replace('/(tabs)/quiz')} />}
      overlay={<OverrideSheet answer={overrideTarget} onClose={() => setOverrideTarget(null)} onSave={r.applyOverride} />}
    >
      {/* Hero */}
      <Card variant="gradient" padding={18} style={{ marginBottom: 16 }}>
        <Row gap={10}>
          <View style={{ flex: 1 }}>
            <Row gap={6} style={{ alignSelf: dir.alignStart, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Ionicons name="game-controller" size={13} color="#FFFFFF" />
              <AppText variant="caption" weight="extrabold" color="#FFFFFF">
                {modeName}
              </AppText>
            </Row>
            <AppText variant="h1" color="#FFFFFF">
              {r.passed ? t('quiz_results.passed') : t('quiz_results.keep_going')}
            </AppText>
            <View style={{ marginTop: 10 }}>
              <ProgressRing
                progress={r.score / 100}
                size={96}
                strokeWidth={10}
                color="#FFFFFF"
                trackColor="rgba(255,255,255,0.22)"
                textColor="#FFFFFF"
                label={`${r.score}%`}
              />
            </View>
          </View>
          <Illustration name={r.passed ? 'all-done' : 'learn'} size={150} backdrop={false} onColor />
        </Row>
      </Card>

      <Row gap={8} align="stretch" style={{ marginBottom: 16 }}>
        <StatTile layout="compact" icon="checkmark-circle" tone="green" value={r.counts.correct} label={t('quiz_results.correct')} />
        <StatTile layout="compact" icon="alert-circle" tone="amber" value={r.counts.partial} label={t('quiz_results.partial')} />
        <StatTile layout="compact" icon="close-circle" tone="rose" value={r.counts.incorrect} label={t('quiz_results.incorrect')} />
        <StatTile layout="compact" icon="flash" tone="orange" value={`+${r.xp}`} label={t('quiz_results.xp')} />
      </Row>

      {!!r.aiSummary && (
        <Card variant="tinted" tone="violet" style={{ marginBottom: 18 }}>
          <Row gap={10} style={{ marginBottom: 6 }}>
            <IconTile icon="sparkles" tone="violet" size={32} variant="solid" />
            <AppText variant="title" weight="extrabold" style={{ flex: 1 }}>
              {t('quiz_results.ai_summary')}
            </AppText>
          </Row>
          <AppText variant="bodySm">{r.aiSummary}</AppText>
        </Card>
      )}

      <SectionHeader
        title={t('quiz_results.answers_title')}
        icon="list"
        tone="sky"
        trailing={<Badge size="sm" label={t('quiz_results.shown_of', { shown: r.filtered.length, total: r.answers.length })} />}
      />
      <ChoiceChips layout="scroll" options={filterOptions} value={r.filter} onChange={r.setFilter} />

      {r.filtered.map((ans, idx) => (
        <AnswerReviewCard
          key={ans.id || idx}
          answer={ans}
          index={idx}
          expanded={r.expandedIds.has(ans.id)}
          onToggle={() => r.toggleExpand(ans.id)}
          onOverride={() => setOverrideTarget(ans)}
        />
      ))}

      {r.counts.incorrect > 0 ? (
        <Card variant="tinted" tone="amber" style={{ marginTop: 8, marginBottom: 14 }}>
          <Row gap={10} style={{ marginBottom: 12 }}>
            <IconTile icon="bookmark" tone="amber" size={34} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {t('quiz_results.mistakes_count', { count: r.counts.incorrect })}
            </AppText>
          </Row>
          <Row gap={10}>
            <Button title={t('quiz_results.filter_mistakes')} icon="funnel" variant="soft" onPress={() => r.setFilter('incorrect')} style={{ flex: 1 }} />
            <Button title={t('quiz_results.save_notebook')} icon="save" variant="ghost" onPress={r.saveMistakesToNotebook} style={{ flex: 1 }} />
          </Row>
        </Card>
      ) : (
        <Card variant="tinted" tone="green" style={{ marginTop: 8, marginBottom: 14 }}>
          <Row gap={10} justify="center">
            <IconTile icon="sparkles" tone="green" size={32} />
            <AppText variant="bodyStrong">{t('quiz_results.perfect')}</AppText>
          </Row>
        </Card>
      )}

      <Row gap={10}>
        <Button title={t('quiz_results.try_again')} icon="refresh" size="lg" onPress={() => router.replace(`/quiz/play?mode=${mode}` as Href)} style={{ flex: 1 }} />
        <Button title={t('quiz_results.all_quizzes')} icon="grid" variant="ghost" size="lg" onPress={() => router.replace('/(tabs)/quiz')} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
