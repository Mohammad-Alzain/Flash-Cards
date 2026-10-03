import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Card, ProgressBar, ProgressRing } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { statsRepository, TodayStatsSummary } from '../../core/db/repositories/statsRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';

export default function StatsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const rtl = isRTL();

  const [stats, setStats] = useState<TodayStatsSummary>({
    newDone: 0,
    reviewsDone: 0,
    totalDone: 0,
    dailyGoal: 20,
    timeMs: 0,
    streakCurrent: 1,
    streakLongest: 1,
    xpTotal: 0,
  });
  const [cardCounts, setCardCounts] = useState({ due: 0, newCards: 0, learn: 0, total: 0 });

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        statsRepository.getTodaySummary(),
        cardRepository.getGlobalCounts(),
      ]).then(([s, c]) => {
        setStats(s);
        setCardCounts(c);
      });
    }, [])
  );

  const formatMinutes = (ms: number) => {
    const mins = Math.round(ms / 60000);
    return `${mins} min`;
  };

  const goalProgress = stats.dailyGoal > 0 ? Math.min(1, stats.totalDone / stats.dailyGoal) : 0;

  // Metric tiles config
  const metricTiles = [
    {
      key: 'reviews',
      icon: 'repeat' as const,
      color: colors.dueCards,
      value: stats.reviewsDone,
      label: t('stats.today_reviewed'),
    },
    {
      key: 'time',
      icon: 'time-outline' as const,
      color: '#10b981', // emerald
      value: formatMinutes(stats.timeMs),
      label: t('stats.total_time'),
    },
    {
      key: 'streak',
      icon: 'flame' as const,
      color: colors.warning,
      value: stats.streakCurrent,
      label: t('home.streak'),
    },
    {
      key: 'best',
      icon: 'trophy' as const,
      color: colors.gold,
      value: stats.streakLongest,
      label: t('stats.streak_record'),
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Hero Section ── */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: colors.primary,
              marginHorizontal: spacing.lg,
              marginTop: spacing.sm,
              borderRadius: 22,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.lg,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.22,
              shadowRadius: 12,
              elevation: 5,
            },
          ]}
        >
          {/* Left: total cards */}
          <View style={styles.heroLeft}>
            <Text style={styles.heroNumber}>{stats.totalDone}</Text>
            <Text style={styles.heroSubtitle}>بطاقات اليوم</Text>
          </View>

          {/* Right: streak badge */}
          <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.lg }]}>
            <Ionicons name="flame" size={28} color="#FF9600" />
            <Text style={styles.heroBadgeNumber}>{stats.streakCurrent}</Text>
            <Text style={styles.heroBadgeLabel}>{t('home.streak')}</Text>
          </View>
        </View>

        <View style={{ padding: spacing.lg }}>

          {/* ── 2×2 Metric Grid ── */}
          <View style={[styles.gridRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginBottom: spacing.md }]}>
            {metricTiles.slice(0, 2).map((tile, i) => (
              <View
                key={tile.key}
                style={[
                  styles.tile,
                  {
                    backgroundColor: `${tile.color}1A`, // 10% opacity hex
                    borderRadius: radius.md,
                    marginRight: !rtl && i === 0 ? spacing.sm : 0,
                    marginLeft: rtl && i === 0 ? spacing.sm : 0,
                  },
                ]}
              >
                <Ionicons name={tile.icon} size={20} color={tile.color} />
                <Text style={[styles.tileValue, { color: tile.color, fontSize: 28, fontWeight: typography.weights.bold }]}>
                  {tile.value}
                </Text>
                <Text style={[styles.tileLabel, { color: colors.textSecondary, fontSize: 11, textAlign: 'center' }]}>
                  {tile.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.gridRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginBottom: spacing.lg }]}>
            {metricTiles.slice(2, 4).map((tile, i) => (
              <View
                key={tile.key}
                style={[
                  styles.tile,
                  {
                    backgroundColor: `${tile.color}1A`,
                    borderRadius: radius.md,
                    marginRight: !rtl && i === 0 ? spacing.sm : 0,
                    marginLeft: rtl && i === 0 ? spacing.sm : 0,
                  },
                ]}
              >
                <Ionicons name={tile.icon} size={20} color={tile.color} />
                <Text style={[styles.tileValue, { color: tile.color, fontSize: 28, fontWeight: typography.weights.bold }]}>
                  {tile.value}
                </Text>
                <Text style={[styles.tileLabel, { color: colors.textSecondary, fontSize: 11, textAlign: 'center' }]}>
                  {tile.label}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Goal Ring Card ── */}
          <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
            <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <Ionicons
                name="radio-button-on"
                size={20}
                color={colors.primary}
                style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
              />
              <Text style={[styles.cardHeading, { color: colors.text, fontSize: typography.sizes.md, fontWeight: typography.weights.bold, textAlign: rtl ? 'right' : 'left' }]}>
                هدف اليوم
              </Text>
            </View>

            <View style={styles.ringContainer}>
              <ProgressRing
                progress={goalProgress}
                size={130}
                strokeWidth={12}
                color={colors.primary}
                label={`${stats.totalDone}/${stats.dailyGoal}`}
                sublabel={t('stats.today_reviewed')}
              />
            </View>
          </Card>

          {/* ── Collection Distribution Card ── */}
          <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
            <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <Ionicons
                name="stats-chart"
                size={20}
                color={colors.primary}
                style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
              />
              <Text style={[styles.cardHeading, { color: colors.text, fontSize: typography.sizes.md, fontWeight: typography.weights.bold, textAlign: rtl ? 'right' : 'left' }]}>
                {t('stats.all_time')} ({cardCounts.total} {t('decks.cards_badge', { count: 0 }).trim()})
              </Text>
            </View>

            {/* New */}
            <View style={{ marginTop: spacing.sm }}>
              <View style={[styles.barLabelRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Text style={{ color: colors.text, fontSize: typography.sizes.sm }}>
                  {t('decks.new_badge', { count: cardCounts.newCards })}
                </Text>
                <Text style={{ color: colors.newCards, fontWeight: 'bold' }}>
                  {cardCounts.total > 0 ? Math.round((cardCounts.newCards / cardCounts.total) * 100) : 0}%
                </Text>
              </View>
              <ProgressBar progress={cardCounts.total > 0 ? cardCounts.newCards / cardCounts.total : 0} color={colors.newCards} />
            </View>

            {/* Learning */}
            <View style={{ marginTop: spacing.sm }}>
              <View style={[styles.barLabelRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Text style={{ color: colors.text, fontSize: typography.sizes.sm }}>
                  {t('decks.learn_badge', { count: cardCounts.learn })}
                </Text>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                  {cardCounts.total > 0 ? Math.round((cardCounts.learn / cardCounts.total) * 100) : 0}%
                </Text>
              </View>
              <ProgressBar progress={cardCounts.total > 0 ? cardCounts.learn / cardCounts.total : 0} color={colors.primary} />
            </View>

            {/* Due */}
            <View style={{ marginTop: spacing.sm }}>
              <View style={[styles.barLabelRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Text style={{ color: colors.text, fontSize: typography.sizes.sm }}>
                  {t('decks.due_badge', { count: cardCounts.due })}
                </Text>
                <Text style={{ color: colors.dueCards, fontWeight: 'bold' }}>
                  {cardCounts.total > 0 ? Math.round((cardCounts.due / cardCounts.total) * 100) : 0}%
                </Text>
              </View>
              <ProgressBar progress={cardCounts.total > 0 ? cardCounts.due / cardCounts.total : 0} color={colors.dueCards} />
            </View>
          </Card>

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
  },
  heroNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 56,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.80)',
    marginTop: 2,
  },
  heroBadge: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginLeft: 12,
  },
  heroBadgeNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroBadgeLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },

  // 2×2 grid
  gridRow: {
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tileValue: {},
  tileLabel: {},

  // Cards
  sectionCard: {},
  cardHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeading: {},

  // Ring
  ringContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  // Bar sections
  barLabelRow: {
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});
