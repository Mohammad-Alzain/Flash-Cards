/**
 * Layout direction helpers.
 *
 * The native layout stays LTR (Expo's `supportsRTL` is off), so Arabic layouts
 * are mirrored in JS. Every component should go through this hook (or the
 * `Row`/`AppText` primitives) instead of sprinkling `rtl ? … : …` ternaries.
 */
import { useTranslation } from 'react-i18next';
import { I18nManager, ViewStyle, TextStyle } from 'react-native';

export interface Direction {
  rtl: boolean;
  /** Arabic script is active (drives font family + line height). */
  arabic: boolean;
  row: 'row' | 'row-reverse';
  textAlign: 'left' | 'right';
  /** Cross-axis alignment for the logical start edge in a column. */
  alignStart: 'flex-start' | 'flex-end';
  alignEnd: 'flex-start' | 'flex-end';
  /** Ionicons names pointing forward/back in reading order. */
  forwardIcon: 'chevron-forward' | 'chevron-back';
  backIcon: 'chevron-back' | 'chevron-forward';
  arrowForwardIcon: 'arrow-forward' | 'arrow-back';
  arrowBackIcon: 'arrow-back' | 'arrow-forward';
  /** Logical margins/paddings/positions → physical styles. */
  ms: (v: number) => ViewStyle;
  me: (v: number) => ViewStyle;
  ps: (v: number) => ViewStyle;
  pe: (v: number) => ViewStyle;
  start: (v: number) => ViewStyle;
  end: (v: number) => ViewStyle;
  /** Pick a value by direction: `pick(ltrValue, rtlValue)`. */
  pick: <T>(ltr: T, rtl: T) => T;
  text: TextStyle;
}

export const resolveDirection = (language: string): Direction => {
  const rtl = language === 'ar' || I18nManager.isRTL;
  return {
    rtl,
    arabic: language === 'ar',
    row: rtl ? 'row-reverse' : 'row',
    textAlign: rtl ? 'right' : 'left',
    alignStart: rtl ? 'flex-end' : 'flex-start',
    alignEnd: rtl ? 'flex-start' : 'flex-end',
    forwardIcon: rtl ? 'chevron-back' : 'chevron-forward',
    backIcon: rtl ? 'chevron-forward' : 'chevron-back',
    arrowForwardIcon: rtl ? 'arrow-back' : 'arrow-forward',
    arrowBackIcon: rtl ? 'arrow-forward' : 'arrow-back',
    ms: (v) => (rtl ? { marginRight: v } : { marginLeft: v }),
    me: (v) => (rtl ? { marginLeft: v } : { marginRight: v }),
    ps: (v) => (rtl ? { paddingRight: v } : { paddingLeft: v }),
    pe: (v) => (rtl ? { paddingLeft: v } : { paddingRight: v }),
    start: (v) => (rtl ? { right: v } : { left: v }),
    end: (v) => (rtl ? { left: v } : { right: v }),
    pick: (ltr, r) => (rtl ? r : ltr),
    text: { textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' },
  };
};

const cache = new Map<string, Direction>();

/** Re-renders on language change (via react-i18next) and returns direction helpers. */
export const useDirection = (): Direction => {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const key = `${lang}:${I18nManager.isRTL}`;
  let dir = cache.get(key);
  if (!dir) {
    dir = resolveDirection(lang);
    cache.set(key, dir);
  }
  return dir;
};
