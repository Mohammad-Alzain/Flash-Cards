import React, { useEffect } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTheme, useDirection, lighten } from '../../theme';
import { GradientFill } from './GradientFill';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  trackColor?: string;
  height?: number;
  /** Two-tone gradient fill. */
  gradient?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Animated progress bar that fills from the reading-direction start edge. */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  trackColor,
  height = 10,
  gradient = true,
  style,
}) => {
  const { colors } = useTheme();
  const { rtl } = useDirection();
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const barColor = color || colors.primary;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      style={[
        {
          height,
          width: '100%',
          borderRadius: height,
          backgroundColor: trackColor ?? colors.surface,
          overflow: 'hidden',
          alignItems: rtl ? 'flex-end' : 'flex-start',
        },
        style,
      ]}
    >
      <Animated.View
        style={[{ height: '100%', borderRadius: height, overflow: 'hidden', backgroundColor: barColor }, fillStyle]}
      >
        {gradient && (
          <GradientFill
            colors={rtl ? [barColor, lighten(barColor, 0.25)] : [lighten(barColor, 0.25), barColor]}
            direction="horizontal"
            radius={height}
          />
        )}
      </Animated.View>
    </View>
  );
};
