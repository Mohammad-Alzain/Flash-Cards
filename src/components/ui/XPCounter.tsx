import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';

interface XPCounterProps {
  xp: number;
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const XPCounter: React.FC<XPCounterProps> = ({ xp, plain = false, style }) => {
  const { tone } = useTheme();
  const t = tone('amber');
  return (
    <Row
      gap={4}
      style={[
        plain ? null : { backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
        style,
      ]}
    >
      <Ionicons name="flash" size={16} color={t.fg} />
      <AppText variant="bodyStrong" weight="black" color={t.fg}>
        {xp}
      </AppText>
      <AppText variant="caption" weight="extrabold" color={t.fg}>
        XP
      </AppText>
    </Row>
  );
};
