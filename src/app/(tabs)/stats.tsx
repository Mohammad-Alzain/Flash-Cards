import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Card, ProgressBar, ProgressRing, Badge } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import {
  statsRepository,
  TodayStatsSummary,
  DayActivityItem,
  CardMaturityBreakdown,
} from '../../core/db/repositories/statsRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { BrandStatsEmblem } from '../../components/brand/BrandStatsEmblem';

export default function StatsScreen() {
  const { colors, typography, spacing, radius, isDark } = useTheme();
  const { t } = useTranslation();
  const rtl = isRTL();

  const [refreshing, setRefreshing] = useState(false);
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
  const [weeklyActivity, setWeeklyActivity] = useState<DayActivityItem[]>([]);
  const [retentionRate, setRetentionRate] = useState(90);
  const [maturity, setMaturity] = useState<CardMaturityBreakdown>({
    newCards: 0,
    learning: 0,
    mature: 0,
    leeches: 0,
    total: 0,
  });

  const loadAllStats = useCallback(async () => {
    try {
      const [todaySum, counts, weekly, retention, mat] = await Promise.all([
        statsRepository.getTodaySummary(),
        cardRepository.getGlobalCounts(),
        statsRepository.getWeeklyActivity(),
        statsRepository.getRetentionRate(),
        statsRepository.getCardMaturity(),
      ]);
      setStats(todaySum);
      setCardCounts(counts);
      setWeeklyActivity(weekly);
      setRetentionRate(retention);
      setMaturity(mat);
    } catch (e) {
      console.error('Failed to load stats data:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllStats();
    }, [loadAllStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllStats();
    setRefreshing(false);
  };

  const formatMinutes = (ms: number) => {
    const mins = Math.round(ms / 60000);
    return rtl ? `${mins} دقيقة` : `${mins} min`;
  };

  const goalProgress = stats.dailyGoal > 0 ? Math.min(1, stats.totalDone / stats.dailyGoal) : 0;
  const goalPercent = Math.round(goalProgress * 100);

  // Maximum value for weekly chart scaling
  const maxWeeklyCount = Math.max(10, ...weeklyActivity.map((w) => w.count));

  // 4 Core Metrics Config
  const metricTiles = [
    {
      key: 'reviews',
      icon: 'repeat' as const,
      color: colors.dueCards || '#10B981',
      value: stats.reviewsDone,
      label: rtl ? 'مراجعات اليوم' : "Today's Reviews",
    },
    {
      key: 'time',
      icon: 'time-outline' as const,
      color: '#06B6D4', // Brand Cyan
      value: formatMinutes(stats.timeMs),
      label: rtl ? 'وقت المذاكرة' : 'Study Time',
    },
    {
      key: 'retention',
      icon: 'shield-checkmark' as const,
      color: colors.primary,
      value: `${retentionRate}%`,
      label: rtl ? 'معدل الاستذكار' : 'Retention Rate',
    },
    {
      key: 'best',
      icon: 'trophy' as const,
      color: colors.gold || '#F59E0B',
      value: stats.streakLongest,
      label: rtl ? 'أفضل رقم أيام' : 'Streak Record',
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* ── Screen Top Bar ─────────────────────────────────────────── */}
      <View
        style={[
          styles.screenTopBar,
          {
            flexDirection: rtl ? 'row-reverse' : 'row',
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
          <BrandStatsEmblem variant="kinetic-stack" size={32} />
          <Text
            style={[
              styles.screenTitle,
              {
                color: colors.text,
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.bold,
              },
            ]}
          >
            {t('stats.title')}
          </Text>
        </View>

        <Badge
          count={rtl ? `اليوم: ${stats.totalDone} بطاقة` : `Today: ${stats.totalDone}`}
          variant="accent"
          size="sm"
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── 1. Hero Banner: Artistic Brand Identity Crest ────────────── */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#1E1B4B' : colors.primary,
              borderColor: isDark ? '#3730A3' : 'rgba(255,255,255,0.2)',
              marginHorizontal: spacing.lg,
              marginTop: spacing.md,
            },
          ]}
        >
          <View style={[styles.heroRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {/* Left/Right Text Section */}
            <View style={[styles.heroTextSide, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
              <Text
                style={[
                  styles.heroSubtitle,
                  {
                    textAlign: rtl ? 'right' : 'left',
                    color: 'rgba(255, 255, 255, 0.82)',
                  },
                ]}
              >
                {rtl ? 'إجمالي إنجاز اليوم' : "Today's Study Progress"}
              </Text>

              {/* Numbers with explicit BiDi alignment */}
              <View
                style={[
                  styles.heroNumberRow,
                  {
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    gap: 6,
                  },
                ]}
              >
                <Text style={styles.heroBigNumber}>{stats.totalDone}</Text>
                <Text style={styles.heroGoalDenominator}>/ {stats.dailyGoal} {rtl ? 'بطاقة' : 'cards'}</Text>
              </View>

              {/* Progress mini-bar */}
              <View style={styles.heroProgressTrack}>
                <View
                  style={[
                    styles.heroProgressBar,
                    {
                      width: `${Math.min(100, goalPercent)}%`,
                      backgroundColor: '#22D3EE',
                    },
                  ]}
                />
              </View>

              <Text
                style={[
                  styles.heroGoalStatus,
                  {
                    textAlign: rtl ? 'right' : 'left',
                    color: 'rgba(255, 255, 255, 0.75)',
                  },
                ]}
              >
                {goalPercent >= 100
                  ? rtl
                    ? '🎉 اكتمل الهدف اليومي بنجاح!'
                    : '🎉 Daily goal completed!'
                  : rtl
                  ? `متبقي ${Math.max(0, stats.dailyGoal - stats.totalDone)} بطاقة لإكمال الهدف`
                  : `${Math.max(0, stats.dailyGoal - stats.totalDone)} cards remaining`}
              </Text>
            </View>

            {/* Emblem Right/Left side */}
            <View style={styles.heroEmblemContainer}>
              <BrandStatsEmblem variant="hero-spark" size={90} />
            </View>
          </View>
        </View>

        {/* ── 2. 2×2 Core Metric Tiles ──────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={[styles.gridRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {metricTiles.map((tile) => (
              <Card
                key={tile.key}
                style={[
                  styles.metricTile,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.metricTileTop,
                    {
                      flexDirection: rtl ? 'row-reverse' : 'row',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.metricIconCircle,
                      {
                        backgroundColor: `${tile.color}18`,
                      },
                    ]}
                  >
                    <Ionicons name={tile.icon} size={18} color={tile.color} />
                  </View>
                </View>

                {/* Metric Value */}
                <Text
                  style={[
                    styles.metricTileValue,
                    {
                      color: colors.text,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {tile.value}
                </Text>

                {/* Metric Label */}
                <Text
                  style={[
                    styles.metricTileLabel,
                    {
                      color: colors.textSecondary,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {tile.label}
                </Text>
              </Card>
            ))}
          </View>

          {/* ── 3. Weekly 7-Day Study Activity Chart ────────────────── */}
          <Card
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                marginTop: spacing.md,
              },
            ]}
          >
            <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="bar-chart" size={18} color={colors.primary} />
                <Text
                  style={[
                    styles.cardHeading,
                    {
                      color: colors.text,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {rtl ? 'نشاط المذاكرة (آخر 7 أيام)' : 'Weekly Activity (Last 7 Days)'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {rtl ? 'تحديث تلقائي' : 'Auto synced'}
              </Text>
            </View>

            {/* Bars Container */}
            <View
              style={[
                styles.chartContainer,
                {
                  flexDirection: rtl ? 'row-reverse' : 'row',
                },
              ]}
            >
              {weeklyActivity.map((day) => {
                const heightPercent = Math.max(8, Math.round((day.count / maxWeeklyCount) * 100));

                return (
                  <View key={day.date} style={styles.chartCol}>
                    {/* Count over bar */}
                    <Text
                      style={[
                        styles.barCountText,
                        {
                          color: day.isToday ? colors.primary : colors.textMuted,
                          fontWeight: day.isToday ? '800' : '500',
                        },
                      ]}
                    >
                      {day.count > 0 ? day.count : ''}
                    </Text>

                    {/* Bar Pillar */}
                    <View style={[styles.barTrack, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${heightPercent}%`,
                            backgroundColor: day.isToday
                              ? colors.primary
                              : day.count > 0
                              ? '#06B6D4'
                              : 'transparent',
                          },
                        ]}
                      />
                    </View>

                    {/* Day Name */}
                    <Text
                      style={[
                        styles.barDayText,
                        {
                          color: day.isToday ? colors.primary : colors.textSecondary,
                          fontWeight: day.isToday ? '800' : '600',
                        },
                      ]}
                    >
                      {rtl ? day.dayNameAr : day.dayNameEn}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* ── 4. Card Maturity Distribution (مستويات النضج) ───────── */}
          <Card
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                marginTop: spacing.md,
              },
            ]}
          >
            <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                <BrandStatsEmblem variant="retention-target" size={24} />
                <Text
                  style={[
                    styles.cardHeading,
                    {
                      color: colors.text,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {rtl ? 'مراحل نضج البطاقات وتكرارها' : 'Card Maturity Stages'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
                {cardCounts.total} {rtl ? 'بطاقة' : 'cards'}
              </Text>
            </View>

            {/* 1. New Cards */}
            <View style={styles.maturityRow}>
              <View style={[styles.maturityLabelRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.stageDot, { backgroundColor: colors.newCards || '#3B82F6' }]} />
                  <Text style={[styles.stageName, { color: colors.text }]}>
                    {rtl ? 'بطاقات جديدة (غير مدروسة)' : 'New (Unseen)'}
                  </Text>
                </View>
                <Text style={[styles.stageCount, { color: colors.newCards || '#3B82F6', textAlign: rtl ? 'left' : 'right' }]}>
                  {maturity.newCards}
                </Text>
              </View>
              <ProgressBar
                progress={cardCounts.total > 0 ? maturity.newCards / cardCounts.total : 0}
                color={colors.newCards || '#3B82F6'}
              />
            </View>

            {/* 2. Learning */}
            <View style={styles.maturityRow}>
              <View style={[styles.maturityLabelRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.stageDot, { backgroundColor: colors.learningCards || '#F59E0B' }]} />
                  <Text style={[styles.stageName, { color: colors.text }]}>
                    {rtl ? 'قيد التثبيت والتعلم (< 21 يوم)' : 'Learning (< 21 days)'}
                  </Text>
                </View>
                <Text style={[styles.stageCount, { color: colors.learningCards || '#F59E0B', textAlign: rtl ? 'left' : 'right' }]}>
                  {maturity.learning}
                </Text>
              </View>
              <ProgressBar
                progress={cardCounts.total > 0 ? maturity.learning / cardCounts.total : 0}
                color={colors.learningCards || '#F59E0B'}
              />
            </View>

            {/* 3. Mature */}
            <View style={styles.maturityRow}>
              <View style={[styles.maturityLabelRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.stageDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.stageName, { color: colors.text }]}>
                    {rtl ? 'متقنة وناضجة (≥ 21 يوم)' : 'Mature (≥ 21 days)'}
                  </Text>
                </View>
                <Text style={[styles.stageCount, { color: '#10B981', textAlign: rtl ? 'left' : 'right' }]}>
                  {maturity.mature}
                </Text>
              </View>
              <ProgressBar
                progress={cardCounts.total > 0 ? maturity.mature / cardCounts.total : 0}
                color="#10B981"
              />
            </View>

            {/* 4. Leeches (if any) */}
            {maturity.leeches > 0 && (
              <View style={styles.maturityRow}>
                <View style={[styles.maturityLabelRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.stageDot, { backgroundColor: colors.error || '#EF4444' }]} />
                    <Text style={[styles.stageName, { color: colors.error || '#EF4444' }]}>
                      {rtl ? 'بطاقات متعثرة (أخطاء متكررة)' : 'Leeches (Frequent Mistakes)'}
                    </Text>
                  </View>
                  <Text style={[styles.stageCount, { color: colors.error || '#EF4444', textAlign: rtl ? 'left' : 'right' }]}>
                    {maturity.leeches}
                  </Text>
                </View>
                <ProgressBar
                  progress={cardCounts.total > 0 ? maturity.leeches / cardCounts.total : 0}
                  color={colors.error || '#EF4444'}
                />
              </View>
            )}
          </Card>

          {/* ── 5. Streak & Momentum Card ───────────────────────────── */}
          <Card
            style={[
              styles.sectionCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                marginTop: spacing.md,
              },
            ]}
          >
            <View style={[styles.streakBannerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <BrandStatsEmblem variant="streak-crest" size={54} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.streakTitle,
                    {
                      color: colors.text,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {rtl ? `حماسك الحالي: ${stats.streakCurrent} أيام متتالية!` : `Current Streak: ${stats.streakCurrent} Days!`}
                </Text>
                <Text
                  style={[
                    styles.streakSub,
                    {
                      color: colors.textSecondary,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {rtl
                    ? `أفضل رقم قياسي حققته هو ${stats.streakLongest} يوماً. استمر في المذاكرة اليومية للحفاظ على التكرار!`
                    : `Your longest streak is ${stats.streakLongest} days. Keep reviewing daily to maintain interval mastery!`}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  screenTopBar: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
  },

  // Hero Card
  heroCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  heroRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTextSide: {
    flex: 1,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroNumberRow: {
    marginTop: 4,
  },
  heroBigNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 48,
  },
  heroGoalDenominator: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.70)',
    fontWeight: '600',
  },
  heroProgressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    width: '100%',
    marginTop: 10,
    overflow: 'hidden',
  },
  heroProgressBar: {
    height: '100%',
    borderRadius: 4,
  },
  heroGoalStatus: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  heroEmblemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2x2 Grid
  gridRow: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricTile: {
    width: '48%',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  metricTileTop: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTileValue: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  metricTileLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Section Cards
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '800',
  },

  // Weekly Chart
  chartContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 10,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barCountText: {
    fontSize: 10,
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 70,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barDayText: {
    fontSize: 11,
    marginTop: 6,
  },

  // Maturity rows
  maturityRow: {
    marginBottom: 12,
  },
  maturityLabelRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stageDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  stageName: {
    fontSize: 12,
    fontWeight: '600',
  },
  stageCount: {
    fontSize: 13,
    fontWeight: '800',
    minWidth: 32,
  },

  // Streak Banner
  streakBannerRow: {
    alignItems: 'center',
    gap: 14,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  streakSub: {
    fontSize: 12,
    lineHeight: 18,
  },
});
