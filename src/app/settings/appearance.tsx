import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../../theme';
import { isRTL, changeLanguage } from '../../i18n';
import { Header, Card, Chip } from '../../components/ui';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';

export default function AppearanceSettingsScreen() {
  const router = useRouter();
  const { mode, setMode, palette, setPalette, palettesList, colors, typography, spacing } = useTheme();
  const { t, i18n } = useTranslation();
  const rtl = isRTL();

  const handleThemeChange = async (newMode: ThemeMode) => {
    setMode(newMode);
    await settingsRepository.set('theme_mode', newMode);
  };

  const handleLanguageChange = async (lang: 'ar' | 'en') => {
    await changeLanguage(lang);
    await settingsRepository.set('language', lang);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('settings.appearance')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Theme Mode Section */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
            <Ionicons
              name="moon-outline"
              size={22}
              color={colors.primary}
            />
            <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'وضع العرض (النهار / الليل)' : 'Display Mode'}
            </Text>
          </View>

          <Text style={[styles.cardDescription, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl ? 'اختر بين المظهر النهاري، الليلي الهادئ، أو سواد AMOLED الفائق' : 'Choose between Light, Dark, or AMOLED Black'}
          </Text>

          <View style={[styles.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 12 }]}>
            <Chip
              label={t('settings.theme_light')}
              selected={mode === 'light'}
              onPress={() => handleThemeChange('light')}
            />
            <Chip
              label={t('settings.theme_dark')}
              selected={mode === 'dark'}
              onPress={() => handleThemeChange('dark')}
            />
            <Chip
              label={t('settings.theme_amoled')}
              selected={mode === 'amoled'}
              onPress={() => handleThemeChange('amoled')}
            />
          </View>
        </Card>

        {/* Color Palette / Theme Styles Section */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
            <Ionicons
              name="color-palette-outline"
              size={22}
              color={colors.primary}
            />
            <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'لوحة ألوان التطبيق' : 'App Color Palette'}
            </Text>
          </View>

          <Text style={[styles.cardDescription, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl
              ? 'اختر النمط البصري المفضل لديك من بين 8 باليتات راقية ومريحة للعين'
              : 'Choose your preferred visual aesthetic from 8 curated palettes'}
          </Text>

          <View style={{ marginTop: 12, gap: 8 }}>
            {palettesList.map((p) => {
              const isSelected = palette === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPalette(p.id)}
                  style={({ pressed }) => [
                    {
                      flexDirection: rtl ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected
                        ? colors.surfaceRaised
                        : colors.surface,
                      opacity: pressed ? 0.8 : 1,
                      gap: 12,
                    },
                  ]}
                >
                  {/* Color preview circle */}
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: p.primaryColor,
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.15,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                  />

                  {/* Title & info */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: isSelected ? '700' : '500',
                        textAlign: rtl ? 'right' : 'left',
                      }}
                    >
                      {rtl ? p.nameAr : p.nameEn}
                    </Text>
                  </View>

                  {/* Radio selection indicator */}
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Language Section */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
            <Ionicons
              name="language-outline"
              size={22}
              color={colors.primary}
            />
            <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {t('settings.language')}
            </Text>
          </View>

          <Text style={[styles.cardDescription, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl ? 'اختر لغة واجهة التطبيق والاتجاه المناسب' : 'Select interface language and display direction'}
          </Text>

          <View style={[styles.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 12 }]}>
            <Chip
              label={t('settings.lang_ar')}
              selected={i18n.language === 'ar'}
              onPress={() => handleLanguageChange('ar')}
            />
            <Chip
              label={t('settings.lang_en')}
              selected={i18n.language === 'en'}
              onPress={() => handleLanguageChange('en')}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  card: {
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  chipsRow: {
    flexWrap: 'wrap',
    gap: 8,
  },
});
