import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Svg, { G, Rect, Circle, Path, Ellipse, Text as SvgText } from 'react-native-svg';
import { useTheme, alpha, lighten } from '../../theme';
import {
  MascotFigure,
  MascotExpression,
  MascotPose,
  MascotAccessory,
  sparkPath,
  useMascotColors,
  SPARK_GOLD,
} from './Mascot';

export type IllustrationName =
  | 'welcome'
  | 'empty-decks'
  | 'all-done'
  | 'search'
  | 'backup'
  | 'quiz'
  | 'stats'
  | 'locked'
  | 'sleep'
  | 'error'
  | 'audio'
  | 'import'
  | 'learn'
  | 'review'
  | 'settings'
  | 'ai';

interface SceneSpec {
  expression: MascotExpression;
  pose: MascotPose;
  accessory?: MascotAccessory;
}

const SCENES: Record<IllustrationName, SceneSpec> = {
  welcome: { expression: 'happy', pose: 'wave', accessory: 'cap' },
  'empty-decks': { expression: 'happy', pose: 'point' },
  'all-done': { expression: 'excited', pose: 'cheer' },
  search: { expression: 'thinking', pose: 'idle', accessory: 'glasses' },
  backup: { expression: 'wink', pose: 'idle' },
  quiz: { expression: 'thinking', pose: 'point' },
  stats: { expression: 'happy', pose: 'point', accessory: 'glasses' },
  locked: { expression: 'wink', pose: 'idle' },
  sleep: { expression: 'sleepy', pose: 'idle' },
  error: { expression: 'sad', pose: 'idle' },
  audio: { expression: 'happy', pose: 'idle', accessory: 'headphones' },
  import: { expression: 'excited', pose: 'cheer' },
  learn: { expression: 'happy', pose: 'wave', accessory: 'glasses' },
  review: { expression: 'excited', pose: 'point' },
  settings: { expression: 'wink', pose: 'wave' },
  ai: { expression: 'excited', pose: 'point', accessory: 'glasses' },
};

const Sparkle: React.FC<{ x: number; y: number; s: number; color: string; opacity?: number }> = ({
  x,
  y,
  s,
  color,
  opacity = 1,
}) => <Path d={sparkPath(x, y, s)} fill={color} opacity={opacity} />;

