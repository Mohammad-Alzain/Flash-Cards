import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  G,
  Ellipse,
} from 'react-native-svg';
import { useTheme } from '../../theme';

export interface IllustrationProps {
  size?: number;
  style?: ViewStyle;
}

/**
 * EmptyStudyIllustration:
 * Layered flashcards with radiant Synapse Spark, memory resonance rings, and orbital particles.
 * Used for empty decks, empty study queues, and zero-state study screens.
 */
export const EmptyStudyIllustration: React.FC<IllustrationProps> = ({
  size = 160,
  style,
}) => {
  const { isDark, colors } = useTheme();
  const id = React.useId().replace(/:/g, '_');

  const glowBg = isDark ? '#1E1B4B' : '#EEF2FF';
  const shadowColor = isDark ? '#000000' : '#CBD5E1';
  const backCardStart = isDark ? '#312E81' : '#4338CA';
  const backCardEnd = isDark ? '#1E1B4B' : '#312E81';
  const frontCardStart = isDark ? '#6366F1' : '#4F46E5';
  const frontCardEnd = isDark ? '#4F46E5' : '#4338CA';
  const cardBorder = isDark ? '#4338CA' : '#C7D2FE';

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id={`ambientGlow_${id}`} cx="50%" cy="45%" r="48%">
            <Stop offset="0%" stopColor={glowBg} stopOpacity={0.9} />
            <Stop offset="65%" stopColor={glowBg} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={glowBg} stopOpacity={0} />
          </RadialGradient>

          <LinearGradient id={`backCardGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={backCardStart} />
            <Stop offset="100%" stopColor={backCardEnd} />
          </LinearGradient>

          <LinearGradient id={`frontCardGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={frontCardStart} />
            <Stop offset="100%" stopColor={frontCardEnd} />
          </LinearGradient>

          <LinearGradient id={`sparkGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="60%" stopColor="#67E8F9" />
            <Stop offset="100%" stopColor="#06B6D4" />
          </LinearGradient>

          <LinearGradient id={`accentSpark_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#A5F3FC" />
            <Stop offset="100%" stopColor="#06B6D4" />
          </LinearGradient>
        </Defs>

        {/* Ambient Glow */}
        <Circle cx="100" cy="95" r="75" fill={`url(#ambientGlow_${id})`} />

        {/* Base Drop Shadow */}
        <Ellipse cx="100" cy="170" rx="60" ry="10" fill={shadowColor} opacity={0.35} />

        {/* Back Stack Card (Tilted -14deg) */}
        <G transform="rotate(-14 86 102)">
          <Rect
            x="48"
            y="42"
            width="82"
            height="110"
            rx="14"
            fill={`url(#backCardGrad_${id})`}
            stroke={cardBorder}
            strokeWidth="1.5"
            opacity={0.8}
          />
        </G>

        {/* Front Stack Card (Tilted 8deg) */}
        <G transform="rotate(8 108 106)">
          <Rect
            x="64"
            y="44"
            width="86"
            height="114"
            rx="16"
            fill={`url(#frontCardGrad_${id})`}
            stroke="#818CF8"
            strokeWidth="1.5"
          />
          {/* Card rule lines */}
          <Rect x="78" y="66" width="36" height="5" rx="2.5" fill="#C7D2FE" opacity={0.7} />
          <Rect x="78" y="78" width="58" height="4" rx="2" fill="#C7D2FE" opacity={0.4} />
          <Rect x="78" y="88" width="46" height="4" rx="2" fill="#C7D2FE" opacity={0.4} />
        </G>

        {/* Synapse Memory Resonance Rings */}
        <Circle
          cx="100"
          cy="96"
          r="48"
          stroke="#06B6D4"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity={0.4}
        />

        {/* Hero Central Synapse Spark */}
        <G transform="translate(100, 96)">
          {/* 8-point Spark Path */}
          <Path
            d="M 0 -24 Q 0 0 -24 0 Q 0 0 0 24 Q 0 0 24 0 Q 0 0 0 -24 Z"
            fill={`url(#sparkGrad_${id})`}
          />
          {/* Central Bright Core */}
          <Circle cx="0" cy="0" r="4.5" fill="#FFFFFF" />
        </G>

        {/* Orbiting Memory Particles */}
        <Circle cx="138" cy="68" r="4" fill={`url(#accentSpark_${id})`} />
        <Circle cx="64" cy="126" r="3" fill="#818CF8" opacity={0.8} />
        <Circle cx="146" cy="124" r="2.5" fill="#06B6D4" opacity={0.7} />
        <Circle cx="68" cy="62" r="2" fill="#A5F3FC" opacity={0.9} />
      </Svg>
    </View>
  );
};

/**
 * SessionCompleteIllustration:
 * Triumphant mastery card with golden synapse burst, celebration confetti, and victory laurels.
 * Used for study completion screens and level-ups.
 */
export const SessionCompleteIllustration: React.FC<IllustrationProps> = ({
  size = 140,
  style,
}) => {
  const { isDark } = useTheme();
  const id = React.useId().replace(/:/g, '_');

  const glowBg = isDark ? '#312E81' : '#FEF3C7';
  const shadowColor = isDark ? '#000000' : '#E2E8F0';

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id={`goldGlow_${id}`} cx="50%" cy="46%" r="50%">
            <Stop offset="0%" stopColor={glowBg} stopOpacity={0.9} />
            <Stop offset="70%" stopColor={glowBg} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={glowBg} stopOpacity={0} />
          </RadialGradient>

          <LinearGradient id={`cardTrophyGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4F46E5" />
            <Stop offset="100%" stopColor="#312E81" />
          </LinearGradient>

          <LinearGradient id={`goldSpark_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFBEB" />
            <Stop offset="40%" stopColor="#FDE047" />
            <Stop offset="100%" stopColor="#F59E0B" />
          </LinearGradient>

          <LinearGradient id={`goldRing_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FCD34D" />
            <Stop offset="100%" stopColor="#F59E0B" />
          </LinearGradient>
        </Defs>

        {/* Ambient Radiant Glow */}
        <Circle cx="100" cy="94" r="82" fill={`url(#goldGlow_${id})`} />

        {/* Base Drop Shadow */}
        <Ellipse cx="100" cy="174" rx="55" ry="9" fill={shadowColor} opacity={0.4} />

        {/* Victory Burst Rays */}
        <Path d="M 100 20 L 100 32" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" opacity={0.8} />
        <Path d="M 44 48 L 52 56" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" opacity={0.7} />
        <Path d="M 156 48 L 148 56" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" opacity={0.7} />
        <Path d="M 24 96 L 36 96" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" opacity={0.7} />
        <Path d="M 176 96 L 164 96" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" opacity={0.7} />

        {/* Master Flashcard */}
        <Rect
          x="58"
          y="50"
          width="84"
          height="108"
          rx="18"
          fill={`url(#cardTrophyGrad_${id})`}
          stroke="#F59E0B"
          strokeWidth="2.5"
        />

        {/* Laurel / Halo Ring behind Apex */}
        <Circle
          cx="100"
          cy="92"
          r="32"
          stroke={`url(#goldRing_${id})`}
          strokeWidth="2"
          strokeDasharray="5 3"
          fill="none"
          opacity={0.8}
        />

        {/* Golden Synapse Spark Emblem at Center */}
        <G transform="translate(100, 92)">
          <Path
            d="M 0 -22 Q 0 0 -22 0 Q 0 0 0 22 Q 0 0 22 0 Q 0 0 0 -22 Z"
            fill={`url(#goldSpark_${id})`}
          />
          <Circle cx="0" cy="0" r="4.5" fill="#FFFFFF" />
        </G>

        {/* Checkmark of Completion */}
        <G transform="translate(86, 126)">
          <Circle cx="14" cy="8" r="13" fill="#10B981" />
          <Path
            d="M 9 8 L 13 12 L 19 5"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>

        {/* Joyful Confetti Dots */}
        <Circle cx="42" cy="74" r="3.5" fill="#10B981" />
        <Circle cx="160" cy="72" r="3.5" fill="#06B6D4" />
        <Circle cx="50" cy="138" r="3" fill="#F59E0B" />
        <Circle cx="152" cy="136" r="3" fill="#818CF8" />
        <Circle cx="138" cy="38" r="2.5" fill="#EC4899" />
        <Circle cx="64" cy="36" r="2.5" fill="#06B6D4" />
      </Svg>
    </View>
  );
};

/**
 * EmptySearchIllustration:
 * Branded flashcard with a glass magnifying glass focusing a luminous Synapse Spark.
 * Used for zero search results in card browser, deck search, and filtered lists.
 */
export const EmptySearchIllustration: React.FC<IllustrationProps> = ({
  size = 140,
  style,
}) => {
  const { isDark } = useTheme();
  const id = React.useId().replace(/:/g, '_');

  const glowBg = isDark ? '#1E1B4B' : '#F0F9FF';
  const shadowColor = isDark ? '#000000' : '#CBD5E1';
  const cardFill = isDark ? '#1E293B' : '#FFFFFF';
  const cardBorder = isDark ? '#334155' : '#E2E8F0';

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id={`searchGlow_${id}`} cx="50%" cy="48%" r="48%">
            <Stop offset="0%" stopColor={glowBg} stopOpacity={0.9} />
            <Stop offset="70%" stopColor={glowBg} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={glowBg} stopOpacity={0} />
          </RadialGradient>

          <LinearGradient id={`lensGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#06B6D4" stopOpacity={0.25} />
            <Stop offset="100%" stopColor="#4F46E5" stopOpacity={0.15} />
          </LinearGradient>

          <LinearGradient id={`sparkSearchGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="70%" stopColor="#22D3EE" />
            <Stop offset="100%" stopColor="#06B6D4" />
          </LinearGradient>
        </Defs>

        {/* Ambient Glow */}
        <Circle cx="100" cy="98" r="76" fill={`url(#searchGlow_${id})`} />

        {/* Base Drop Shadow */}
        <Ellipse cx="100" cy="172" rx="55" ry="9" fill={shadowColor} opacity={0.35} />

        {/* Card Canvas */}
        <Rect
          x="54"
          y="46"
          width="92"
          height="116"
          rx="16"
          fill={cardFill}
          stroke={cardBorder}
          strokeWidth="2"
        />

        {/* Card skeleton text lines */}
        <Rect x="70" y="66" width="44" height="5" rx="2.5" fill={isDark ? '#475569' : '#CBD5E1'} />
        <Rect x="70" y="78" width="60" height="4" rx="2" fill={isDark ? '#334155' : '#E2E8F0'} />
        <Rect x="70" y="88" width="50" height="4" rx="2" fill={isDark ? '#334155' : '#E2E8F0'} />

        {/* Magnifying Glass Lens */}
        <Circle
          cx="108"
          cy="104"
          r="34"
          fill={`url(#lensGrad_${id})`}
          stroke="#4F46E5"
          strokeWidth="3.5"
        />

        {/* Inner Glaze Reflection */}
        <Path
          d="M 88 88 A 26 26 0 0 1 126 84"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity={0.6}
        />

        {/* Magnifying Glass Handle */}
        <Path
          d="M 132 128 L 158 154"
          stroke="#3730A3"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <Path
          d="M 132 128 L 158 154"
          stroke="#4F46E5"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Focused Synapse Spark in Lens Center */}
        <G transform="translate(108, 104)">
          <Path
            d="M 0 -16 Q 0 0 -16 0 Q 0 0 0 16 Q 0 0 16 0 Q 0 0 0 -16 Z"
            fill={`url(#sparkSearchGrad_${id})`}
          />
          <Circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
        </G>

        {/* Curious Question Accent */}
        <Circle cx="64" cy="132" r="3" fill="#06B6D4" opacity={0.8} />
        <Circle cx="150" cy="62" r="4" fill="#818CF8" opacity={0.7} />
      </Svg>
    </View>
  );
};

/**
 * VaultBackupIllustration:
 * Heraldic security shield containing the Synapse Spark, guarding the local offline flashcard vault.
 * Used for Backup & Restore, Privacy, and Security screens.
 */
export const VaultBackupIllustration: React.FC<IllustrationProps> = ({
  size = 120,
  style,
}) => {
  const { isDark } = useTheme();
  const id = React.useId().replace(/:/g, '_');

  const glowBg = isDark ? '#1E1B4B' : '#EEF2FF';

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id={`shieldGlow_${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={glowBg} stopOpacity={0.9} />
            <Stop offset="70%" stopColor={glowBg} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={glowBg} stopOpacity={0} />
          </RadialGradient>

          <LinearGradient id={`shieldGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4F46E5" />
            <Stop offset="100%" stopColor="#312E81" />
          </LinearGradient>

          <LinearGradient id={`sparkShieldGrad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="60%" stopColor="#67E8F9" />
            <Stop offset="100%" stopColor="#06B6D4" />
          </LinearGradient>
        </Defs>

        {/* Ambient Glow */}
        <Circle cx="100" cy="100" r="76" fill={`url(#shieldGlow_${id})`} />

        {/* Outer Security Orbit */}
        <Circle
          cx="100"
          cy="98"
          r="66"
          stroke="#06B6D4"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          fill="none"
          opacity={0.5}
        />

        {/* Heraldic Shield */}
        <Path
          d="M 100 42 C 126 42 148 52 148 52 C 148 108 100 148 100 148 C 100 148 52 108 52 52 C 52 52 74 42 100 42 Z"
          fill={`url(#shieldGrad_${id})`}
          stroke="#06B6D4"
          strokeWidth="2.5"
        />

        {/* Shield Inner Inset */}
        <Path
          d="M 100 50 C 120 50 138 58 138 58 C 138 102 100 136 100 136 C 100 136 62 102 62 58 C 62 58 80 50 100 50 Z"
          fill="none"
          stroke="#818CF8"
          strokeWidth="1.5"
          opacity={0.6}
        />

        {/* Protected Synapse Spark Core */}
        <G transform="translate(100, 92)">
          <Path
            d="M 0 -18 Q 0 0 -18 0 Q 0 0 0 18 Q 0 0 18 0 Q 0 0 0 -18 Z"
            fill={`url(#sparkShieldGrad_${id})`}
          />
          <Circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
        </G>

        {/* Offline Vault Lock / Check icon */}
        <G transform="translate(93, 114)">
          <Path
            d="M 4 8 L 7 11 L 11 5"
            stroke="#10B981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>

        {/* Orbiting Satellite Data Nodes */}
        <Circle cx="160" cy="74" r="3.5" fill="#06B6D4" />
        <Circle cx="40" cy="122" r="3.5" fill="#818CF8" />
        <Circle cx="148" cy="144" r="2.5" fill="#10B981" />
      </Svg>
    </View>
  );
};
