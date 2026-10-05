import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ToneName, alpha, lighten } from '../../theme';
import { GradientFill } from './GradientFill';
import { IconName } from './types';

export interface IconTileProps {
  icon: IconName;
  tone?: ToneName;
  /** Overrides the tone with an explicit colour. */
  color?: string;
  size?: number;
  /** `soft` = tinted background, `solid` = gradient fill with white glyph. */
  variant?: 'soft' | 'solid' | 'outline';
  shape?: 'rounded' | 'circle';
  style?: StyleProp<ViewStyle>;
}

/** Coloured rounded square holding an icon — the app's main iconographic unit. */
export const IconTile: React.FC<IconTileProps> = ({
  icon,
  tone = 'indigo',
  color,
  size = 44,
  variant = 'soft',
  shape = 'rounded',
  style,
}) => {
  const { tone: getTone } = useTheme();
  const t = getTone(tone);
  const fg = color ?? t.fg;
  const radius = shape === 'circle' ? size / 2 : Math.round(size * 0.32);
  const glyph = Math.round(size * 0.5);

  if (variant === 'solid') {
    const base = color ?? t.solid;
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
      >
        <GradientFill colors={[lighten(base, 0.18), base]} radius={radius} />
        <Ionicons name={icon} size={glyph} color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: variant === 'outline' ? 'transparent' : color ? alpha(color, 0.12) : t.bg,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: color ? alpha(color, 0.25) : t.border,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={glyph} color={fg} />
    </View>
  );
};
