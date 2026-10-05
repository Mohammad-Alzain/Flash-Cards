import React from 'react';
import { View, ScrollView, Image, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection, alpha, fontFamilyFor, ToneName } from '../../theme';
import { AppText, Row, Card, Button, IconButton, ProgressBar, Badge, EmptyState, IconName } from '../../components/ui';
import { useQuizSession, formatClock } from '../../features/quiz/useQuizSession';
import {
  QuizOption,
  TrueFalseButtons,
  MatchingBoard,
  FeedbackPanel,
  GradingOverlay,
} from '../../features/quiz/components/QuizPlayParts';
import type { QuestionType } from '../../core/quiz/types';

const TYPE_META: Partial<Record<QuestionType, { icon: IconName; tone: ToneName; key: string }>> = {
  type_answer: { icon: 'create', tone: 'violet', key: 'quiz_play.type_written' },
  matching: { icon: 'git-compare', tone: 'amber', key: 'quiz_play.type_matching' },
  multiple_choice: { icon: 'list', tone: 'sky', key: 'quiz_play.type_choice' },
  true_false: { icon: 'help-circle', tone: 'teal', key: 'quiz_play.type_tf' },
};

export default function QuizPlayScreen() {
  const { colors, tone, shape } = useTheme();
  const dir = useDirection();
  const { t } = useTranslation();
  const router = useRouter();
  const s = useQuizSession();

  if (s.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText variant="bodySm" color="textSecondary" style={{ marginTop: 12 }}>
          {t('common.loading')}
        </AppText>
      </SafeAreaView>
    );
  }

  if (s.questions.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <EmptyState
          illustration="quiz"
          title={t('quiz_play.no_cards_title')}
          description={t('quiz_play.no_cards_desc')}
          actionTitle={t('quiz_play.back_to_quizzes')}
          actionIcon={dir.arrowBackIcon}
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const q = s.currentQ;
  const meta = TYPE_META[q.type] ?? TYPE_META.multiple_choice!;
  const metaTone = tone(meta.tone);
  const answeredInstant = !s.isSilentMode && s.isAnswerSubmitted;
  const lowTime = s.remainingSeconds < 30;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {/* Top bar */}
      <Row gap={10} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        <IconButton icon="close" onPress={s.confirmExit} size={40} accessibilityLabel={t('quiz_play.exit')} />
        <View style={{ flex: 1 }}>
          <ProgressBar progress={(s.currentIndex + 1) / s.questions.length} height={10} />
        </View>
        {s.isTimerActive && (
          <Badge variant={lowTime ? 'error' : 'neutral'} solid={lowTime} icon="timer" label={formatClock(s.remainingSeconds)} />
        )}
        {s.isSilentMode && (
          <IconButton
            icon={s.isMarked ? 'bookmark' : 'bookmark-outline'}
            variant={s.isMarked ? 'tinted' : 'surface'}
            onPress={s.toggleReviewLater}
            size={40}
            accessibilityLabel={t('quiz_play.review_later')}
          />
        )}
        {s.mode === 'survival' ? (
          <Row gap={2}>
            {Array.from({ length: s.maxLives }).map((_, i) => (
              <Ionicons key={i} name={i < s.lives ? 'heart' : 'heart-outline'} size={22} color={i < s.lives ? colors.error : colors.textMuted} />
            ))}
          </Row>
        ) : (
          <Badge variant="primary" label={t('quiz_play.question_of', { current: s.currentIndex + 1, total: s.questions.length })} />
        )}
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 180 }} keyboardShouldPersistTaps="handled">
        {/* Question type pill */}
        <Row gap={6} style={{ alignSelf: dir.alignStart, marginBottom: 10, backgroundColor: metaTone.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
          <Ionicons name={meta.icon} size={14} color={metaTone.fg} />
          <AppText variant="caption" weight="extrabold" color={metaTone.fg}>
            {t(meta.key)}
          </AppText>
        </Row>

        {/* Prompt */}
        <Card style={{ marginBottom: 18, minHeight: 130, alignItems: 'center', justifyContent: 'center', paddingVertical: 22 }}>
          {!!q.promptImage && (
            <Image source={{ uri: q.promptImage }} style={{ width: '100%', height: 180, borderRadius: 14, marginBottom: 10 }} resizeMode="contain" />
          )}
          {!!q.prompt && (
            <AppText variant={q.type === 'matching' ? 'title' : 'h2'} align="center">
              {q.type === 'matching' ? t('quiz_play.match_prompt') : q.prompt}
            </AppText>
          )}
          {q.type === 'true_false' && !!q.tfPresentedAnswer && (
            <View style={{ marginTop: 14, padding: 12, borderRadius: 16, width: '100%', alignItems: 'center', backgroundColor: colors.surface }}>
              <AppText variant="caption" color="textSecondary" align="center">
                {t('quiz_play.presented_answer')}
              </AppText>
              <AppText variant="h3" align="center" style={{ marginTop: 2 }}>
                “{q.tfPresentedAnswer}”
              </AppText>
            </View>
          )}
        </Card>

        {/* Written */}
        {q.type === 'type_answer' && (
          <View>
            <AppText variant="bodySm" weight="bold" color="textSecondary" style={{ marginBottom: 8 }}>
              {t('quiz_play.write_label')}
            </AppText>
            <TextInput
              value={s.writtenAnswer}
              onChangeText={s.setWrittenAnswer}
              placeholder={t('quiz_play.write_placeholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              autoCorrect={false}
              autoCapitalize="none"
              textAlign={dir.textAlign}
              cursorColor={colors.primary}
              style={{
                minHeight: 130,
                borderRadius: shape.input,
                borderWidth: 2,
                borderColor: s.writtenAnswer ? colors.primary : colors.border,
                backgroundColor: colors.surfaceRaised,
                padding: 14,
                fontSize: 16,
                color: colors.text,
                textAlignVertical: 'top',
                fontFamily: fontFamilyFor('semibold', dir.arabic),
              }}
            />
            <Row gap={8} align="flex-start" style={{ marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: alpha(colors.warning, 0.1) }}>
              <Ionicons name="bulb" size={16} color={colors.warning} />
              <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                {t('quiz_play.write_hint')}
              </AppText>
            </Row>
          </View>
        )}

        {/* Multiple choice */}
        {q.type === 'multiple_choice' &&
          q.options?.map((opt, i) => (
            <QuizOption
              key={i}
              index={i}
              label={opt}
              selected={s.isSilentMode && s.selectedChoice === opt}
              disabled={answeredInstant}
              onPress={() => s.answerChoice(opt)}
            />
          ))}

        {/* True / false */}
        {q.type === 'true_false' && (
          <TrueFalseButtons
            selected={s.isSilentMode ? s.selectedChoice : undefined}
            disabled={answeredInstant}
            onAnswer={(v) => s.answerChoice(v)}
          />
        )}

        {/* Matching */}
        {q.type === 'matching' && (
          <>
            <AppText variant="bodySm" color="textSecondary" align="center" style={{ marginBottom: 12 }}>
              {t('quiz_play.match_hint')}
            </AppText>
            <MatchingBoard s={s} />
          </>
        )}
      </ScrollView>

      {/* Silent-mode navigation */}
      {s.isSilentMode && (
        <SafeAreaView
          edges={['bottom']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 10,
            backgroundColor: colors.surfaceRaised,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Row gap={8}>
            <Button
              title={t('quiz_play.prev')}
              icon={dir.backIcon}
              variant="ghost"
              disabled={s.currentIndex === 0}
              onPress={s.goPrev}
            />
            <Button title={t('quiz_play.skip')} variant="soft" onPress={s.goNextOrFinish} style={{ flex: 1 }} />
            {s.currentIndex + 1 < s.questions.length ? (
              <Button title={t('quiz_play.next')} icon={dir.forwardIcon} iconPosition="right" onPress={s.goNextOrFinish} style={{ flex: 1.3 }} />
            ) : (
              <Button
                title={s.mode === 'written_ai' || s.mode === 'mixed' ? t('quiz_play.finish_grade') : t('quiz_play.finish')}
                icon="checkmark-done"
                variant="success"
                onPress={s.finishSilent}
                style={{ flex: 1.6 }}
              />
            )}
          </Row>
        </SafeAreaView>
      )}

      {answeredInstant && <FeedbackPanel s={s} />}
      <GradingOverlay visible={s.isGrading} status={s.gradingStatus} />
    </SafeAreaView>
  );
}
