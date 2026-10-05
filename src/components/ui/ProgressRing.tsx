import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme, lighten } from '../../theme';
import { AppText } from './AppText';

interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  textColor?: string;
  label?: string;
  sublabel?: string;
  /** Replace the centre text with custom content (icon, mascot…). */
  children?: React.ReactNode;
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
  children,
}) => {
  const { colors } = useTheme();
  const id = React.useId().replace(/:/g, '_');
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const active = color || colors.primary;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={`ring${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={lighten(active, 0.3)} />
            <Stop offset="1" stopColor={active} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor || colors.surface}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#ring${id})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            strokeLinecap="round"
            fill="transparent"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>

      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children ?? (
          <>
            <AppText
              variant="h3"
              weight="black"
              size={Math.max(14, Math.round(size * 0.2))}
              color={textColor || colors.text}
              align="center"
            >
              {label ?? `${Math.round(clamped * 100)}%`}
            </AppText>
            {!!sublabel && (
              <AppText variant="caption" color={textColor ? textColor : 'textSecondary'} align="center">
                {sublabel}
              </AppText>
            )}
          </>
        )}
      </View>
    </View>
  );
};
