import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection, ThemeMode, getThemeColors, alpha } from '../../theme';
import { changeLanguage, USER_LANGUAGE_KEY } from '../../i18n';
import { Screen, Header, Row, AppText, SectionHeader, PressableScale, Card } from '../../components/ui';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';

const MODES: { mode: ThemeMode; key: string }[] = [
  { mode: 'light', key: 'settings.theme_light' },
  { mode: 'dark', key: 'settings.theme_dark' },
  { mode: 'amoled', key: 'settings.theme_amoled' },
];

/** Miniature app mock-up rendered in a palette/mode's colours. */
const ThemePreview: React.FC<{ bg: string; surface: string; primary: string; accent: string; text: string }> = ({ bg, surface, primary, accent, text }) => (
  <View style={{ height: 78, borderRadius: 14, backgroundColor: bg, padding: 8, gap: 5, overflow: 'hidden' }}>
    <View style={{ height: 22, borderRadius: 8, backgroundColor: primary }} />
    <Row gap={5}>
      <View style={{ flex: 1, height: 16, borderRadius: 6, backgroundColor: surface }} />
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: accent }} />
    </Row>
    <View style={{ width: '60%', height: 6, borderRadius: 3, backgroundColor: alpha(text, 0.35) }} />
  </View>
);

export default function AppearanceSettingsScreen() {
  const router = useRouter();
  const { mode, setMode, palette, setPalette, palettesList, colors, shadow } = useTheme();
  const dir = useDirection();
  const { t, i18n } = useTranslation();

  const pickLanguage = async (lang: 'ar' | 'en') => {
    await changeLanguage(lang);
    await settingsRepository.set('language', lang);
    await settingsRepository.set(USER_LANGUAGE_KEY, lang);
  };

  const selectedBorder = (selected: boolean) => ({
    borderWidth: 2,
    borderColor: selected ? colors.primary : colors.border,
    backgroundColor: selected ? alpha(colors.primary, 0.06) : colors.surfaceRaised,
  });

  return (
    <Screen decor header={<Header title={t('settings.appearance')} subtitle={t('appearance.subtitle')} icon="color-palette" iconTone="pink" onBack={() => router.back()} />}>
      {/* Mode */}
      <SectionHeader title={t('appearance.mode_title')} icon="contrast" tone="indigo" />
      <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 10 }}>
        {t('appearance.mode_desc')}
      </AppText>
      <Row gap={10} align="stretch" style={{ marginBottom: 24 }}>
        {MODES.map((m) => {
          const c = getThemeColors(palette, m.mode);
          const selected = mode === m.mode;
          return (
            <PressableScale key={m.mode} onPress={() => setMode(m.mode)} haptic style={[{ flex: 1, padding: 8, borderRadius: 20 }, selectedBorder(selected), selected ? null : shadow(1)]}>
              <ThemePreview bg={c.background} surface={c.surfaceRaised} primary={c.primary} accent={c.accent} text={c.text} />
              <Row gap={4} justify="center" style={{ marginTop: 8 }}>
                {selected && <Ionicons name="checkmark-circle" size={15} color={colors.primary} />}
                <AppText variant="caption" weight="extrabold" color={selected ? 'primary' : 'text'} align="center" numberOfLines={1}>
                  {t(m.key)}
                </AppText>
              </Row>
            </PressableScale>
          );
        })}
      </Row>

      {/* Palette */}
      <SectionHeader title={t('appearance.palette_title')} icon="color-palette" tone="pink" />
      <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 10 }}>
        {t('appearance.palette_desc')}
      </AppText>
      <Row wrap gap={10} style={{ marginBottom: 24 }}>
        {palettesList.map((p) => {
          const c = getThemeColors(p.id, mode);
          const selected = palette === p.id;
          return (
            <PressableScale
              key={p.id}
              onPress={() => setPalette(p.id)}
              haptic
              style={[{ width: '48%', flexGrow: 1, padding: 10, borderRadius: 20 }, selectedBorder(selected), selected ? null : shadow(1)]}
            >
              <ThemePreview bg={c.background} surface={c.surfaceRaised} primary={c.primary} accent={c.accent} text={c.text} />
              <Row gap={8} style={{ marginTop: 8 }}>
                <Row>
                  {[c.primary, c.accent, c.gold].map((sw, i) => (
                    <View
                      key={i}
                      style={[
                        { width: 16, height: 16, borderRadius: 8, backgroundColor: sw, borderWidth: 2, borderColor: colors.surfaceRaised },
                        i > 0 ? dir.ms(-6) : null,
                      ]}
                    />
                  ))}
                </Row>
                <AppText variant="caption" weight="extrabold" color={selected ? 'primary' : 'text'} numberOfLines={1} style={{ flex: 1 }}>
                  {dir.arabic ? p.nameAr : p.nameEn}
                </AppText>
                {selected && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
              </Row>
            </PressableScale>
          );
        })}
      </Row>

      {/* Language */}
      <SectionHeader title={t('settings.language')} icon="language" tone="teal" />
      <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 10 }}>
        {t('appearance.language_desc')}
      </AppText>
      <Row gap={10} align="stretch">
        {([
          { lang: 'ar', glyph: 'ع', label: t('settings.lang_ar') },
          { lang: 'en', glyph: 'Aa', label: t('settings.lang_en') },
        ] as const).map((l) => {
          const selected = i18n.language === l.lang;
          return (
            <PressableScale key={l.lang} onPress={() => pickLanguage(l.lang)} haptic style={[{ flex: 1, padding: 14, borderRadius: 20, alignItems: 'center' }, selectedBorder(selected), selected ? null : shadow(1)]}>
              <Card variant={selected ? 'gradient' : 'flat'} padding={0} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <AppText size={24} weight="black" color={selected ? '#FFFFFF' : 'textSecondary'} align="center">
                  {l.glyph}
                </AppText>
              </Card>
              <AppText variant="bodySm" weight="extrabold" color={selected ? 'primary' : 'text'} align="center" style={{ marginTop: 8 }}>
                {l.label}
              </AppText>
            </PressableScale>
          );
        })}
      </Row>
    </Screen>
  );
}