/** Scene-specific props drawn around the mascot (canvas: 240 × 200). */
const Props: React.FC<{ name: IllustrationName; body: string; accent: string; ink: string }> = ({
  name,
  body,
  accent,
  ink,
}) => {
  const green = '#22C55E';
  const pink = '#FF7AA8';
  switch (name) {
    case 'empty-decks':
      return (
        <G>
          <G transform="rotate(-12 196 120)">
            <Rect x={176} y={96} width={40} height={52} rx={9} fill={lighten(accent, 0.5)} />
            <Rect x={182} y={104} width={22} height={4} rx={2} fill={accent} opacity={0.6} />
          </G>
          <Circle cx={204} cy={64} r={17} fill={green} />
          <Path d="M 204 56 L 204 72 M 196 64 L 212 64" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
        </G>
      );
    case 'all-done':
      return (
        <G>
          {[
            [30, 40, pink, 20],
            [56, 18, SPARK_GOLD, -15],
            [190, 30, accent, 30],
            [214, 70, green, -25],
            [22, 100, accent, 45],
            [204, 130, pink, 10],
          ].map(([x, y, c, r], i) => (
            <Rect
              key={i}
              x={x as number}
              y={y as number}
              width={10}
              height={5}
              rx={2}
              fill={c as string}
              transform={`rotate(${r} ${x} ${y})`}
            />
          ))}
          <Circle cx={170} cy={22} r={4} fill={green} />
          <Circle cx={40} cy={70} r={3.5} fill={SPARK_GOLD} />
        </G>
      );
    case 'search':
      return (
        <G>
          <Circle cx={196} cy={86} r={20} fill={alpha('#FFFFFF', 0.5)} stroke={ink} strokeWidth={6} />
          <Path d="M 210 101 L 226 118" stroke={ink} strokeWidth={8} strokeLinecap="round" />
          <SvgText x={34} y={62} fontSize={26} fontWeight="900" fill={accent}>?</SvgText>
        </G>
      );
    case 'backup':
    case 'import':
      return (
        <G>
          <Path
            d="M 172 74 Q 168 52 188 50 Q 196 34 214 42 Q 232 44 228 62 Q 236 74 222 78 L 180 78 Q 170 78 172 74 Z"
            fill={lighten(accent, 0.55)}
            stroke={accent}
            strokeWidth={2.5}
          />
          {name === 'backup' ? (
            <Path d="M 191 62 L 198 69 L 212 55" stroke={green} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ) : (
            <Path d="M 201 52 L 201 70 M 193 63 L 201 71 L 209 63" stroke={body} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          )}
        </G>
      );
    case 'quiz':
    case 'ai':
      return (
        <G>
          <Circle cx={200} cy={56} r={18} fill={SPARK_GOLD} />
          <Rect x={193} y={72} width={14} height={10} rx={3} fill={ink} opacity={0.75} />
          <Path d="M 200 20 L 200 30 M 226 30 L 219 37 M 174 30 L 181 37" stroke={SPARK_GOLD} strokeWidth={3.5} strokeLinecap="round" />
          {name === 'quiz' ? (
            <SvgText x={34} y={70} fontSize={30} fontWeight="900" fill={accent}>?</SvgText>
          ) : (
            <Sparkle x={42} y={60} s={12} color={accent} />
          )}
        </G>
      );
    case 'stats':
      return (
        <G>
          <Rect x={176} y={110} width={12} height={34} rx={4} fill={accent} />
          <Rect x={194} y={92} width={12} height={52} rx={4} fill={body} />
          <Rect x={212} y={74} width={12} height={70} rx={4} fill={green} />
          <Path d="M 176 92 L 196 74 L 210 82 L 228 56" stroke={SPARK_GOLD} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      );
    case 'locked':
      return (
        <G>
          <Path d="M 186 78 L 186 66 Q 186 50 202 50 Q 218 50 218 66 L 218 78" stroke={ink} strokeWidth={6} fill="none" />
          <Rect x={178} y={76} width={48} height={40} rx={10} fill={SPARK_GOLD} />
          <Circle cx={202} cy={93} r={5} fill={ink} />
          <Rect x={200} y={95} width={4} height={10} rx={2} fill={ink} />
        </G>
      );
    case 'sleep':
      return (
        <G>
          <Path d="M 214 24 A 22 22 0 1 0 226 62 A 17 17 0 1 1 214 24 Z" fill={SPARK_GOLD} />
          <SvgText x={172} y={62} fontSize={18} fontWeight="900" fill={accent}>z</SvgText>
          <SvgText x={186} y={44} fontSize={13} fontWeight="900" fill={accent} opacity={0.7}>z</SvgText>
        </G>
      );
    case 'error':
      return (
        <G>
          <Path d="M 200 40 L 224 82 L 176 82 Z" fill={SPARK_GOLD} stroke={SPARK_GOLD} strokeWidth={6} strokeLinejoin="round" />
          <Rect x={197.5} y={52} width={5} height={16} rx={2.5} fill={ink} />
          <Circle cx={200} cy={75} r={3} fill={ink} />
        </G>
      );
    case 'audio':
      return (
        <G>
          <Path d="M 186 40 L 186 74" stroke={accent} strokeWidth={4} strokeLinecap="round" />
          <Path d="M 186 40 L 210 34 L 210 66" stroke={accent} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Ellipse cx={181} cy={76} rx={7} ry={5.5} fill={accent} />
          <Ellipse cx={205} cy={68} rx={7} ry={5.5} fill={accent} />
          <Path d="M 30 70 Q 22 84 30 98 M 40 64 Q 28 84 40 104" stroke={body} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
        </G>
      );
    case 'learn':
      return (
        <G>
          <Path d="M 176 70 Q 196 62 214 70 L 214 112 Q 196 104 176 112 Z" fill="#FFFFFF" stroke={accent} strokeWidth={3} />
          <Path d="M 214 70 Q 232 62 236 66 L 236 108 Q 232 104 214 112" fill={lighten(accent, 0.6)} stroke={accent} strokeWidth={3} />
          <Path d="M 184 80 L 206 76 M 184 90 L 206 86" stroke={accent} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
        </G>
      );
    case 'review':
      return (
        <G>
          <Circle cx={204} cy={64} r={22} fill="none" stroke={green} strokeWidth={5} strokeDasharray="100 40" strokeLinecap="round" />
          <Path d="M 222 46 L 226 58 L 214 58" stroke={green} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      );
    case 'settings':
      return (
        <G>
          <Circle cx={204} cy={62} r={16} fill="none" stroke={accent} strokeWidth={8} strokeDasharray="6 5" />
          <Circle cx={204} cy={62} r={8} fill={accent} />
        </G>
      );
    case 'welcome':
    default:
      return (
        <G>
          <Sparkle x={200} y={52} s={12} color={SPARK_GOLD} />
          <Sparkle x={36} y={56} s={8} color={accent} />
        </G>
      );
  }
};

export interface IllustrationProps {
  name: IllustrationName;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Draw the soft background blob (default true). */
  backdrop?: boolean;
  /** Drawn on a saturated brand surface (hero cards). */
  onColor?: boolean;
}

/** Friendly mascot scenes for empty states, celebrations and onboarding. */
export const Illustration: React.FC<IllustrationProps> = ({ name, size = 180, style, backdrop = true, onColor = false }) => {
  const { isDark } = useTheme();
  const { body, accent } = useMascotColors(onColor);
  const uid = React.useId().replace(/:/g, '_');
  const scene = SCENES[name];
  const ink = isDark ? '#E2E8F0' : '#1B1B3A';

  return (
    <View style={[{ width: size, height: size * (200 / 240) }, style]} accessible={false}>
      <Svg width="100%" height="100%" viewBox="0 0 240 200">
        {backdrop && (
          <>
            <Path
              d="M 120 18 C 170 14 214 44 212 98 C 210 150 172 186 118 184 C 62 182 26 150 28 98 C 30 48 70 22 120 18 Z"
              fill={alpha(body, isDark ? 0.16 : 0.1)}
            />
            <Circle cx={46} cy={150} r={6} fill={alpha(accent, 0.35)} />
            <Circle cx={204} cy={168} r={4} fill={alpha(body, 0.3)} />
            <Sparkle x={28} y={30} s={7} color={SPARK_GOLD} opacity={0.9} />
            <Sparkle x={222} y={150} s={6} color={accent} opacity={0.8} />
          </>
        )}
        <Props name={name} body={body} accent={accent} ink={ink} />
        <MascotFigure
          uid={uid}
          color={body}
          accent={accent}
          expression={scene.expression}
          pose={scene.pose}
          accessory={scene.accessory}
          x={64}
          y={30}
          scale={1.02}
        />
      </Svg>
    </View>
  );
};
