import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  ThemeMode,
  ThemePalette,
  ThemeColors,
  getThemeColors,
  PALETTES_LIST,
  ThemePaletteInfo,
  typography,
  spacing,
  radius,
  motion,
} from './tokens';
import { ToneName, toneHues, elevation, ElevationLevel, shape } from './design';
import { alpha, mix } from './colorUtils';
import { settingsRepository } from '../core/db/repositories/settingsRepository';

export interface Tone {
  /** Icon / text colour. */
  fg: string;
  /** Soft tinted background. */
  bg: string;
  /** Subtle border for tinted surfaces. */
  border: string;
  /** Solid fill (for filled pills / gradients). */
  solid: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  palette: ThemePalette;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shape: typeof shape;
  motion: typeof motion;
  isDark: boolean;
  palettesList: ThemePaletteInfo[];
  /** Two-stop brand gradient derived from the active palette. */
  heroGradient: [string, string];
  tone: (name: ToneName) => Tone;
  shadow: (level: ElevationLevel, color?: string) => ReturnType<typeof elevation>;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ThemePalette) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const VALID_PALETTES = new Set<string>(PALETTES_LIST.map((p) => p.id));

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === 'dark' ? 'dark' : 'light');
  const [palette, setPaletteState] = useState<ThemePalette>('indigo');

  // Load persisted theme settings from SQLite on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [savedMode, savedPalette] = await Promise.all([
          settingsRepository.get('theme_mode', ''),
          settingsRepository.get('theme_palette', 'indigo'),
        ]);
        if (!isMounted) return;
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'amoled') {
          setModeState(savedMode);
        }
        if (savedPalette && VALID_PALETTES.has(savedPalette)) {
          setPaletteState(savedPalette as ThemePalette);
        }
      } catch (e) {
        console.warn('Failed to load theme settings from storage:', e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    settingsRepository.set('theme_mode', newMode).catch(console.error);
  }, []);

  const setPalette = useCallback((newPalette: ThemePalette) => {
    setPaletteState(newPalette);
    settingsRepository.set('theme_palette', newPalette).catch(console.error);
  }, []);

  const value = useMemo<ThemeContextType>(() => {
    const colors = getThemeColors(palette, mode);
    const isDark = mode === 'dark' || mode === 'amoled';
    const toneCache = new Map<ToneName, Tone>();

    const tone = (name: ToneName): Tone => {
      const cached = toneCache.get(name);
      if (cached) return cached;
      const fg = isDark ? toneHues[name].dark : toneHues[name].light;
      const t: Tone = {
        fg,
        bg: alpha(fg, isDark ? 0.16 : 0.12),
        border: alpha(fg, isDark ? 0.3 : 0.22),
        solid: toneHues[name].light,
      };
      toneCache.set(name, t);
      return t;
    };

    // Monochrome palettes would produce a flat grey hero; keep a touch of colour.
    const gradientEnd =
      palette === 'monochrome'
        ? isDark ? '#3F3F46' : '#3F3F46'
        : mix(colors.primary, colors.accent, 0.55);
    const gradientStart = palette === 'monochrome' ? (isDark ? '#27272A' : '#18181B') : colors.primary;

    return {
      mode,
      palette,
      colors,
      typography,
      spacing,
      radius,
      shape,
      motion,
      isDark,
      palettesList: PALETTES_LIST,
      heroGradient: [gradientStart, gradientEnd],
      tone,
      shadow: (level, color) => elevation(level, color ?? (isDark ? '#000000' : '#0F172A')),
      setMode,
      setPalette,
      toggleTheme: () => setMode(mode === 'light' ? 'dark' : 'light'),
    };
  }, [mode, palette, setMode, setPalette]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
