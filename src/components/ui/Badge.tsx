import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme';

export type BadgeVariant = 'new' | 'learn' | 'due' | 'neutral' | 'accent' | 'warning';

interface BadgeProps {
  count?: number | string;
  label?: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  count,
  label,
  variant = 'neutral',
  size = 'md',
  style,
}) => {
  const { colors, typography, radius } = useTheme();

  let bgColor = colors.surface;
  let textColor = colors.textSecondary;
  let borderColor = colors.border;

  if (variant === 'new') {
    bgColor = `${colors.newCards}18`;
    textColor = colors.newCards;
    borderColor = `${colors.newCards}35`;
  } else if (variant === 'learn') {
    bgColor = `${colors.learningCards}18`;
    textColor = colors.learningCards;
    borderColor = `${colors.learningCards}35`;
  } else if (variant === 'due') {
    bgColor = `${colors.dueCards}18`;
    textColor = colors.dueCards;
    borderColor = `${colors.dueCards}35`;
  } else if (variant === 'accent') {
    bgColor = `${colors.accent}18`;
    textColor = colors.accent;
    borderColor = `${colors.accent}35`;
  } else if (variant === 'warning') {
    bgColor = `${colors.warning}18`;
    textColor = colors.warning;
    borderColor = `${colors.warning}35`;
  }

  const isSmall = size === 'sm';
  const paddingH = isSmall ? 8 : 12;
  const paddingV = isSmall ? 2 : 4;
  const fontSize = isSmall ? typography.sizes.xs : 13;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: 1,
          borderRadius: radius.full,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize,
            fontWeight: typography.weights.bold,
          },
        ]}
      >
        {label ? `${count !== undefined ? count + ' ' : ''}${label}` : count}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
