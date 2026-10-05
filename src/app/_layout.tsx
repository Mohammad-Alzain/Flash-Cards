import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useTranslation } from 'react-i18next';
import { ThemeProvider, useTheme, fontAssets, markFontsReady } from '../theme';
import { initializeDatabase } from '../core/db/connection';
import { restoreUserLanguage } from '../i18n'; // also initialises i18next
import { AppLockManager } from '../core/security/appLock';
import { LockOverlay } from '../components/security/LockOverlay';
import { CustomDialogContainer } from '../components/common/CustomDialog';
import { settingsRepository } from '../core/db/repositories/settingsRepository';
import { notificationService } from '../core/notifications/notificationService';
import { reminderService } from '../core/reminders/reminderService';
import { Logo } from '../components/brand/Logo';
import { AnimatedSplash } from '../components/brand/AnimatedSplash';
import { Illustration } from '../components/illustrations';
import { AppText, Card, Row, IconTile } from '../components/ui';

// Prevent native splash screen from auto hiding before DB initialization
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Minimum gap between automatic "quick card" prompts on app resume. */
const QUICK_CARD_COOLDOWN_MS = 5 * 60 * 1000;

function WebNotice() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Illustration name="welcome" size={220} />
      <AppText variant="h1" align="center" style={{ marginTop: 12 }}>
        {t('app.web_title')}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: 8, maxWidth: 480 }}>
        {t('app.web_desc')}
      </AppText>
      <Card style={{ marginTop: 24, maxWidth: 480, width: '100%' }}>
        <Row gap={10} style={{ marginBottom: 12 }}>
          <IconTile icon="phone-portrait" tone="indigo" size={36} />
          <AppText variant="title">{t('app.web_steps_title')}</AppText>
        </Row>
        {[t('app.web_step_1'), t('app.web_step_2'), t('app.web_step_3')].map((step, i) => (
          <Row key={i} gap={10} align="flex-start" style={{ marginTop: 6 }}>
            <AppText variant="bodyStrong" color="primary">
              {i + 1}.
            </AppText>
            <AppText variant="body" color="textSecondary" style={{ flex: 1 }}>
              {step}
            </AppText>
          </Row>
        ))}
      </Card>
    </View>
  );
}

function RootApp({ onReady }: { onReady: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const lastQuickCardTimeRef = useRef<number>(0);

  // The animated splash (not this screen) hides the native splash.
  useEffect(() => {
    if (dbReady || error || Platform.OS === 'web') onReady();
  }, [dbReady, error, onReady]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }

    initializeDatabase()
      .then(async () => {
        await restoreUserLanguage((key) => settingsRepository.get(key, ''));
        setDbReady(true);
        const locked = await AppLockManager.evaluateAppResume();
        if (locked) setIsLocked(true);
        notificationService.registerCategories().catch(() => {});
        reminderService.resync();
      })
      .catch((err) => {
        console.error('Database initialization error:', err);
        setError(err.message || 'Failed to initialize database');
      });

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        AppLockManager.onAppBackground();
        return;
      }
      if (nextState !== 'active') return;

      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      }
      const locked = await AppLockManager.evaluateAppResume();
      if (locked) {
        setIsLocked(true);
        return;
      }
      // "Quick Card on App Open / Phone Unlock"
      try {
        const quickCardEnabled = await settingsRepository.get('quick_card_on_open', '0');
        const now = Date.now();
        if (quickCardEnabled === '1' && now - lastQuickCardTimeRef.current > QUICK_CARD_COOLDOWN_MS) {
          lastQuickCardTimeRef.current = now;
          setTimeout(() => router.push('/modal/quick-card'), 500);
        }
      } catch {}
    });

    // Listen to notification responses (interactive action buttons)
    let notifSub: { remove?: () => void } | null = null;
    try {
      const Notifications = require('expo-notifications');
      if (Notifications && typeof Notifications.addNotificationResponseReceivedListener === 'function') {
        notifSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response?.notification?.request?.content?.data;
          // Tapping a study reminder opens the reminder's deck (or stays on home).
          if (data?.kind === 'study_reminder' && data.deckId) {
            router.push(`/decks/${data.deckId}`);
            return;
          }
          notificationService.handleNotificationResponse(response);
        });
      }
    } catch {}

    return () => {
      subscription.remove();
      notifSub?.remove?.();
    };
  }, []);

  if (Platform.OS === 'web') {
    return <WebNotice />;
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Illustration name="error" size={220} />
        <AppText variant="h2" align="center" style={{ marginTop: 12 }}>
          {t('app.db_error_title')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: 6, maxWidth: 340 }}>
          {t('app.db_error_desc')}
        </AppText>
        <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: 14 }}>
          {error}
        </AppText>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Logo variant="lockup" size={52} subtitle style={{ marginBottom: 24 }} />
        <ActivityIndicator size="small" color={colors.primary} />
        <AppText variant="bodySm" color="textMuted" align="center" style={{ marginTop: 10 }}>
          {t('app.loading')}
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'default',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal/add-note" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modal/quick-card" options={{ presentation: 'modal' }} />
      </Stack>

      <LockOverlay
        visible={isLocked}
        onUnlocked={() => {
          setIsLocked(false);
          AppLockManager.setLocked(false);
        }}
      />

      <CustomDialogContainer />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Fonts resolve fast from the bundle; if they fail we fall back to system fonts.
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(Platform.OS === 'web');
  const handleReady = React.useCallback(() => setAppReady(true), []);
  markFontsReady(fontsLoaded && !fontError);
  // The native splash stays up (preventAutoHideAsync) until fonts are in.
  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootApp onReady={handleReady} />
          {!splashDone && <AnimatedSplash ready={appReady} onFinish={() => setSplashDone(true)} />}
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
