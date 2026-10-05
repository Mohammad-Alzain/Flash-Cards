import React from 'react';
import { ActivityIndicator, StyleProp, TextStyle, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, alpha, lighten } from '../../theme';
import { PressableScale } from './PressableScale';
import { GradientFill } from './GradientFill';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconName, isIconName } from './types';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'danger'
  | 'ghost'
  | 'gold'
  | 'soft'
  | 'outline'
  | 'success'
  | 'dangerSoft';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** An Ionicons name or a custom node. */
  icon?: React.ReactNode | IconName;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
  haptic?: boolean;
  /** Custom base colour for solid variants (gradient is derived from it). */
  color?: string;
}

const SIZES = {
  sm: { height: 38, padH: 14, font: 13, icon: 16, gap: 6 },
  md: { height: 50, padH: 18, font: 15, icon: 19, gap: 8 },
  lg: { height: 58, padH: 24, font: 16, icon: 21, gap: 10 },
} as const;

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
  haptic = true,
  color,
}) => {
  const { colors, shape, shadow, heroGradient, tone } = useTheme();
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  // Solid variants render a gradient; tinted ones a flat soft fill.
  const solid: Partial<Record<ButtonVariant, [string, string]>> = {
    primary: heroGradient,
    secondary: [lighten(colors.secondary, 0.12), colors.secondary],
    accent: [lighten(colors.accent, 0.15), colors.accent],
    danger: [lighten(colors.error, 0.12), colors.error],
    gold: [lighten(colors.gold, 0.15), colors.gold],
    success: [tone('green').fg, tone('green').solid],
  };
  const gradient = color && solid[variant] ? ([lighten(color, 0.15), color] as [string, string]) : solid[variant];

  let fg = '#FFFFFF';
  let bg = 'transparent';
  let border = 'transparent';
  if (variant === 'ghost') {
    fg = colors.text;
    bg = colors.surfaceRaised;
    border = colors.border;
  } else if (variant === 'soft') {
    fg = colors.primary;
    bg = alpha(colors.primary, 0.12);
  } else if (variant === 'dangerSoft') {
    fg = colors.error;
    bg = alpha(colors.error, 0.12);
  } else if (variant === 'outline') {
    fg = colors.primary;
    border = alpha(colors.primary, 0.45);
  }
  if (isDisabled) {
    fg = colors.textMuted;
    bg = colors.surface;
    border = colors.border;
  }

  const renderIcon = () => {
    if (!icon) return null;
    if (isIconName(icon)) return <Ionicons name={icon} size={s.icon} color={fg} />;
    return icon;
  };
  const iconNode = renderIcon();
  const radius = size === 'sm' ? 12 : shape.button;

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          minHeight: s.height,
          paddingHorizontal: title ? s.padH : 0,
          minWidth: title ? undefined : s.height,
          borderRadius: radius,
          backgroundColor: gradient && !isDisabled ? undefined : bg,
          borderWidth: border === 'transparent' ? 0 : 1.5,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          alignSelf: fullWidth ? 'stretch' : undefined,
        },
        gradient && !isDisabled ? shadow(2, gradient[1]) : null,
        style,
      ]}
    >
      {gradient && !isDisabled && <GradientFill colors={gradient} direction="horizontal" radius={radius} />}
      {loading ? (
        <ActivityIndicator color={gradient ? '#FFFFFF' : colors.primary} size="small" />
      ) : (
        <Row gap={s.gap} justify="center" align="center" style={{ maxWidth: '100%', flexShrink: 1 }}>
          {iconPosition === 'left' && iconNode && (
            <View style={{ flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>{iconNode}</View>
          )}
          {!!title && (
            <AppText
              variant="bodyStrong"
              weight="extrabold"
              size={s.font}
              color={fg}
              align="center"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[{ flexShrink: 1 }, textStyle]}
            >
              {title}
            </AppText>
          )}
          {iconPosition === 'right' && iconNode && (
            <View style={{ flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>{iconNode}</View>
          )}
        </Row>
      )}
    </PressableScale>
  );
};
