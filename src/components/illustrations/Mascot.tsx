import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Svg, { G, Rect, Circle, Ellipse, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme, lighten, darken, mix, luminance, toneHues } from '../../theme';

export type MascotExpression = 'happy' | 'excited' | 'sleepy' | 'thinking' | 'sad' | 'wink';
export type MascotPose = 'idle' | 'wave' | 'cheer' | 'point';
export type MascotAccessory = 'none' | 'headphones' | 'cap' | 'glasses';

const INK = '#1B1B3A';
const CHEEK = '#FF8FB1';
export const SPARK_GOLD = '#FFC24B';

/** Four-point "synapse spark" star path (brand motif). */
export const sparkPath = (cx: number, cy: number, s: number) =>
  `M ${cx} ${cy - s} Q ${cx} ${cy} ${cx + s} ${cy} Q ${cx} ${cy} ${cx} ${cy + s} Q ${cx} ${cy} ${cx - s} ${cy} Q ${cx} ${cy} ${cx} ${cy - s} Z`;

interface FigureProps {
  /** Body colour (defaults to the palette primary). */
  color: string;
  accent: string;
  expression?: MascotExpression;
  pose?: MascotPose;
  accessory?: MascotAccessory;
  /** Unique gradient id prefix. */
  uid: string;
  x?: number;
  y?: number;
  scale?: number;
}

