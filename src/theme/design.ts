/**
 * Design language layer on top of the palette tokens.
 *
 * - `tones`: a fixed categorical palette used for icon tiles, deck accents and
 *   feature colours. It stays stable across user palettes so every feature
 *   keeps its recognisable colour (review = green, learn = blue, quiz = violet…).
 * - `textVariants`: the type scale. Line heights are resolved per script in AppText.
 * - `elevation`: cross-platform shadow presets.
 */
import { Platform, ViewStyle } from 'react-native';

export type ToneName =
  | 'indigo'
  | 'violet'
  | 'pink'
  | 'rose'
  | 'orange'
  | 'amber'
  | 'lime'
  | 'green'
  | 'teal'
  | 'sky'
  | 'blue'
  | 'slate';

/** Foreground hue per tone, tuned for light and dark surfaces. */
export const toneHues: Record<ToneName, { light: string; dark: string }> = {
  indigo: { light: '#5B5BD6', dark: '#8B8DF8' },
  violet: { light: '#8B5CF6', dark: '#B197FC' },
  pink: { light: '#DB2777', dark: '#F472B6' },
  rose: { light: '#E5484D', dark: '#FF8589' },
  orange: { light: '#F97316', dark: '#FB923C' },
  amber: { light: '#D97706', dark: '#FBBF24' },
  lime: { light: '#65A30D', dark: '#A3E635' },
  green: { light: '#16A34A', dark: '#4ADE80' },
  teal: { light: '#0D9488', dark: '#2DD4BF' },
  sky: { light: '#0284C7', dark: '#38BDF8' },
  blue: { light: '#2563EB', dark: '#60A5FA' },
  slate: { light: '#64748B', dark: '#94A3B8' },
};

/** Rotating accent tones for user content (decks etc.), picked by a stable hash. */
export const contentTones: ToneName[] = [
  'indigo',
  'violet',
  'pink',
  'orange',
  'teal',
  'sky',
  'green',
  'amber',
];

/** Stable string → tone mapping so a deck always keeps the same colour. */
export const toneForKey = (key: string): ToneName => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return contentTones[Math.abs(hash) % contentTones.length];
};

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'bodySm'
  | 'caption'
  | 'overline'
  | 'number';

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

export const textVariants: Record<
  TextVariant,
  { size: number; weight: FontWeightName; letterSpacing?: number; uppercase?: boolean }
> = {
  display: { size: 34, weight: 'black', letterSpacing: -0.5 },
  h1: { size: 26, weight: 'extrabold', letterSpacing: -0.3 },
  h2: { size: 21, weight: 'extrabold', letterSpacing: -0.2 },
  h3: { size: 18, weight: 'bold' },
  title: { size: 16, weight: 'bold' },
  body: { size: 15, weight: 'medium' },
  bodyStrong: { size: 15, weight: 'bold' },
  bodySm: { size: 13, weight: 'medium' },
  caption: { size: 12, weight: 'semibold' },
  overline: { size: 11, weight: 'extrabold', letterSpacing: 0.8, uppercase: true },
  number: { size: 22, weight: 'black' },
};

export type ElevationLevel = 0 | 1 | 2 | 3;

/** Soft, diffuse shadows. `color` lets primary surfaces cast a tinted glow. */
export const elevation = (level: ElevationLevel, color = '#0F172A'): ViewStyle => {
  if (level === 0) return {};
  const presets = {
    1: { y: 2, blur: 8, opacity: 0.06, android: 2 },
    2: { y: 6, blur: 16, opacity: 0.1, android: 5 },
    3: { y: 12, blur: 28, opacity: 0.16, android: 10 },
  } as const;
  const p = presets[level];
  return Platform.select<ViewStyle>({
    android: { elevation: p.android, shadowColor: color },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: p.y },
      shadowOpacity: p.opacity,
      shadowRadius: p.blur / 2,
    },
  })!;
};

/** Semantic corner radii for the redesigned components. */
export const shape = {
  chip: 999,
  input: 16,
  button: 18,
  card: 22,
  tile: 14,
  sheet: 30,
  hero: 28,
};
