import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import {
  Card,
  Button,
  ProgressRing,
  StreakFlame,
  XPCounter,
  Badge,
  FAB,
} from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { statsRepository, TodayStatsSummary } from '../../core/db/repositories/statsRepository';

// Accent colour palette for deck cards — derived from deck name's first char code
const DECK_ACCENTS = ['#4F46E5', '#8B5CF6', '#0EA5E9', '#F59E0B', '#EF4444'];

export default function HomeScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [refreshing, setRefreshing] = useState(false);
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [counts, setCounts] = useState({ due: 0, newCards: 0, learn: 0, total: 0 });
  const [todayStats, setTodayStats] = useState<TodayStatsSummary>({
    newDone: 0,
    reviewsDone: 0,
    totalDone: 0,
    dailyGoal: 20,
    timeMs: 0,
    streakCurrent: 1,
    streakLongest: 1,
    xpTotal: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const [allDecks, cardCounts, stats] = await Promise.all([
        deckRepository.getAllWithCounts(),
        cardRepository.getGlobalCounts(),
        statsRepository.getTodaySummary(),
      ]);
      setDecks(allDecks);
      setCounts(cardCounts);
      setTodayStats(stats);
    } catch (e) {
      console.error('Failed to load home data:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Determine greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t('home.greeting_morning')
      : hour < 17
      ? t('home.greeting_afternoon')
      : t('home.greeting_evening');

  const progressRatio = todayStats.dailyGoal > 0
    ? Math.min(1, todayStats.totalDone / todayStats.dailyGoal)
    : 0;

  // Format study time (ms → "Xm")
  const studyMinutes = Math.round(todayStats.timeMs / 60000);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <View
        style={[
          styles.topBar,
          {
            flexDirection: rtl ? 'row-reverse' : 'row',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.sm,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* App wordmark / title */}
        <Text
          style={[
            styles.appTitle,
            {
              color: colors.primary,
              fontSize: typography.sizes.xl,
              fontWeight: typography.weights.extrabold,
              textAlign: rtl ? 'right' : 'left',
            },
          ]}
        >
          FlashCards
        </Text>

        {/* Streak + XP pill — tappable to profile */}
        <Pressable
          onPress={() => router.push('/profile')}
          style={[
            styles.gamificationRow,
            {
              flexDirection: rtl ? 'row-reverse' : 'row',
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 24,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              gap: spacing.sm,
            },
          ]}
          hitSlop={8}
        >
          <StreakFlame streak={todayStats.streakCurrent} />
          <XPCounter xp={todayStats.xpTotal} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Hero Section ─────────────────────────────────────────── */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: colors.primary,
              marginHorizontal: spacing.lg,
              marginTop: spacing.md,
              borderRadius: 24,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.xl,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.22,
              shadowRadius: 12,
              elevation: 5,
            },
          ]}
        >
          <View
            style={[
              styles.heroInner,
              { flexDirection: rtl ? 'row-reverse' : 'row' },
            ]}
          >
            {/* Left: greeting + progress numbers */}
            <View style={styles.heroTextCol}>
              <Text
                style={[
                  styles.heroGreeting,
                  {
                    color: 'rgba(255,255,255,0.80)',
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.medium,
                    textAlign: rtl ? 'right' : 'left',
                  },
                ]}
              >
                {greeting}
              </Text>

              <Text
                style={[
                  styles.heroGoalNumber,
                  {
                    color: '#FFFFFF',
                    fontSize: typography.sizes.xxl,
                    fontWeight: typography.weights.extrabold,
                    textAlign: rtl ? 'right' : 'left',
                    marginTop: 4,
                  },
                ]}
              >
                {todayStats.totalDone}
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: typography.sizes.md,
                    fontWeight: typography.weights.regular,
                  }}
                >
                  {' '}/{todayStats.dailyGoal}
                </Text>
              </Text>

              <Text
                style={[
                  styles.heroGoalLabel,
                  {
                    color: 'rgba(255,255,255,0.70)',
                    fontSize: typography.sizes.xs,
                    textAlign: rtl ? 'right' : 'left',
                    marginTop: 4,
                  },
                ]}
              >
                {t('home.daily_goal')}
              </Text>
            </View>

            {/* Right: big progress ring */}
            <ProgressRing
              progress={progressRatio}
              size={100}
              strokeWidth={9}
              color="#FFFFFF"
              trackColor="rgba(255,255,255,0.22)"
              textColor="#FFFFFF"
              label={`${Math.round(progressRatio * 100)}%`}
            />
          </View>
        </View>

        {/* ── Today's Stats Row ──────────────────────────────────────── */}
        <View
          style={[
            styles.statsRow,
            {
              flexDirection: rtl ? 'row-reverse' : 'row',
              paddingHorizontal: spacing.lg,
              marginTop: spacing.lg,
              gap: spacing.sm,
            },
          ]}
        >
          {/* Reviewed */}
          <View style={[styles.statPill, { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6 }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.dueCards ?? '#10B981'} />
            <Text style={[styles.statPillNum, { color: colors.text, fontSize: typography.sizes.md, fontWeight: typography.weights.bold }]}>
              {todayStats.reviewsDone}
            </Text>
            <Text style={[styles.statPillLabel, { color: colors.textSecondary, fontSize: 10, fontWeight: '600' }]}>
              {rtl ? 'مراجعة' : 'Reviewed'}
            </Text>
          </View>

          {/* New learned */}
          <View style={[styles.statPill, { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6 }]}>
            <Ionicons name="star" size={18} color={colors.newCards ?? '#3B82F6'} />
            <Text style={[styles.statPillNum, { color: colors.text, fontSize: typography.sizes.md, fontWeight: typography.weights.bold }]}>
              {todayStats.newDone}
            </Text>
            <Text style={[styles.statPillLabel, { color: colors.textSecondary, fontSize: 10, fontWeight: '600' }]}>
              {rtl ? 'جديد' : 'New'}
            </Text>
          </View>

          {/* Study time */}
          <View style={[styles.statPill, { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6 }]}>
            <Ionicons name="time" size={18} color={colors.accent ?? '#8B5CF6'} />
            <Text style={[styles.statPillNum, { color: colors.text, fontSize: typography.sizes.md, fontWeight: typography.weights.bold }]}>
              {studyMinutes}m
            </Text>
            <Text style={[styles.statPillLabel, { color: colors.textSecondary, fontSize: 10, fontWeight: '600' }]}>
              {rtl ? 'وقت' : 'Time'}
            </Text>
          </View>

          {/* XP */}
          <View style={[styles.statPill, { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6 }]}>
            <Ionicons name="flash" size={18} color="#F59E0B" />
            <Text style={[styles.statPillNum, { color: colors.text, fontSize: typography.sizes.md, fontWeight: typography.weights.bold }]}>
              {todayStats.xpTotal}
            </Text>
            <Text style={[styles.statPillLabel, { color: colors.textSecondary, fontSize: 10, fontWeight: '600' }]}>
              XP
            </Text>
          </View>
        </View>

        {/* ── Quick Actions ─────────────────────────────────────────── */}
        <View style={[styles.quickActions, { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm }]}>

          {/* Review Due */}
          <Pressable
            onPress={() => router.push('/study/review')}
            disabled={counts.due === 0}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: counts.due > 0 ? colors.primary : colors.surfaceRaised,
                borderWidth: 1.5,
                borderColor: counts.due > 0 ? colors.primary : colors.border,
                opacity: pressed ? 0.88 : 1,
                borderRadius: 16,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: spacing.md,
              },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: counts.due > 0 ? 'rgba(255,255,255,0.22)' : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="refresh-circle"
                size={26}
                color={counts.due > 0 ? '#FFFFFF' : colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: counts.due > 0 ? '#FFFFFF' : colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {t('home.start_review')}
              </Text>
              <Text
                style={{
                  color: counts.due > 0 ? 'rgba(255,255,255,0.80)' : colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  textAlign: rtl ? 'right' : 'left',
                  marginTop: 2,
                }}
              >
                {t('home.review_card_subtitle', { count: counts.due })}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: counts.due > 0 ? 'rgba(255,255,255,0.25)' : colors.surface,
                borderWidth: counts.due > 0 ? 0 : 1,
                borderColor: colors.border,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  color: counts.due > 0 ? '#FFFFFF' : colors.textMuted,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.bold,
                }}
              >
                {counts.due}
              </Text>
            </View>
          </Pressable>

          {/* Learn New */}
          <Pressable
            onPress={() => router.push('/study/learn')}
            disabled={counts.newCards === 0}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1.5,
                borderColor: counts.newCards > 0 ? (colors.newCards ?? '#3B82F6') : colors.border,
                opacity: pressed ? 0.88 : 1,
                borderRadius: 16,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: spacing.md,
              },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: `${colors.newCards ?? '#3B82F6'}18`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="book" size={24} color={colors.newCards ?? '#3B82F6'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: typography.sizes.md, fontWeight: typography.weights.bold, textAlign: rtl ? 'right' : 'left' }}>
                {t('home.start_learning')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, textAlign: rtl ? 'right' : 'left', marginTop: 2 }}>
                {t('home.learn_card_subtitle', { count: counts.newCards })}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: `${colors.newCards ?? '#3B82F6'}18`,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: colors.newCards ?? '#3B82F6', fontSize: typography.sizes.sm, fontWeight: typography.weights.bold }}>
                {counts.newCards}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ── Recent Decks: horizontal scroll ───────────────────────── */}
        <View style={[styles.sectionRow, { paddingHorizontal: spacing.lg, marginTop: spacing.xl, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.md,
              fontWeight: typography.weights.bold,
              flex: 1,
              textAlign: rtl ? 'right' : 'left',
            }}
          >
            {t('home.recent_decks')}
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/decks')}
            hitSlop={8}
          >
            <Text style={{ color: colors.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}>
              {rtl ? 'عرض الكل' : 'See All'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.deckScrollContent,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              gap: spacing.md,
              flexDirection: rtl ? 'row-reverse' : 'row',
            },
          ]}
          style={{ marginTop: spacing.sm }}
        >
          {decks.map((deck) => {
            const accentColor = DECK_ACCENTS[deck.name.charCodeAt(0) % DECK_ACCENTS.length];
            return (
              <Pressable
                key={deck.id}
                onPress={() => router.push(`/decks/${deck.id}`)}
                style={({ pressed }) => [
                  styles.deckCard,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    width: 180,
                    overflow: 'hidden',
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                {/* Coloured left accent strip */}
                <View style={[styles.deckAccentStrip, { backgroundColor: accentColor }]} />

                <View style={{ flex: 1, padding: spacing.md }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: typography.sizes.sm,
                      fontWeight: typography.weights.bold,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                    numberOfLines={2}
                  >
                    {deck.name}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.sizes.xs,
                      textAlign: rtl ? 'right' : 'left',
                      marginTop: 4,
                    }}
                  >
                    {t('decks.cards_badge', { count: deck.card_count })}
                  </Text>

                  {/* Badges row */}
                  <View style={[styles.deckBadgeRow, { marginTop: spacing.sm, flexDirection: rtl ? 'row-reverse' : 'row', gap: 4 }]}>
                    {deck.new_count > 0 && (
                      <Badge count={deck.new_count} variant="new" size="sm" />
                    )}
                    {deck.learn_count > 0 && (
                      <Badge count={deck.learn_count} variant="learn" size="sm" />
                    )}
                    {deck.due_count > 0 && (
                      <Badge count={deck.due_count} variant="due" size="sm" />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}

          {decks.length === 0 && (
            <View
              style={{
                width: 180,
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: spacing.md,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 100,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                {rtl ? 'لا توجد رزم بعد' : 'No decks yet'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Quick Links Row ───────────────────────────────────────── */}
        <View
          style={[
            styles.quickLinksRow,
            {
              flexDirection: rtl ? 'row-reverse' : 'row',
              paddingHorizontal: spacing.lg,
              marginTop: spacing.lg,
              gap: spacing.sm,
            },
          ]}
        >
          {/* Quiz shortcut */}
          <Pressable
            onPress={() => router.push('/(tabs)/quiz')}
            style={({ pressed }) => [
              styles.quickLinkCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                flex: 1,
                padding: spacing.md,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: `${colors.primary}18`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}
            >
              <Ionicons name="sparkles" size={26} color={colors.primary} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.bold,
                textAlign: 'center',
              }}
            >
              {t('home.quick_quiz')}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                textAlign: 'center',
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {t('home.quick_quiz_desc')}
            </Text>
          </Pressable>

          {/* Planner shortcut */}
          <Pressable
            onPress={() => router.push('/planner')}
            style={({ pressed }) => [
              styles.quickLinkCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                flex: 1,
                padding: spacing.md,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: `${colors.primary}18`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}
            >
              <Ionicons name="sparkles" size={26} color={colors.primary} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.bold,
                textAlign: 'center',
              }}
            >
              {t('home.quick_quiz')}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                textAlign: 'center',
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {t('home.quick_quiz_desc')}
            </Text>
          </Pressable>

          {/* Planner shortcut */}
          <Pressable
            onPress={() => router.push('/planner')}
            style={({ pressed }) => [
              styles.quickLinkCard,
              {
                backgroundColor: colors.surface,
                borderRadius: 16,
                flex: 1,
                padding: spacing.md,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: `${colors.accent ?? '#F59E0B'}18`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}
            >
              <Ionicons name="calendar" size={26} color={colors.accent ?? '#F59E0B'} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.bold,
                textAlign: 'center',
              }}
            >
              {t('planner.title')}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                textAlign: 'center',
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {rtl ? 'توقعات المراجعة لـ 14 يوماً' : '14-day forecast & planner'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Floating Action Button: Quick Add Note */}
      <FAB
        onPress={() => router.push('/modal/add-note')}
        style={[
          styles.fabPosition,
          rtl ? { left: spacing.xl } : { right: spacing.xl },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // ── Top Bar ──────────────────────────────────────────────────────────
  topBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appTitle: {},
  gamificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // ── Scroll ───────────────────────────────────────────────────────────
  scrollContent: {},
  // ── Hero ─────────────────────────────────────────────────────────────
  hero: {},
  heroInner: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextCol: {
    flex: 1,
  },
  heroGreeting: {},
  heroGoalNumber: {},
  heroGoalLabel: {},
  // ── Stats row ────────────────────────────────────────────────────────
  statsRow: {
    alignItems: 'stretch',
  },
  statPill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statPillNum: {},
  statPillLabel: {
    textAlign: 'center',
  },
  // ── Quick Actions ─────────────────────────────────────────────────────
  quickActions: {},
  actionBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  // ── Section header ────────────────────────────────────────────────────
  sectionRow: {
    alignItems: 'center',
  },
  // ── Deck horizontal cards ─────────────────────────────────────────────
  deckScrollContent: {
    alignItems: 'stretch',
  },
  deckCard: {
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  deckAccentStrip: {
    width: 6,
  },
  deckBadgeRow: {
    flexWrap: 'wrap',
  },
  // ── Quick Links ───────────────────────────────────────────────────────
  quickLinksRow: {
    alignItems: 'stretch',
  },
  quickLinkCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  // ── FAB ───────────────────────────────────────────────────────────────
  fabPosition: {
    position: 'absolute',
    bottom: 24,
  },
});
