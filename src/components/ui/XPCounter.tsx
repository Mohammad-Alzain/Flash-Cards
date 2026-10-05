import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';

interface XPCounterProps {
  xp: number;
  style?: ViewStyle;
}

export const XPCounter: React.FC<XPCounterProps> = ({ xp, style }) => {
  const { colors, typography, radius, spacing } = useTheme();
  const rtl = isRTL();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.goldLight,
          borderColor: colors.gold,
          borderRadius: radius.full,
          flexDirection: rtl ? 'row-reverse' : 'row',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          gap: 6,
        },
        style,
      ]}
    >
      <Ionicons name="flash" size={15} color={colors.goldPressed} />
      <Text
        style={[
          styles.text,
          {
            color: colors.goldPressed,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.extrabold,
          },
        ]}
      >
        {xp} XP
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderWidth: 1.5,
  },
  text: {
    includeFontPadding: false,
  },
});
