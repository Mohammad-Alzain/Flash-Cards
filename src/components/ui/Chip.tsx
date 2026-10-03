import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  style,
}) => {
  const { colors, typography, radius, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected ? colors.primary : colors.textSecondary,
            fontSize: typography.sizes.sm,
            fontWeight: selected ? typography.weights.bold : typography.weights.medium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1.5,
    alignSelf: 'flex-start',
    marginRight: 6,
    marginBottom: 6,
  },
  text: {
    textAlign: 'center',
  },
});
