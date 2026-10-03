import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const { colors, typography, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // On Android with 3 navigation buttons, insets.bottom is typically 48dp.
  // On devices with gesture bar, it's 16-24dp.
  // Ensure we always have comfortable padding so system buttons never obscure the tabs!
  const bottomInset = insets.bottom > 0 ? insets.bottom + 4 : 12;
  const tabHeight = 60 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surfaceRaised,
          borderTopWidth: 0,
          height: tabHeight,
          paddingBottom: bottomInset,
          elevation: 20,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={focused ? 24 : 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: t('nav.decks'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'albums' : 'albums-outline'}
              size={focused ? 24 : 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: t('nav.quiz'),
          tabBarIcon: ({ focused }) => (
            <View style={styles.fabContainer}>
              <View style={[styles.fab, { backgroundColor: colors.primary }]}>
                <Ionicons name="sparkles" size={24} color="#FFFFFF" />
              </View>
            </View>
          ),
          tabBarActiveTintColor: colors.primary,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('nav.stats'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={focused ? 24 : 22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={focused ? 24 : 22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
});
