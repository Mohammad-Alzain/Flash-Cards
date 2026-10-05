import React from 'react';
import { Text, TextProps, TextStyle, StyleProp, Platform } from 'react-native';
import {
  useTheme,
  useDirection,
  textVariants,
  TextVariant,
  FontWeightName,
  fontFamilyFor,
  lineHeightFor,
  ThemeColors,
} from '../../theme';

type ColorKey = keyof Pick<
  ThemeColors,
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'textInverse'
  | 'primary'
  | 'accent'
  | 'error'
  | 'warning'
  | 'gold'
  | 'newCards'
  | 'learningCards'
  | 'dueCards'
>;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  weight?: FontWeightName;
  /** Theme colour key or any raw colour string. Defaults to `text`. */
  color?: ColorKey | (string & {});
  /** `auto` follows reading direction; others are physical. */
  align?: 'auto' | 'center' | 'left' | 'right' | 'start' | 'end';
  size?: number;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

const COLOR_KEYS = new Set<string>([
  'text',
  'textSecondary',
  'textMuted',
  'textInverse',
  'primary',
  'accent',
  'error',
  'warning',
  'gold',
  'newCards',
  'learningCards',
  'dueCards',
]);

/**
 * The single text primitive. Resolves brand font family per script (Nunito / Cairo),
 * script-appropriate line height, and reading-direction alignment.
 */
export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  weight,
  color = 'text',
  align = 'auto',
  size,
  style,
  children,
  ...rest
}) => {
  const { colors } = useTheme();
  const dir = useDirection();
  const spec = textVariants[variant];
  const fontSize = size ?? spec.size;
  const resolvedWeight = weight ?? spec.weight;
  const family = fontFamilyFor(resolvedWeight, dir.arabic);

  const textAlign: TextStyle['textAlign'] =
    align === 'auto' || align === 'start'
      ? dir.textAlign
      : align === 'end'
      ? dir.rtl
        ? 'left'
        : 'right'
      : align;

  const resolvedColor = COLOR_KEYS.has(color) ? colors[color as ColorKey] : color;

  const base: TextStyle = {
    fontSize,
    lineHeight: lineHeightFor(fontSize, dir.arabic),
    color: resolvedColor,
    textAlign,
    writingDirection: dir.rtl ? 'rtl' : 'ltr',
    letterSpacing: dir.arabic ? 0 : spec.letterSpacing,
    textTransform: spec.uppercase && !dir.arabic ? 'uppercase' : 'none',
    ...(family
      ? { fontFamily: family }
      : { fontWeight: WEIGHT_NUMERIC[resolvedWeight] }),
    ...(Platform.OS === 'android' && !dir.arabic ? { includeFontPadding: false } : null),
  };

  return (
    <Text style={[base, style]} {...rest}>
      {children}
    </Text>
  );
};

const WEIGHT_NUMERIC: Record<FontWeightName, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};
