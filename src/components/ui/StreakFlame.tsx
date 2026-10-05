import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';

interface StreakFlameProps {
  streak: number;
  style?: ViewStyle;
}

export const StreakFlame: React.FC<StreakFlameProps> = ({ streak, style }) => {
  const { colors, typography, radius, spacing } = useTheme();
  const rtl = isRTL();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.warningLight,
          borderColor: colors.warning,
          borderRadius: radius.full,
          flexDirection: rtl ? 'row-reverse' : 'row',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          gap: 6,
        },
        style,
      ]}
    >
      <Ionicons name="flame" size={17} color={colors.warning} />
      <Text
        style={[
          styles.text,
          {
            color: colors.warningPressed,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.extrabold,
          },
        ]}
      >
        {streak}
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
