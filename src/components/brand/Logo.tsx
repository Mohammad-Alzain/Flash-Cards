import React from 'react';
import { View, StyleSheet, Text, ViewStyle } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
  Mask,
} from 'react-native-svg';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';

export interface LogoProps {
  variant?: 'mark' | 'wordmark' | 'lockup';
  size?: number; // Base height of the logo (default: 40)
  monochrome?: boolean;
  color?: string; // Custom single color override
  subtitle?: boolean; // Whether to render subtitle in lockup (default: false)
  style?: ViewStyle;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'mark',
  size = 40,
  monochrome = false,
  color,
  subtitle = false,
  style,
}) => {
  const { colors, isDark, typography } = useTheme();
  const rtl = isRTL();

  // Colors resolution
  const primaryColor = color || (monochrome ? colors.text : colors.primary);
  const accentColor = color || (monochrome ? colors.textSecondary : colors.accent);
  const cardBackColor = color || (isDark ? '#3730A3' : '#312E81');
  const cardFrontColor = color || (isDark ? '#6366F1' : '#4F46E5');
  const sparkColor = color || '#FFFFFF';
  const sparkEndColor = color || '#06B6D4';

  // Render Mark Svg (Native 512x512 scaled via viewBox)
  const renderMark = (markSize: number) => {
    const markId = `logo_mark_${Math.random().toString(36).substring(2, 7)}`;

    if (monochrome || color) {
      return (
        <Svg width={markSize} height={markSize} viewBox="0 0 512 512">
          <Defs>
            <Mask id={`monoMask_${markId}`}>
              <Rect width="512" height="512" fill="#FFFFFF" />
              <Path
                d="M 256 168 Q 256 256 168 256 Q 256 256 256 344 Q 256 256 344 256 Q 256 256 256 168 Z"
                fill="#000000"
              />
              <Circle cx="340" cy="180" r="14" fill="#000000" />
              <Circle cx="172" cy="332" r="10" fill="#000000" />
            </Mask>
          </Defs>
          {/* Back Stack Card */}
          <Rect
            x="116"
            y="80"
            width="280"
            height="352"
            rx="44"
            transform="rotate(-10 256 256)"
            fill={primaryColor}
            opacity={0.5}
          />
          {/* Front Card with cut-out spark */}
          <Rect
            x="116"
            y="80"
            width="280"
            height="352"
            rx="44"
            fill={primaryColor}
            mask={`url(#monoMask_${markId})`}
          />
        </Svg>
      );
    }

    return (
      <Svg width={markSize} height={markSize} viewBox="0 0 512 512">
        <Defs>
          <LinearGradient id={`cardBack_${markId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={cardBackColor} />
            <Stop offset="100%" stopColor={isDark ? '#1E1B4B' : '#1E1B4B'} />
          </LinearGradient>
          <LinearGradient id={`cardFront_${markId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={cardFrontColor} />
            <Stop offset="100%" stopColor={colors.primary} />
          </LinearGradient>
          <LinearGradient id={`spark_${markId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={sparkColor} />
            <Stop offset="60%" stopColor="#67E8F9" />
            <Stop offset="100%" stopColor={sparkEndColor} />
          </LinearGradient>
        </Defs>

        {/* Back Stack Card */}
        <Rect
          x="116"
          y="80"
          width="280"
          height="352"
          rx="44"
          transform="rotate(-10 256 256)"
          fill={`url(#cardBack_${markId})`}
          opacity={0.92}
        />

        {/* Front Card */}
        <Rect
          x="116"
          y="80"
          width="280"
          height="352"
          rx="44"
          fill={`url(#cardFront_${markId})`}
          stroke="#818CF8"
          strokeWidth="4"
          strokeOpacity={0.5}
        />

        {/* Center Synapse Spark */}
        <Path
          d="M 256 168 Q 256 256 168 256 Q 256 256 256 344 Q 256 256 344 256 Q 256 256 256 168 Z"
          fill={`url(#spark_${markId})`}
        />

        {/* Energy Satellite Dots */}
        <Circle cx="340" cy="180" r="14" fill="#22D3EE" />
        <Circle cx="172" cy="332" r="10" fill="#A5F3FC" opacity={0.85} />
      </Svg>
    );
  };

  // Render Wordmark only (Text with brand typography)
  const renderWordmark = (fontSize: number) => {
    if (rtl) {
      return (
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.wordmarkArabic,
              {
                fontSize,
                color: colors.text,
                textAlign: 'right',
              },
            ]}
          >
            <Text style={{ color: primaryColor }}>بطاقات</Text>{' '}
            <Text style={{ color: accentColor }}>الاستذكار</Text>
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.subtitleArabic,
                {
                  fontSize: Math.max(10, Math.round(fontSize * 0.38)),
                  color: colors.textMuted,
                  textAlign: 'right',
                },
              ]}
            >
              تكرار متباعد ذكي
            </Text>
          )}
        </View>
      );
    }

    return (
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.wordmarkLatin,
            {
              fontSize,
              color: colors.text,
              textAlign: 'left',
            },
          ]}
        >
          <Text style={{ color: primaryColor }}>Flash</Text>
          <Text style={{ color: accentColor }}>Cards</Text>
        </Text>
        {subtitle && (
          <Text
            style={[
              styles.subtitleLatin,
              {
                fontSize: Math.max(9, Math.round(fontSize * 0.34)),
                color: colors.textMuted,
                textAlign: 'left',
              },
            ]}
          >
            SMART SPACED REPETITION
          </Text>
        )}
      </View>
    );
  };

  if (variant === 'mark') {
    return <View style={style}>{renderMark(size)}</View>;
  }

  if (variant === 'wordmark') {
    return <View style={style}>{renderWordmark(size * 0.75)}</View>;
  }

  // Lockup: Mark + Wordmark (aligned for RTL/LTR)
  return (
    <View
      style={[
        styles.lockupContainer,
        { flexDirection: rtl ? 'row-reverse' : 'row' },
        style,
      ]}
    >
      {renderMark(size)}
      <View style={{ marginHorizontal: Math.round(size * 0.22) }}>
        {renderWordmark(size * 0.58)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  lockupContainer: {
    alignItems: 'center',
  },
  textContainer: {
    justifyContent: 'center',
  },
  wordmarkLatin: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  wordmarkArabic: {
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitleLatin: {
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  subtitleArabic: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
