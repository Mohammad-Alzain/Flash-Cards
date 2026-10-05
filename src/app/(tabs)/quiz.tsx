import React from 'react';
import { View } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ToneName } from '../../theme';
import {
  Screen,
  Header,
  Card,
  Row,
  AppText,
  SectionHeader,
  ChoiceChips,
  EmptyState,
  Badge,
  IconName,
} from '../../components/ui';
import { Illustration } from '../../components/illustrations';
import { useQuizSetup, QUESTION_COUNTS, TIME_LIMITS, QuizMode, SmartFocus } from '../../features/quiz/useQuizSetup';
import { QuizModeCard } from '../../features/quiz/components/QuizModeCard';

const MODES: { id: QuizMode; icon: IconName; tone: ToneName }[] = [
  { id: 'written_ai', icon: 'sparkles', tone: 'violet' },
  { id: 'mixed', icon: 'layers', tone: 'sky' },
  { id: 'exam', icon: 'school', tone: 'amber' },
  { id: 'survival', icon: 'heart', tone: 'rose' },
];

const truncate = (name: string, max = 14) => (name.length > max ? `${name.slice(0, max)}…` : name);

export default function QuizScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const s = useQuizSetup();

  const modeText: Record<QuizMode, { title: string; desc: string }> = {
    written_ai: { title: t('quiz.written_ai_title'), desc: t('quiz.written_ai_desc') },
    mixed: { title: t('quiz.mixed_title'), desc: t('quiz.mixed_desc') },
    exam: { title: t('quiz.exam_title'), desc: t('quiz.exam_desc') },
    survival: { title: t('quiz.survival_title'), desc: t('quiz.survival_desc') },
  };

  const focusOptions: { value: SmartFocus; label: string; icon: IconName }[] = [
    { value: 'all', label: t('quiz.focus_all'), icon: 'shuffle' },
    { value: 'hardest', label: t('quiz.focus_hardest'), icon: 'barbell' },
    { value: 'due', label: t('quiz.focus_due'), icon: 'alarm' },
    { value: 'new', label: t('quiz.focus_new'), icon: 'sparkles' },
  ];
  if (s.mistakesCount > 0) {
    focusOptions.push({ value: 'mistakes', label: t('quiz.focus_mistakes', { count: s.mistakesCount }), icon: 'alert-circle' });
  }

  const deckOptions = [
    { value: '__all__', label: t('quiz.all_decks', { count: s.totalCards }), icon: 'library' as IconName },
    ...s.decks.map((d) => ({
      value: d.id,
      label: t('quiz.deck_chip', { name: truncate(d.name), count: d.total_card_count ?? d.card_count }),
    })),
  ];

  const noCards = s.totalCards === 0;

  return (
    <Screen
      decor
      tabBarSpace
      header={<Header large title={t('quiz.title')} subtitle={t('quiz.modes_title')} icon="sparkles" iconTone="violet" />}
    >
      {/* Hero */}
      <Card variant="gradient" padding={18} style={{ marginBottom: 20 }}>
        <Row gap={10}>
          <View style={{ flex: 1 }}>
            <AppText variant="h2" color="#FFFFFF">
              {t('quiz.hero_title')}
            </AppText>
            <AppText variant="bodySm" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
              {t('quiz.subtitle')}
            </AppText>
          </View>
          <Illustration name="quiz" size={120} backdrop={false} onColor />
        </Row>
      </Card>

      {noCards ? (
        <EmptyState
          compact
          illustration="import"
          title={t('quiz.no_cards_title')}
          description={t('quiz.no_cards_desc')}
          actionTitle={t('quiz.import_now')}
          actionIcon="cloud-download"
          onAction={() => router.push('/import')}
        />
      ) : (
        <>
          {/* Step 1: deck */}
          <SectionHeader
            title={t('quiz.step_deck')}
            icon="albums"
            tone="indigo"
            trailing={<Badge size="sm" variant="primary" label={t('quiz.deck_cards', { count: s.availableCards })} />}
          />
          <ChoiceChips
            layout="scroll"
            options={deckOptions}
            value={s.deckId ?? '__all__'}
            onChange={(v) => s.setDeckId(v === '__all__' ? null : v)}
            style={{ marginBottom: 20 }}
          />

          {/* Step 2: setup */}
          <SectionHeader title={t('quiz.step_setup')} icon="options" tone="sky" />
          <Card style={{ marginBottom: 20, paddingBottom: 2 }}>
            <ChoiceChips
              label={t('quiz.count_label')}
              labelIcon="list"
              options={QUESTION_COUNTS.map((c) => ({
                value: c as number,
                label: c === 0 ? t('quiz.count_all') : t('quiz.count_n', { count: c }),
              }))}
              value={s.count}
              onChange={s.setCount}
            />
            <ChoiceChips
              label={t('quiz.focus_label')}
              labelIcon="bulb"
              options={focusOptions}
              value={s.focus}
              onChange={s.setFocus}
            />
            <ChoiceChips
              label={t('quiz.timer_label')}
              labelIcon="timer"
              options={TIME_LIMITS.map((sec) => ({
                value: sec as number,
                label: sec === 0 ? t('quiz.timer_none') : t('quiz.timer_min', { count: sec / 60 }),
              }))}
              value={s.timeLimit}
              onChange={s.setTimeLimit}
            />
            {s.fields.length > 0 && (
              <>
                <ChoiceChips
                  layout="scroll"
                  label={t('quiz.question_field')}
                  labelIcon="help-circle"
                  options={[{ value: s.AUTO, label: t('quiz.auto_front') }, ...s.fields.map((f) => ({ value: f, label: f }))]}
                  value={s.questionField}
                  onChange={s.setQuestionField}
                />
                <ChoiceChips
                  layout="scroll"
                  label={t('quiz.answer_field')}
                  labelIcon="checkmark-circle"
                  options={[{ value: s.AUTO, label: t('quiz.auto_back') }, ...s.fields.map((f) => ({ value: f, label: f }))]}
                  value={s.answerField}
                  onChange={s.setAnswerField}
                />
              </>
            )}
          </Card>

          {/* Step 3: mode */}
          <SectionHeader title={t('quiz.modes_title')} icon="game-controller" tone="pink" />
          {MODES.map((m) => (
            <QuizModeCard
              key={m.id}
              title={modeText[m.id].title}
              description={modeText[m.id].desc}
              icon={m.icon}
              tone={m.tone}
              startLabel={t('quiz.start')}
              onStart={() => router.push(s.buildPlayHref(m.id) as Href)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
