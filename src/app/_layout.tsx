import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../theme';
import { initializeDatabase } from '../core/db/connection';
import '../i18n'; // Init i18next

import { AppState, AppStateStatus } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppLockManager } from '../core/security/appLock';
import { LockOverlay } from '../components/security/LockOverlay';
import { CustomDialogContainer } from '../components/common/CustomDialog';

function RootApp() {
  const { colors, isDark } = useTheme();
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }

    initializeDatabase()
      .then(async () => {
        setDbReady(true);
        const locked = await AppLockManager.evaluateAppResume();
        if (locked) setIsLocked(true);
      })
      .catch((err) => {
        console.error('Database initialization error:', err);
        setError(err.message || 'Failed to initialize database');
      });

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        AppLockManager.onAppBackground();
      } else if (nextState === 'active') {
        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        }
        const locked = await AppLockManager.evaluateAppResume();
        if (locked) setIsLocked(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 32 }]}>
        <Ionicons name="phone-portrait-outline" size={64} color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={[styles.errorTitle, { color: colors.primary, fontSize: 24, textAlign: 'center', fontWeight: '800' }]}>
          تطبيق بطاقات الذاكرة (AnkiDroid)
        </Text>
        <Text style={[styles.errorDesc, { color: colors.text, fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 24, maxWidth: 500 }]}>
          هذا التطبيق مصمم ومبني بالكامل كـ تطبيق جوال أصيل (Native Mobile App) بمحرك قواعد بيانات SQLite محلي 100% أوفلاين.
        </Text>

        <View style={{ marginTop: 24, padding: 20, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border, maxWidth: 500, width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, textAlign: 'right' }}>
              طريقة التجربة على هاتفك:
            </Text>
            <Ionicons name="phone-portrait" size={18} color={colors.primary} style={{ marginLeft: 6 }} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 24, textAlign: 'right' }}>
            1. حمّل تطبيق <Text style={{ fontWeight: 'bold', color: colors.primary }}>Expo Go</Text> على هاتفك (Android أو iPhone).{'\n'}
            2. افتح كاميرا الهاتف أو Expo Go وامسح رمز الـ <Text style={{ fontWeight: 'bold', color: colors.primary }}>QR Code</Text> الظاهر في سطر الأوامر (Terminal).{'\n'}
            3. أو لتشغيل محاكي Android: اضغط حرف <Text style={{ fontWeight: 'bold', color: colors.primary }}>a</Text> في سطر الأوامر.
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>Database Error</Text>
        <Text style={[styles.errorDesc, { color: colors.textSecondary }]}>{error}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading Flashcards...
        </Text>
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal/add-note"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen name="decks/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="note-types/index" options={{ headerShown: false }} />
        <Stack.Screen name="note-types/[id]/fields" options={{ headerShown: false }} />
        <Stack.Screen name="note-types/[id]/templates" options={{ headerShown: false }} />
        <Stack.Screen name="note-types/gallery" options={{ headerShown: false }} />
        <Stack.Screen name="study/review" options={{ headerShown: false }} />
        <Stack.Screen name="study/learn" options={{ headerShown: false }} />
        <Stack.Screen name="study/complete" options={{ headerShown: false }} />
        <Stack.Screen name="import/index" options={{ headerShown: false }} />
        <Stack.Screen name="import/history" options={{ headerShown: false }} />
        <Stack.Screen name="quiz/play" options={{ headerShown: false }} />
        <Stack.Screen name="quiz/results" options={{ headerShown: false }} />
        <Stack.Screen name="planner/index" options={{ headerShown: false }} />
        <Stack.Screen name="profile/index" options={{ headerShown: false }} />
        <Stack.Screen name="browser/index" options={{ headerShown: false }} />
        <Stack.Screen name="tools/index" options={{ headerShown: false }} />
        <Stack.Screen name="tools/tags" options={{ headerShown: false }} />
        <Stack.Screen name="settings/backup" options={{ headerShown: false }} />
        <Stack.Screen name="settings/export" options={{ headerShown: false }} />
        <Stack.Screen name="settings/security" options={{ headerShown: false }} />
        <Stack.Screen name="settings/appearance" options={{ headerShown: false }} />
        <Stack.Screen name="settings/study" options={{ headerShown: false }} />
        <Stack.Screen name="settings/data" options={{ headerShown: false }} />
        <Stack.Screen name="settings/about" options={{ headerShown: false }} />
        <Stack.Screen name="study/podcast" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
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
  return (
    <View style={{ flex: 1, backgroundColor: '#131F24' }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootApp />
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 14,
    textAlign: 'center',
  },
});
