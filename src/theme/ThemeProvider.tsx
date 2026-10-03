import React, { createContext, useContext, useState, useEffect } from 'react';
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
  motion
} from './tokens';
import { settingsRepository } from '../core/db/repositories/settingsRepository';

interface ThemeContextType {
  mode: ThemeMode;
  palette: ThemePalette;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  motion: typeof motion;
  isDark: boolean;
  palettesList: ThemePaletteInfo[];
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ThemePalette) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

        if (isMounted) {
          if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'amoled') {
            setModeState(savedMode);
          }
          if (savedPalette && (savedPalette in {
            indigo: 1, monochrome: 1, sapphire: 1, teal: 1,
            emerald: 1, violet: 1, coral: 1, amber: 1
          })) {
            setPaletteState(savedPalette as ThemePalette);
          }
        }
      } catch (e) {
        console.warn('Failed to load theme settings from storage:', e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const colors = getThemeColors(palette, mode);
  const isDark = mode === 'dark' || mode === 'amoled';

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    settingsRepository.set('theme_mode', newMode).catch(console.error);
  };

  const setPalette = (newPalette: ThemePalette) => {
    setPaletteState(newPalette);
    settingsRepository.set('theme_palette', newPalette).catch(console.error);
  };

  const toggleTheme = () => {
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(nextMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        palette,
        colors,
        typography,
        spacing,
        radius,
        motion,
        isDark,
        palettesList: PALETTES_LIST,
        setMode,
        setPalette,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
