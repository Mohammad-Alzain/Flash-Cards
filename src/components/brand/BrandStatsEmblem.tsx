import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import { useTheme } from '../../theme';

export type BrandStatsEmblemVariant =
  | 'hero-spark'
  | 'streak-crest'
  | 'retention-target'
  | 'kinetic-stack';

interface BrandStatsEmblemProps {
  variant?: BrandStatsEmblemVariant;
  size?: number;
  style?: ViewStyle;
}

export const BrandStatsEmblem: React.FC<BrandStatsEmblemProps> = ({
  variant = 'hero-spark',
  size = 64,
  style,
}) => {
  const { colors, isDark } = useTheme();

  const id = React.useId().replace(/:/g, '');

  if (variant === 'streak-crest') {
    return (
      <View style={style}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Defs>
            <LinearGradient id={`streakGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#F59E0B" />
              <Stop offset="100%" stopColor="#EF4444" />
            </LinearGradient>
            <LinearGradient id={`cardBg_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={isDark ? '#312E81' : '#4F46E5'} />
              <Stop offset="100%" stopColor={isDark ? '#1E1B4B' : '#3730A3'} />
            </LinearGradient>
          </Defs>

          {/* Angled background card from brand identity */}
          <Rect
            x="24"
            y="20"
            width="72"
            height="80"
            rx="16"
            transform="rotate(-8 60 60)"
            fill={`url(#cardBg_${id})`}
            opacity={0.35}
          />
          {/* Main front card */}
          <Rect
            x="24"
            y="20"
            width="72"
            height="80"
            rx="16"
            fill={`url(#cardBg_${id})`}
            stroke="#818CF8"
            strokeWidth="1.5"
            strokeOpacity={0.6}
          />

          {/* Flame shape inside card */}
          <Path
            d="M 60 36 C 65 48 74 54 74 66 C 74 76 68 82 60 82 C 52 82 46 76 46 66 C 46 54 55 48 60 36 Z"
            fill={`url(#streakGrad_${id})`}
          />
          {/* Inner core spark */}
          <Path
            d="M 60 52 C 63 60 67 63 67 69 C 67 74 64 77 60 77 C 56 77 53 74 53 69 C 53 63 57 60 60 52 Z"
            fill="#FEF08A"
          />

          {/* Synapse satellite energy spark */}
          <Circle cx="82" cy="40" r="4" fill="#FBBF24" />
          <Circle cx="38" cy="74" r="3" fill="#67E8F9" />
        </Svg>
      </View>
    );
  }

  if (variant === 'retention-target') {
    return (
      <View style={style}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Defs>
            <LinearGradient id={`targetSpark_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="50%" stopColor="#22D3EE" />
              <Stop offset="100%" stopColor="#06B6D4" />
            </LinearGradient>
          </Defs>

          {/* Subtle concentric rings */}
          <Circle cx="60" cy="60" r="50" stroke={colors.primary} strokeWidth="1.5" strokeOpacity={0.15} fill="none" />
          <Circle cx="60" cy="60" r="36" stroke={colors.primary} strokeWidth="2" strokeOpacity={0.3} fill="none" strokeDasharray="4,4" />
          <Circle cx="60" cy="60" r="22" stroke="#22D3EE" strokeWidth="2.5" strokeOpacity={0.6} fill="none" />

          {/* Central Synapse Spark */}
          <Path
            d="M 60 40 Q 60 60 40 60 Q 60 60 60 80 Q 60 60 80 60 Q 60 60 60 40 Z"
            fill={`url(#targetSpark_${id})`}
          />

          {/* Orbital nodes */}
          <Circle cx="84" cy="42" r="3.5" fill="#38BDF8" />
          <Circle cx="36" cy="78" r="2.5" fill="#818CF8" />
          <Circle cx="80" cy="80" r="3" fill="#34D399" />
        </Svg>
      </View>
    );
  }

  if (variant === 'kinetic-stack') {
    return (
      <View style={style}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Defs>
            <LinearGradient id={`kCard1_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#6366F1" />
              <Stop offset="100%" stopColor="#4F46E5" />
            </LinearGradient>
            <LinearGradient id={`kCard2_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#3730A3" />
              <Stop offset="100%" stopColor="#1E1B4B" />
            </LinearGradient>
          </Defs>

          {/* Back card tilted */}
          <Rect
            x="28"
            y="20"
            width="64"
            height="80"
            rx="14"
            transform="rotate(-12 60 60)"
            fill={`url(#kCard2_${id})`}
            opacity={0.8}
          />
          {/* Middle card */}
          <Rect
            x="28"
            y="20"
            width="64"
            height="80"
            rx="14"
            transform="rotate(6 60 60)"
            fill={`url(#kCard1_${id})`}
            opacity={0.9}
            stroke="#818CF8"
            strokeWidth="1.5"
          />
          {/* Synapse spark on front */}
          <Path
            d="M 62 45 Q 62 60 47 60 Q 62 60 62 75 Q 62 60 77 60 Q 62 60 62 45 Z"
            fill="#FFFFFF"
          />
          <Circle cx="82" cy="42" r="3.5" fill="#22D3EE" />
          <Circle cx="44" cy="76" r="2.5" fill="#A5F3FC" />
        </Svg>
      </View>
    );
  }

  // Default: hero-spark (Artistic branded emblem for Stats Hero)
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 140 140">
        <Defs>
          <LinearGradient id={`heroGrad1_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#818CF8" />
            <Stop offset="100%" stopColor="#4F46E5" />
          </LinearGradient>
          <LinearGradient id={`heroSparkGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="50%" stopColor="#67E8F9" />
            <Stop offset="100%" stopColor="#06B6D4" />
          </LinearGradient>
        </Defs>

        {/* Ambient glow circle */}
        <Circle cx="70" cy="70" r="54" fill="rgba(99, 102, 241, 0.15)" />

        {/* Back Stack Card (tilted -12 deg) */}
        <Rect
          x="34"
          y="24"
          width="72"
          height="92"
          rx="18"
          transform="rotate(-12 70 70)"
          fill="#312E81"
          opacity={0.6}
        />

        {/* Front Brand Card */}
        <Rect
          x="34"
          y="24"
          width="72"
          height="92"
          rx="18"
          fill={`url(#heroGrad1_${id})`}
          stroke="#C7D2FE"
          strokeWidth="2"
          strokeOpacity={0.8}
        />

        {/* Large Synapse Spark in Center */}
        <Path
          d="M 70 46 Q 70 70 46 70 Q 70 70 70 94 Q 70 70 94 70 Q 70 70 70 46 Z"
          fill={`url(#heroSparkGrad_${id})`}
        />

        {/* Constellation Nodes */}
        <Circle cx="94" cy="50" r="4.5" fill="#22D3EE" />
        <Circle cx="46" cy="90" r="3.5" fill="#A5F3FC" />
        <Circle cx="92" cy="88" r="3" fill="#FCD34D" />
      </Svg>
    </View>
  );
};