const Eyes: React.FC<{ expression: MascotExpression }> = ({ expression }) => {
  const closedArc = (cx: number, up: boolean) =>
    up ? `M ${cx - 8} 66 Q ${cx} 56 ${cx + 8} 66` : `M ${cx - 7} 64 Q ${cx} 70 ${cx + 7} 64`;

  if (expression === 'excited') {
    return (
      <>
        <Path d={closedArc(42, true)} stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d={closedArc(78, true)} stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (expression === 'sleepy') {
    return (
      <>
        <Path d={closedArc(42, false)} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        <Path d={closedArc(78, false)} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      </>
    );
  }

  const look = expression === 'thinking' ? { dx: 3, dy: -4 } : expression === 'sad' ? { dx: 0, dy: 3 } : { dx: 1, dy: 2 };
  const eye = (cx: number, closed: boolean) =>
    closed ? (
      <Path d={closedArc(cx, true)} stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
    ) : (
      <>
        <Ellipse cx={cx} cy={64} rx={11} ry={12.5} fill="#FFFFFF" stroke={INK} strokeOpacity={0.12} strokeWidth={1.5} />
        <Circle cx={cx + look.dx} cy={64 + look.dy} r={6.5} fill={INK} />
        <Circle cx={cx + look.dx + 2.5} cy={64 + look.dy - 2.5} r={2.4} fill="#FFFFFF" />
      </>
    );

  return (
    <>
      {eye(42, expression === 'wink')}
      {eye(78, false)}
      {expression === 'sad' && (
        <>
          <Path d="M 32 49 L 48 53" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <Path d="M 88 49 L 72 53" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
    </>
  );
};

const Mouth: React.FC<{ expression: MascotExpression }> = ({ expression }) => {
  switch (expression) {
    case 'excited':
      return (
        <>
          <Path d="M 47 84 Q 60 104 73 84 Z" fill={INK} />
          <Ellipse cx={60} cy={94} rx={6} ry={3.5} fill={CHEEK} />
        </>
      );
    case 'sleepy':
      return <Ellipse cx={60} cy={88} rx={4} ry={4.5} fill={INK} />;
    case 'thinking':
      return <Path d="M 52 89 Q 60 86 68 87" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
    case 'sad':
      return <Path d="M 50 93 Q 60 84 70 93" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
    default:
      return <Path d="M 49 85 Q 60 97 71 85" stroke={INK} strokeWidth={3.8} strokeLinecap="round" fill="none" />;
  }
};

const Arms: React.FC<{ pose: MascotPose; color: string }> = ({ pose, color }) => {
  const stroke = { stroke: color, strokeWidth: 8, strokeLinecap: 'round' as const, fill: 'none' };
  const hand = (cx: number, cy: number) => <Circle cx={cx} cy={cy} r={6} fill={color} />;
  switch (pose) {
    case 'wave':
      return (
        <>
          <Path d="M 16 88 Q 4 96 6 108" {...stroke} />
          {hand(6, 109)}
          <Path d="M 104 80 Q 118 70 120 52" {...stroke} />
          {hand(120, 50)}
        </>
      );
    case 'cheer':
      return (
        <>
          <Path d="M 16 80 Q 2 66 2 50" {...stroke} />
          {hand(2, 48)}
          <Path d="M 104 80 Q 118 66 118 50" {...stroke} />
          {hand(118, 48)}
        </>
      );
    case 'point':
      return (
        <>
          <Path d="M 16 88 Q 4 96 6 108" {...stroke} />
          {hand(6, 109)}
          <Path d="M 104 86 Q 118 86 128 80" {...stroke} />
          {hand(129, 79)}
        </>
      );
    default:
      return (
        <>
          <Path d="M 16 88 Q 4 96 6 108" {...stroke} />
          {hand(6, 109)}
          <Path d="M 104 88 Q 116 96 114 108" {...stroke} />
          {hand(114, 109)}
        </>
      );
  }
};

const Accessory: React.FC<{ kind: MascotAccessory; accent: string }> = ({ kind, accent }) => {
  if (kind === 'headphones') {
    return (
      <>
        <Path d="M 14 62 Q 14 6 60 6 Q 106 6 106 62" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
        <Rect x={4} y={52} width={18} height={30} rx={8} fill={accent} stroke={INK} strokeWidth={3} />
        <Rect x={98} y={52} width={18} height={30} rx={8} fill={accent} stroke={INK} strokeWidth={3} />
      </>
    );
  }
  if (kind === 'cap') {
    return (
      <>
        <Path d="M 22 18 L 60 2 L 98 18 L 60 34 Z" fill={INK} />
        <Rect x={44} y={20} width={32} height={14} rx={3} fill={INK} />
        <Path d="M 96 18 L 98 38" stroke={SPARK_GOLD} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={98} cy={40} r={4} fill={SPARK_GOLD} />
      </>
    );
  }
  if (kind === 'glasses') {
    return (
      <>
        <Circle cx={42} cy={64} r={15} stroke={INK} strokeWidth={3.5} fill="none" />
        <Circle cx={78} cy={64} r={15} stroke={INK} strokeWidth={3.5} fill="none" />
        <Path d="M 57 64 L 63 64" stroke={INK} strokeWidth={3.5} />
      </>
    );
  }
  return null;
};

/**
 * The mascot drawn as an SVG group in a 120×150 local box, so scenes can
 * compose it with other artwork inside a single <Svg>.
 */
export const MascotFigure: React.FC<FigureProps> = ({
  color,
  accent,
  expression = 'happy',
  pose = 'idle',
  accessory = 'none',
  uid,
  x = 0,
  y = 0,
  scale = 1,
}) => {
  const limb = darken(color, 0.12);
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Defs>
        <LinearGradient id={`body${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={lighten(color, 0.22)} />
          <Stop offset="1" stopColor={color} />
        </LinearGradient>
      </Defs>

      {/* ground shadow */}
      <Ellipse cx={60} cy={146} rx={36} ry={5} fill="#000000" opacity={0.1} />

      {/* back card */}
      <G transform="rotate(10 63 70)">
        <Rect x={24} y={10} width={82} height={112} rx={18} fill={lighten(accent, 0.35)} />
      </G>

      <Arms pose={pose} color={limb} />

      {/* feet */}
      <Ellipse cx={42} cy={140} rx={11} ry={6.5} fill={limb} />
      <Ellipse cx={78} cy={140} rx={11} ry={6.5} fill={limb} />

      {/* body + face (tilted together) */}
      <G transform="rotate(-4 60 74)">
        <Rect x={14} y={14} width={92} height={120} rx={24} fill={`url(#body${uid})`} />
        <Rect x={22} y={20} width={50} height={10} rx={5} fill="#FFFFFF" opacity={0.22} />
        <Path d={sparkPath(94, 30, 9)} fill={SPARK_GOLD} />
        <Eyes expression={expression} />
        <Ellipse cx={28} cy={82} rx={7.5} ry={4.5} fill={CHEEK} opacity={0.7} />
        <Ellipse cx={92} cy={82} rx={7.5} ry={4.5} fill={CHEEK} opacity={0.7} />
        <Mouth expression={expression} />
        <Accessory kind={accessory} accent={accent} />
      </G>
    </G>
  );
};

/**
 * Mascot body/accent colours for the active palette.
 * - Monochrome palettes get the indigo tone so the character keeps its personality.
 * - `onColor` (mascot drawn on a brand-gradient surface) uses a pale tint so it
 *   doesn't vanish into the background.
 */
export const useMascotColors = (onColor = false) => {
  const { colors, isDark } = useTheme();
  const L = luminance(colors.primary);
  const tooNeutral = L > 0.7 || L < 0.02;
  const base = tooNeutral ? (isDark ? toneHues.indigo.dark : toneHues.indigo.light) : colors.primary;
  const accent = tooNeutral ? toneHues.sky.light : colors.accent;
  return onColor ? { body: mix(base, '#FFFFFF', 0.72), accent: SPARK_GOLD } : { body: base, accent };
};

export interface MascotProps {
  size?: number;
  expression?: MascotExpression;
  pose?: MascotPose;
  accessory?: MascotAccessory;
  color?: string;
  /** Drawn on a saturated brand surface (hero cards). */
  onColor?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Standalone mascot. */
export const Mascot: React.FC<MascotProps> = ({
  size = 120,
  expression = 'happy',
  pose = 'idle',
  accessory = 'none',
  color,
  onColor = false,
  style,
}) => {
  const { body, accent } = useMascotColors(onColor);
  const uid = React.useId().replace(/:/g, '_');
  return (
    <View style={[{ width: size, height: size * 1.1 }, style]}>
      <Svg width="100%" height="100%" viewBox="-12 -8 144 162">
        <MascotFigure
          uid={uid}
          color={color ?? body}
          accent={accent}
          expression={expression}
          pose={pose}
          accessory={accessory}
        />
      </Svg>
    </View>
  );
};
