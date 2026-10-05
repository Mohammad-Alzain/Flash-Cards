import React from 'react';
import { View, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '../../../theme';
import { AppText, Row, PressableScale, Button, Card, IconName } from '../../../components/ui';
import { Mascot } from '../../../components/illustrations';
import type { QuizSession } from '../useQuizSession';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface OptionProps {
  label: string;
  index: number;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** Multiple-choice answer row with a letter bubble. */
export const QuizOption: React.FC<OptionProps> = ({ label, index, selected, disabled, onPress }) => {
  const { colors, shadow } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic
      activeScale={0.97}
      style={[
        {
          borderRadius: 18,
          borderWidth: 2,
          borderBottomWidth: 4,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? alpha(colors.primary, 0.1) : colors.surfaceRaised,
          padding: 12,
          marginBottom: 10,
          opacity: disabled && !selected ? 0.6 : 1,
        },
        selected ? null : shadow(1),
      ]}
    >
      <Row gap={12}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? colors.primary : colors.surface,
          }}
        >
          <AppText variant="bodyStrong" weight="black" color={selected ? '#FFFFFF' : 'textSecondary'} align="center">
            {LETTERS[index] ?? index + 1}
          </AppText>
        </View>
        <AppText variant="body" weight="bold" color={selected ? 'primary' : 'text'} style={{ flex: 1 }}>
          {label}
        </AppText>
      </Row>
    </PressableScale>
  );
};

interface TrueFalseProps {
  selected?: string;
  disabled?: boolean;
  onAnswer: (value: 'True' | 'False') => void;
}

/** Big tappable True / False pair. Stored values stay "True"/"False". */
export const TrueFalseButtons: React.FC<TrueFalseProps> = ({ selected, disabled, onAnswer }) => {
  const { tone } = useTheme();
  const { t } = useTranslation();
  const items: { value: 'True' | 'False'; label: string; icon: IconName; color: string }[] = [
    { value: 'True', label: t('quiz_play.true'), icon: 'checkmark-circle', color: tone('green').fg },
    { value: 'False', label: t('quiz_play.false'), icon: 'close-circle', color: tone('rose').fg },
  ];
  return (
    <Row gap={12} align="stretch">
      {items.map((it) => {
        const active = selected === it.value;
        return (
          <PressableScale
            key={it.value}
            onPress={() => onAnswer(it.value)}
            disabled={disabled}
            haptic
            activeScale={0.95}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 18,
              borderRadius: 20,
              borderWidth: 2,
              borderBottomWidth: 5,
              borderColor: active ? it.color : alpha(it.color, 0.35),
              backgroundColor: active ? alpha(it.color, 0.18) : alpha(it.color, 0.07),
            }}
          >
            <Ionicons name={it.icon} size={34} color={it.color} />
            <AppText variant="h3" color={it.color} align="center" style={{ marginTop: 4 }}>
              {it.label}
            </AppText>
          </PressableScale>
        );
      })}
    </Row>
  );
};

/** Two-column term ↔ meaning matching board. */
export const MatchingBoard: React.FC<{ s: QuizSession }> = ({ s }) => {
  const { colors, tone } = useTheme();
  const green = tone('green').fg;

  const tile = (item: { id: string; text: string }, side: 'left' | 'right') => {
    const matched = s.matchedIds.has(item.id);
    const selected = side === 'left' && s.selectedLeft === item.id;
    const mismatch = side === 'left' ? s.mismatchedPair?.left === item.id : s.mismatchedPair?.right === item.id;
    const color = matched ? green : mismatch ? colors.error : selected ? colors.accent : null;
    return (
      <PressableScale
        key={item.id}
        disabled={matched || s.isAnswerSubmitted}
        onPress={() => (side === 'left' ? s.handleMatchingLeftPress(item.id) : s.handleMatchingRightPress(item.id))}
        activeScale={0.95}
        style={{
          minHeight: 66,
          padding: 10,
          borderRadius: 16,
          borderWidth: 2,
          borderBottomWidth: 4,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: color ?? colors.border,
          backgroundColor: color ? alpha(color, 0.12) : colors.surfaceRaised,
          opacity: matched ? 0.7 : 1,
        }}
      >
        <AppText variant="bodySm" weight="bold" color={color ?? 'text'} align="center" numberOfLines={3}>
          {item.text}
        </AppText>
        {matched && <Ionicons name="checkmark-circle" size={16} color={green} style={{ marginTop: 2 }} />}
      </PressableScale>
    );
  };

  return (
    <Row gap={10} align="flex-start">
      <View style={{ flex: 1, gap: 8 }}>{s.shuffledLeft.map((i) => tile(i, 'left'))}</View>
      <View style={{ flex: 1, gap: 8 }}>{s.shuffledRight.map((i) => tile(i, 'right'))}</View>
    </Row>
  );
};

/** Duolingo-style result panel for instant modes. */
export const FeedbackPanel: React.FC<{ s: QuizSession }> = ({ s }) => {
  const { colors, tone, shape } = useTheme();
  const { t } = useTranslation();
  const ok = s.isCurrentCorrect;
  const gameOver = s.mode === 'survival' && s.lives <= 0;
  const color = ok ? tone('green').fg : colors.error;
  const title = ok ? t('quiz_play.correct_title') : gameOver ? t('quiz_play.game_over_title') : t('quiz_play.incorrect_title');

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 18,
        paddingBottom: 28,
        borderTopLeftRadius: shape.sheet,
        borderTopRightRadius: shape.sheet,
        backgroundColor: colors.surfaceRaised,
        borderTopWidth: 4,
        borderColor: color,
      }}
    >
      <Row gap={12} style={{ marginBottom: 14 }}>
        <Mascot size={58} expression={ok ? 'excited' : 'sad'} pose={ok ? 'cheer' : 'idle'} />
        <View style={{ flex: 1 }}>
          <AppText variant="h3" color={color}>
            {title}
          </AppText>
          {!ok && (
            <AppText variant="bodySm" color="textSecondary" style={{ marginTop: 2 }}>
              {t('quiz_play.correct_answer')}{' '}
              <AppText variant="bodySm" weight="black">
                {s.feedbackExpected}
              </AppText>
            </AppText>
          )}
        </View>
      </Row>
      <Button
        title={gameOver ? t('quiz_play.view_results') : t('common.continue')}
        icon={gameOver ? 'trophy' : 'arrow-forward'}
        iconPosition="right"
        variant={ok ? 'success' : 'danger'}
        size="lg"
        fullWidth
        onPress={s.continueAfterFeedback}
      />
    </View>
  );
};

/** Blocking overlay while AI grades written answers. */
export const GradingOverlay: React.FC<{ visible: boolean; status: string }> = ({ visible, status }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,10,25,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ width: '100%', alignItems: 'center', paddingVertical: 24 }}>
          <Mascot size={96} expression="thinking" accessory="glasses" />
          <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          <AppText variant="h3" align="center" style={{ marginTop: 12 }}>
            {t('quiz_play.grading_title')}
          </AppText>
          <AppText variant="bodySm" color="textSecondary" align="center" style={{ marginTop: 6 }}>
            {status || t('quiz_play.grading_sub')}
          </AppText>
        </Card>
      </View>
    </Modal>
  );
};
