/**
 * Brand fonts: Nunito (rounded, friendly Latin) + Cairo (modern Arabic).
 * Custom fonts on Android ignore `fontWeight`, so each weight is its own family
 * and AppText resolves the family from the weight + current script.
 */
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
} from '@expo-google-fonts/cairo';
import type { FontWeightName } from './design';

export const fontAssets = {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
};

const weightSuffix: Record<FontWeightName, string> = {
  regular: '400Regular',
  medium: '500Medium',
  semibold: '600SemiBold',
  bold: '700Bold',
  extrabold: '800ExtraBold',
  black: '900Black',
};

let fontsReady = false;
export const markFontsReady = (ready: boolean) => {
  fontsReady = ready;
};

/** Returns the font family for a weight, or undefined (system font) until fonts load. */
export const fontFamilyFor = (weight: FontWeightName, arabic: boolean): string | undefined => {
  if (!fontsReady) return undefined;
  return `${arabic ? 'Cairo' : 'Nunito'}_${weightSuffix[weight]}`;
};

/** Line-height multiplier: Arabic glyphs need more vertical room than Latin. */
export const lineHeightFor = (size: number, arabic: boolean) =>
  Math.round(size * (arabic ? 1.6 : 1.35));
