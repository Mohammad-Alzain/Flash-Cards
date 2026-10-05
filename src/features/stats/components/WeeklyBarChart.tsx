import React from 'react';
import { View } from 'react-native';
import { useTheme, useDirection, alpha } from '../../../theme';
import { AppText, Row, GradientFill } from '../../../components/ui';
import type { DayActivityItem } from '../../../core/db/repositories/statsRepository';

interface WeeklyBarChartProps {
  days: DayActivityItem[];
  height?: number;
}

/** Seven rounded bars; today is highlighted with the brand gradient. */
export const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({ days, height = 120 }) => {
  const { colors, heroGradient } = useTheme();
  const dir = useDirection();
  const max = Math.max(10, ...days.map((d) => d.count));

  return (
    <Row align="flex-end" justify="space-between" style={{ height: height + 44 }}>
      {days.map((day) => {
        const ratio = day.count / max;
        const barH = Math.max(8, Math.round(ratio * height));
        return (
          <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
            <AppText
              variant="caption"
              size={11}
              weight={day.isToday ? 'black' : 'bold'}
              color={day.isToday ? 'primary' : 'textMuted'}
              align="center"
              style={{ marginBottom: 4, minHeight: 16 }}
            >
              {day.count > 0 ? day.count : ''}
            </AppText>
            <View
              style={{
                width: 22,
                height,
                borderRadius: 11,
                backgroundColor: colors.surface,
                justifyContent: 'flex-end',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: barH,
                  borderRadius: 11,
                  overflow: 'hidden',
                  backgroundColor: day.count > 0 ? alpha(colors.accent, 0.75) : 'transparent',
                }}
              >
                {day.isToday && day.count > 0 && <GradientFill colors={heroGradient} direction="vertical" radius={11} />}
              </View>
            </View>
            <View
              style={{
                marginTop: 6,
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 8,
                backgroundColor: day.isToday ? alpha(colors.primary, 0.14) : 'transparent',
              }}
            >
              <AppText
                variant="caption"
                size={11}
                weight={day.isToday ? 'black' : 'semibold'}
                color={day.isToday ? 'primary' : 'textSecondary'}
                align="center"
              >
                {dir.arabic ? day.dayNameAr : day.dayNameEn}
              </AppText>
            </View>
          </View>
        );
      })}
    </Row>
  );
};
