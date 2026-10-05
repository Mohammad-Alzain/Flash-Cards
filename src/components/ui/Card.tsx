import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTheme, ToneName } from '../../theme';
import { PressableScale } from './PressableScale';
import { GradientFill } from './GradientFill';

export type CardVariant = 'elevated' | 'outlined' | 'tinted' | 'flat' | 'gradient';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Kept for backward compatibility; `false` maps to the `outlined` variant. */
  elevated?: boolean;
  /** Highlights the border with a colour (e.g. selected state). */
  highlightColor?: string;
  variant?: CardVariant;
  /** Tone for `tinted` cards. */
  tone?: ToneName;
  /** Custom gradient for `gradient` cards (defaults to the brand hero gradient). */
  gradient?: [string, string];
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  onLongPress,
  elevated = true,
  highlightColor,
  variant,
  tone = 'indigo',
  gradient,
  padding,
}) => {
  const { colors, shape, shadow, heroGradient, tone: getTone } = useTheme();
  const v: CardVariant = variant ?? (elevated ? 'elevated' : 'outlined');
  const t = getTone(tone);

  const base: ViewStyle = {
    borderRadius: shape.card,
    padding: padding ?? 16,
  };

  const look: Record<CardVariant, ViewStyle> = {
    elevated: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: highlightColor ?? colors.border,
      ...shadow(1),
    },
    outlined: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: highlightColor ?? colors.border,
    },
    tinted: {
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: highlightColor ?? t.border,
    },
    flat: {
      backgroundColor: colors.surface,
    },
    gradient: {
      overflow: 'hidden',
      ...shadow(3, (gradient ?? heroGradient)[0]),
    },
  };

  const content = (
    <>
      {v === 'gradient' && <GradientFill colors={gradient ?? heroGradient} radius={shape.card} decorated />}
      {children}
    </>
  );

  if (onPress || onLongPress) {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        activeScale={0.98}
        style={[base, look[v], style]}
      >
        {content}
      </PressableScale>
    );
  }

  return <View style={[base, look[v], style]}>{content}</View>;
};
