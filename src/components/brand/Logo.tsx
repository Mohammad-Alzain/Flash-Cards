import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle, Path, G, Mask, Ellipse } from 'react-native-svg';
import { useTheme, useDirection } from '../../theme';
import { AppText } from '../ui/AppText';
import { MascotFigure, sparkPath, SPARK_GOLD } from '../illustrations/Mascot';

/** Brand palette (fixed, independent of the user's theme palette). Mirrors scripts/brand/logoSvg.js. */
export const BRAND = {
  bgTop: '#2E2A7A',
  bgBottom: '#12112E',
  glow: '#6366F1',
  body: '#6366F1',
  cyan: '#22D3EE',
  splashBg: '#0B0F19',
};

/** Mascot centred in a 512 box at the given scale (same placement maths as the asset generator). */
const placed = (scale: number, centerY: number) => ({ x: 256 - 60 * scale, y: centerY - 76 * scale, scale });

const BrandSparks: React.FC = () => (
  <>
    <Path d={sparkPath(112, 128, 26)} fill={SPARK_GOLD} />
    <Path d={sparkPath(404, 398, 16)} fill="#FFFFFF" opacity={0.85} />
    <Circle cx={414} cy={112} r={11} fill={BRAND.cyan} />
    <Circle cx={122} cy={404} r={7} fill="#A5F3FC" opacity={0.8} />
  </>
);

/** The logo mark: the mascot on a night-indigo squircle. */
export const LogoMark: React.FC<{ size: number; monochrome?: string }> = ({ size, monochrome }) => {
  const uid = React.useId().replace(/:/g, '_');
  const m = placed(2.3, 266);

  if (monochrome) {
    // Single-colour badge with the character's face cut out.
    return (
      <Svg width={size} height={size} viewBox="0 0 512 512">
        <Defs>
          <Mask id={`cut${uid}`}>
            <Rect width={512} height={512} fill="#FFFFFF" />
            <G transform={`translate(${m.x} ${m.y}) scale(${m.scale}) rotate(-4 60 74)`}>
              <Rect x={14} y={14} width={92} height={120} rx={24} fill="#000000" />
            </G>
          </Mask>
          <Mask id={`face${uid}`}>
            <Rect width={512} height={512} fill="#FFFFFF" />
            <G transform={`translate(${m.x} ${m.y}) scale(${m.scale}) rotate(-4 60 74)`}>
              <Ellipse cx={42} cy={64} rx={10} ry={11.5} fill="#000000" />
              <Ellipse cx={78} cy={64} rx={10} ry={11.5} fill="#000000" />
              <Path d="M 49 85 Q 60 97 71 85" stroke="#000000" strokeWidth={5} strokeLinecap="round" fill="none" />
            </G>
          </Mask>
        </Defs>
        <Rect width={512} height={512} rx={124} fill={monochrome} opacity={0.18} mask={`url(#cut${uid})`} />
        <G mask={`url(#face${uid})`}>
          <G transform={`translate(${m.x} ${m.y}) scale(${m.scale}) rotate(-4 60 74)`}>
            <Rect x={14} y={14} width={92} height={120} rx={24} fill={monochrome} />
          </G>
        </G>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <LinearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.bgTop} />
          <Stop offset="1" stopColor={BRAND.bgBottom} />
        </LinearGradient>
        <RadialGradient id={`glow${uid}`} cx="0.5" cy="0.46" r="0.5">
          <Stop offset="0" stopColor={BRAND.glow} stopOpacity={0.55} />
          <Stop offset="1" stopColor={BRAND.glow} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`rim${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={512} height={512} rx={124} fill={`url(#bg${uid})`} />
      <Rect x={3} y={3} width={506} height={506} rx={121} fill="none" stroke={`url(#rim${uid})`} strokeWidth={6} />
      <Circle cx={256} cy={236} r={230} fill={`url(#glow${uid})`} />
      <BrandSparks />
      <MascotFigure uid={uid} color={BRAND.body} accent={BRAND.cyan} {...m} />
    </Svg>
  );
};

/** "FlashCards" / "بطاقات الاستذكار" in the brand fonts. */
export const Wordmark: React.FC<{ size: number; subtitle?: boolean; onDark?: boolean; align?: 'auto' | 'center' }> = ({
  size,
  subtitle,
  onDark,
  align = 'auto',
}) => {
  const { colors } = useTheme();
  const dir = useDirection();
  const first = onDark ? '#A5B4FC' : colors.primary;
  const second = onDark ? BRAND.cyan : colors.accent;
  return (
    <View>
      <AppText size={size} weight="black" align={align} style={{ letterSpacing: dir.arabic ? 0 : -0.5, lineHeight: Math.round(size * (dir.arabic ? 1.45 : 1.15)) }}>
        {dir.arabic ? (
          <>
            <AppText size={size} weight="black" color={first}>بطاقات </AppText>
            <AppText size={size} weight="black" color={second}>الاستذكار</AppText>
          </>
        ) : (
          <>
            <AppText size={size} weight="black" color={first}>Flash</AppText>
            <AppText size={size} weight="black" color={second}>Cards</AppText>
          </>
        )}
      </AppText>
      {subtitle && (
        <AppText
          size={Math.max(9, Math.round(size * (dir.arabic ? 0.4 : 0.32)))}
          weight="bold"
          color={onDark ? 'rgba(255,255,255,0.6)' : 'textMuted'}
          align={align}
          style={{ letterSpacing: dir.arabic ? 0 : 1.6, marginTop: 2 }}
        >
          {dir.arabic ? 'تكرار متباعد ذكي' : 'SMART SPACED REPETITION'}
        </AppText>
      )}
    </View>
  );
};

export interface LogoProps {
  variant?: 'mark' | 'wordmark' | 'lockup';
  /** Mark height in px (default 40). */
  size?: number;
  monochrome?: boolean;
  /** Single-colour override (implies monochrome). */
  color?: string;
  subtitle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Logo: React.FC<LogoProps> = ({ variant = 'mark', size = 40, monochrome = false, color, subtitle = false, style }) => {
  const { colors } = useTheme();
  const dir = useDirection();
  const mono = color ?? (monochrome ? colors.text : undefined);

  if (variant === 'mark') {
    return (
      <View style={style}>
        <LogoMark size={size} monochrome={mono} />
      </View>
    );
  }
  if (variant === 'wordmark') {
    return (
      <View style={style}>
        <Wordmark size={size * 0.75} subtitle={subtitle} />
      </View>
    );
  }
  return (
    <View style={[{ flexDirection: dir.row, alignItems: 'center', gap: Math.round(size * 0.24) }, style]}>
      <LogoMark size={size} monochrome={mono} />
      <Wordmark size={size * 0.56} subtitle={subtitle} />
    </View>
  );
};
