import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  height = 12,
  style,
}) => {
  const { colors, radius } = useTheme();
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const barColor = color || colors.primary;

  return (
    <View
      style={[
        styles.track,
        {
          height,
          backgroundColor: colors.border,
          borderRadius: radius.full,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress * 100}%`,
            backgroundColor: barColor,
            borderRadius: radius.full,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
