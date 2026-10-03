import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
}) => {
  const { colors, typography, radius, spacing } = useTheme();

  // Determine colors based on variant
  let bgColor = colors.primary;
  let textColor = '#FFFFFF';
  let borderColor = 'transparent';

  if (variant === 'secondary') {
    bgColor = colors.secondary;
    textColor = '#FFFFFF';
  } else if (variant === 'accent') {
    bgColor = colors.accent;
    textColor = '#FFFFFF';
  } else if (variant === 'danger') {
    bgColor = colors.error;
    textColor = '#FFFFFF';
  } else if (variant === 'gold') {
    bgColor = colors.gold;
    textColor = '#FFFFFF';
  } else if (variant === 'ghost') {
    bgColor = colors.surface;
    borderColor = colors.border;
    textColor = colors.text;
  }

  // Sizing
  let paddingVertical = spacing.md;
  let paddingHorizontal = spacing.lg;
  let fontSize = typography.sizes.md;

  if (size === 'sm') {
    paddingVertical = 8;
    paddingHorizontal = spacing.md;
    fontSize = typography.sizes.sm;
  } else if (size === 'lg') {
    paddingVertical = 14;
    paddingHorizontal = spacing.xl;
    fontSize = typography.sizes.md;
  }

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.baseButton,
        {
          backgroundColor: isDisabled ? colors.border : bgColor,
          borderColor: isDisabled ? colors.borderDarker : borderColor,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderRadius: 14,
          paddingVertical,
          paddingHorizontal,
          opacity: pressed && !isDisabled ? 0.88 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          width: fullWidth ? '100%' : undefined,
          ...(variant !== 'ghost' && !isDisabled
            ? {
                shadowColor: bgColor,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.16,
                shadowRadius: 8,
                elevation: 2,
              }
            : {}),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          {!!title && (
            <Text
              style={[
                styles.baseText,
                {
                  color: isDisabled ? colors.textMuted : textColor,
                  fontSize,
                  fontWeight: typography.weights.bold,
                  letterSpacing: 0.2,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
          )}
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
