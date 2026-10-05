import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '../../../theme';
import { AppText, Row } from '../../../components/ui';

interface DeckCountPillsProps {
  newCount: number;
  learnCount: number;
  dueCount: number;
  /** `dots` = compact coloured numbers; `labels` = pills with words. */
  style?: 'dots' | 'labels';
  hideZero?: boolean;
}

/** The AnkiDroid-style New · Learning · Due trio in the app's colours. */
export const DeckCountPills: React.FC<DeckCountPillsProps> = ({
  newCount,
  learnCount,
  dueCount,
  style = 'labels',
  hideZero = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const items = [
    { key: 'new', n: newCount, color: colors.newCards, label: t('decks.new_badge', { count: newCount }) },
    { key: 'learn', n: learnCount, color: colors.learningCards, label: t('decks.learn_badge', { count: learnCount }) },
    { key: 'due', n: dueCount, color: colors.dueCards, label: t('decks.due_badge', { count: dueCount }) },
  ].filter((i) => !hideZero || i.n > 0);

  if (style === 'dots') {
    return (
      <Row gap={10}>
        {items.map((i) => (
          <Row key={i.key} gap={4}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.color, opacity: i.n > 0 ? 1 : 0.35 }} />
            <AppText variant="caption" weight="extrabold" color={i.n > 0 ? i.color : 'textMuted'}>
              {i.n}
            </AppText>
          </Row>
        ))}
      </Row>
    );
  }

  return (
    <Row gap={6} wrap>
      {items.map((i) => (
        <View
          key={i.key}
          style={{
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 3,
            backgroundColor: i.n > 0 ? alpha(i.color, 0.13) : colors.surface,
          }}
        >
          <AppText variant="caption" size={11} weight="extrabold" color={i.n > 0 ? i.color : 'textMuted'}>
            {i.label}
          </AppText>
        </View>
      ))}
    </Row>
  );
};
