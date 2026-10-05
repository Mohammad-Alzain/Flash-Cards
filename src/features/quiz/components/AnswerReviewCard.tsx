import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection, alpha } from '../../../theme';
import { AppText, Row, Badge, Button, PressableScale, IconName } from '../../../components/ui';
import { cleanTextForQuiz } from '../../../core/quiz/generator';
import { AnswerDetail, verdictOf, extractQuestionPrompt } from '../useQuizResults';

interface AnswerReviewCardProps {
  answer: AnswerDetail;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onOverride: () => void;
}

const Block: React.FC<{ icon: IconName; label: string; color: string; children: React.ReactNode; tinted?: boolean }> = ({
  icon,
  label,
  color,
  children,
  tinted,
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 14,
        backgroundColor: tinted ? alpha(color, 0.08) : colors.surface,
        borderWidth: 1,
        borderColor: tinted ? alpha(color, 0.3) : colors.border,
      }}
    >
      <Row gap={6} style={{ marginBottom: 4 }}>
        <Ionicons name={icon} size={15} color={color} />
        <AppText variant="caption" weight="extrabold" color={color}>
          {label}
        </AppText>
      </Row>
      {children}
    </View>
  );
};

/** Expandable answer row: verdict, prompt and the my-answer / card-answer / AI comparison. */
export const AnswerReviewCard: React.FC<AnswerReviewCardProps> = ({ answer, index, expanded, onToggle, onOverride }) => {
  const { colors, tone, shadow } = useTheme();
  const dir = useDirection();
  const { t } = useTranslation();
  const verdict = verdictOf(answer);
  const color = verdict === 'correct' ? tone('green').fg : verdict === 'partial' ? colors.warning : colors.error;
  const verdictIcon: IconName = verdict === 'correct' ? 'checkmark-circle' : verdict === 'partial' ? 'alert-circle' : 'close-circle';
  const verdictLabel =
    verdict === 'correct'
      ? t('quiz_results.correct')
      : verdict === 'partial'
      ? t('quiz_results.partial_pct', { pct: Math.round((answer.ai_score || 0.5) * 100) })
      : t('quiz_results.incorrect');
  const prompt = extractQuestionPrompt(answer.fields_json);

  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceRaised,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 12,
          overflow: 'hidden',
        },
        shadow(1),
      ]}
    >
      <View style={[{ position: 'absolute', top: 0, bottom: 0, width: 5, backgroundColor: color }, dir.start(0)]} />
      <PressableScale onPress={onToggle} activeScale={0.99} style={{ padding: 14 }}>
        <Row gap={8}>
          <Ionicons name={verdictIcon} size={22} color={color} />
          <AppText variant="bodyStrong" weight="extrabold" color="textSecondary">
            {t('quiz_results.question_n', { n: index + 1 })}
          </AppText>
          {answer.is_marked_for_review === 1 && <Ionicons name="bookmark" size={15} color={colors.warning} />}
          {answer.question_type === 'type_answer' && <Badge size="sm" variant="accent" label={t('quiz_results.written')} />}
          {!!answer.manual_override && <Badge size="sm" variant="warning" label={t('quiz_results.overridden')} />}
          <View style={{ flex: 1 }} />
          <Badge size="sm" variant={verdict === 'correct' ? 'success' : verdict === 'partial' ? 'warning' : 'error'} label={verdictLabel} />
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </Row>
        {!!prompt && (
          <AppText variant="body" weight="bold" style={{ marginTop: 8 }}>
            {prompt}
          </AppText>
        )}
      </PressableScale>

      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
          <Block icon="person" label={t('quiz_results.my_answer')} color={color} tinted>
            <AppText variant="bodySm" weight="semibold">
              {answer.user_answer || t('quiz_results.empty_answer')}
            </AppText>
          </Block>
          <Block icon="card" label={t('quiz_results.card_answer')} color={colors.primary}>
            <AppText variant="bodySm" weight="semibold">
              {cleanTextForQuiz(answer.correct_answer)}
            </AppText>
          </Block>
          {(!!answer.ai_answer || !!answer.ai_feedback) && (
            <Block icon="sparkles" label={t('quiz_results.ai_evaluation')} color={tone('violet').fg} tinted>
              {answer.ai_confidence !== undefined && answer.ai_confidence !== null && (
                <AppText variant="caption" color="textMuted" style={{ marginBottom: 4 }}>
                  {t('quiz_results.confidence', { pct: Math.round(answer.ai_confidence * 100) })}
                </AppText>
              )}
              {!!answer.ai_answer && (
                <View style={{ marginBottom: 6 }}>
                  <AppText variant="caption" weight="bold" color="textSecondary">
                    {t('quiz_results.ai_answer')}
                  </AppText>
                  <AppText variant="bodySm" style={{ fontStyle: 'italic' }}>
                    {answer.ai_answer}
                  </AppText>
                </View>
              )}
              {!!answer.ai_feedback && (
                <View style={{ marginBottom: 6 }}>
                  <AppText variant="caption" weight="bold" color="textSecondary">
                    {t('quiz_results.ai_feedback')}
                  </AppText>
                  <AppText variant="bodySm">{answer.ai_feedback}</AppText>
                </View>
              )}
              {!!answer.ai_tip && (
                <Row gap={6} align="flex-start" style={{ padding: 8, borderRadius: 10, backgroundColor: alpha(colors.gold, 0.12) }}>
                  <Ionicons name="bulb" size={15} color={colors.gold} />
                  <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                    {answer.ai_tip}
                  </AppText>
                </Row>
              )}
            </Block>
          )}
          <Button
            title={t('quiz_results.override')}
            icon="options"
            variant="soft"
            size="sm"
            onPress={onOverride}
            style={{ alignSelf: dir.alignEnd }}
          />
        </View>
      )}
    </View>
  );
};
