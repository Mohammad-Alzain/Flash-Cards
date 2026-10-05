import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, alpha } from '../../../theme';
import { AppText, Row, PressableScale, IconName } from '../../../components/ui';
import { Rating } from '../../../core/scheduler/types';

interface RatingBarProps {
  /** Interval label per rating, e.g. "<1m", "4d". */
  intervals: Record<Rating, { buttonLabel: string }>;
  onRate: (rating: Rating) => void;
}

/** The four SRS answer buttons with their next-interval previews. */
export const RatingBar: React.FC<RatingBarProps> = ({ intervals, onRate }) => {
  const { colors, tone } = useTheme();
  const { t } = useTranslation();

  const buttons: { rating: Rating; label: string; color: string; icon: IconName }[] = [
    { rating: Rating.Again, label: t('study.again'), color: colors.error, icon: 'refresh' },
    { rating: Rating.Hard, label: t('study.hard'), color: tone('orange').fg, icon: 'barbell' },
    { rating: Rating.Good, label: t('study.good'), color: tone('blue').fg, icon: 'thumbs-up' },
    { rating: Rating.Easy, label: t('study.easy'), color: tone('green').fg, icon: 'rocket' },
  ];

  return (
    <Row gap={8} align="stretch">
      {buttons.map((b) => (
        <PressableScale
          key={b.rating}
          onPress={() => onRate(b.rating)}
          activeScale={0.92}
          accessibilityRole="button"
          accessibilityLabel={`${b.label} ${intervals[b.rating].buttonLabel}`}
          style={{
            flex: 1,
            borderRadius: 18,
            paddingVertical: 10,
            alignItems: 'center',
            backgroundColor: alpha(b.color, 0.12),
            borderWidth: 1.5,
            borderBottomWidth: 4,
            borderColor: alpha(b.color, 0.45),
          }}
        >
          <Ionicons name={b.icon} size={18} color={b.color} />
          <AppText variant="bodySm" weight="extrabold" color={b.color} align="center" numberOfLines={1} style={{ marginTop: 2 }}>
            {b.label}
          </AppText>
          <AppText variant="caption" size={11} weight="bold" color={alpha(b.color, 0.85)} align="center" numberOfLines={1}>
            {intervals[b.rating].buttonLabel}
          </AppText>
        </PressableScale>
      ))}
    </Row>
  );
};
