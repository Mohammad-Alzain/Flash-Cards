import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';

import en from './translations/en.json';
import ar from './translations/ar.json';

const resources = {
  en: { translation: en },
  ar: { translation: ar },
};

// Detect primary system language
const systemLocales = Localization.getLocales();
const primaryLanguage = systemLocales?.[0]?.languageCode || 'ar';
const initialLang = primaryLanguage === 'ar' ? 'ar' : 'en';

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export const changeLanguage = async (lang: 'ar' | 'en') => {
  await i18n.changeLanguage(lang);
  const isRTL = lang === 'ar';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
    // Note: in React Native, changing RTL dynamically may require app reload for full native layout direction
  }
};

export const isRTL = () => i18n.language === 'ar' || I18nManager.isRTL;

/**
 * Settings key holding the language the user explicitly picked. (The legacy
 * `language` key is seeded with a default, so it can't tell a choice apart.)
 */
export const USER_LANGUAGE_KEY = 'language_user_choice';

/** Re-applies the user's saved language choice; falls back to the system locale. */
export const restoreUserLanguage = async (read: (key: string) => Promise<string>) => {
  try {
    const saved = await read(USER_LANGUAGE_KEY);
    if ((saved === 'ar' || saved === 'en') && saved !== i18n.language) {
      await changeLanguage(saved);
    }
  } catch (e) {
    console.warn('Failed to restore language:', e);
  }
};

export default i18n;
