import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';

interface StreakFlameProps {
  streak: number;
  /** `plain` drops the pill background (for use inside another pill). */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const StreakFlame: React.FC<StreakFlameProps> = ({ streak, plain = false, style }) => {
  const { tone } = useTheme();
  const t = tone('orange');
  return (
    <Row
      gap={4}
      style={[
        plain ? null : { backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
        style,
      ]}
    >
      <Ionicons name="flame" size={18} color={t.fg} />
      <AppText variant="bodyStrong" weight="black" color={t.fg}>
        {streak}
      </AppText>
    </Row>
  );
};
