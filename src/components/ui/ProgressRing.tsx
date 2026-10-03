import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme';

interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  textColor?: string;
  label?: string;
  sublabel?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 110,
  strokeWidth = 10,
  color,
  trackColor,
  textColor,
  label,
  sublabel,
}) => {
  const { colors, typography } = useTheme();
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const activeColor = color || colors.primary;
  const activeTrackColor = trackColor || colors.border;
  const activeTextColor = textColor || colors.text;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - clampedProgress * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeTrackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.textContainer}>
        {label ? (
          <Text
            style={[
              styles.labelText,
              {
                color: activeTextColor,
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.bold,
              },
            ]}
          >
            {label}
          </Text>
        ) : (
          <Text
            style={[
              styles.labelText,
              {
                color: activeTextColor,
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.bold,
              },
            ]}
          >
            {Math.round(clampedProgress * 100)}%
          </Text>
        )}
        {sublabel && (
          <Text
            style={[
              styles.sublabelText,
              {
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
              },
            ]}
          >
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    textAlign: 'center',
  },
  sublabelText: {
    textAlign: 'center',
    marginTop: 2,
  },
});
