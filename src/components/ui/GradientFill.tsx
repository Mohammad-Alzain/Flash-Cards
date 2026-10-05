import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, Circle } from 'react-native-svg';

interface GradientFillProps {
  colors: [string, string] | [string, string, string];
  /** Angle preset: diagonal (default), horizontal or vertical. */
  direction?: 'diagonal' | 'horizontal' | 'vertical';
  /** Rounded corners to match the host view (svg ignores overflow clipping on Android). */
  radius?: number;
  /** Adds soft decorative bubbles for hero surfaces. */
  decorated?: boolean;
}

const VECTORS = {
  diagonal: { x1: '0', y1: '0', x2: '1', y2: '1' },
  horizontal: { x1: '0', y1: '0', x2: '1', y2: '0' },
  vertical: { x1: '0', y1: '0', x2: '0', y2: '1' },
};

/**
 * Absolutely-filled SVG gradient. Place as the first child of a view with
 * `overflow: 'hidden'`. Uses react-native-svg so no extra native module is needed.
 */
export const GradientFill: React.FC<GradientFillProps> = ({
  colors,
  direction = 'diagonal',
  radius = 0,
  decorated = false,
}) => {
  const id = React.useId().replace(/:/g, '_');
  const v = VECTORS[direction];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`g${id}`} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
            {colors.map((c, i) => (
              <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#g${id})`} />
        {decorated && (
          <>
            <Circle cx="92%" cy="8%" r="70" fill="#FFFFFF" opacity={0.1} />
            <Circle cx="78%" cy="105%" r="54" fill="#FFFFFF" opacity={0.08} />
            <Circle cx="4%" cy="96%" r="26" fill="#FFFFFF" opacity={0.07} />
          </>
        )}
      </Svg>
    </View>
  );
};
