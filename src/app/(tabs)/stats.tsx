import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Screen,
  Header,
  Card,
  Row,
  AppText,
  Badge,
  StatTile,
  SectionHeader,
  ProgressBar,
} from '../../components/ui';
import { Illustration } from '../../components/illustrations';
import { BrandStatsEmblem } from '../../components/brand/BrandStatsEmblem';
import {
  statsRepository,
  TodayStatsSummary,
  DayActivityItem,
  CardMaturityBreakdown,
} from '../../core/db/repositories/statsRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { useFocusData } from '../../hooks/useFocusData';
import { EMPTY_TODAY } from '../../features/home/useHomeData';
import { WeeklyBarChart } from '../../features/stats/components/WeeklyBarChart';
import { MaturityBreakdown } from '../../features/stats/components/MaturityBreakdown';

interface StatsData {
  today: TodayStatsSummary;
  totalCards: number;
  weekly: DayActivityItem[];
  retention: number;
  maturity: CardMaturityBreakdown;
}

const INITIAL: StatsData = {
  today: EMPTY_TODAY,
  totalCards: 0,
  weekly: [],
  retention: 90,
  maturity: { newCards: 0, learning: 0, mature: 0, leeches: 0, total: 0 },
};

export default function StatsScreen() {
  const { t } = useTranslation();
  const { data, refreshing, refresh } = useFocusData<StatsData>(
    async () => {
      const [today, counts, weekly, retention, maturity] = await Promise.all([
        statsRepository.getTodaySummary(),
        cardRepository.getGlobalCounts(),
        statsRepository.getWeeklyActivity(),
        statsRepository.getRetentionRate(),
        statsRepository.getCardMaturity(),
      ]);
      return { today, totalCards: counts.total, weekly, retention, maturity };
    },
    INITIAL,
    'stats'
  );
  const { today, weekly, retention, maturity, totalCards } = data;
  const ratio = today.dailyGoal > 0 ? Math.min(1, today.totalDone / today.dailyGoal) : 0;
  const weekTotal = weekly.reduce((sum, d) => sum + d.count, 0);

  return (
    <Screen
      decor
      tabBarSpace
      refreshing={refreshing}
      onRefresh={refresh}
      header={
        <Header
          large
          title={t('stats.title')}
          subtitle={t('stats.subtitle')}
          icon="bar-chart"
          iconTone="sky"
          rightElement={<Badge variant="primary" icon="today" label={t('stats.today_badge', { count: today.totalDone })} />}
        />
      }
    >
      {/* Hero */}
      <Card variant="gradient" padding={20} style={{ marginBottom: 16 }}>
        <Row gap={12}>
          <View style={{ flex: 1 }}>
            <AppText variant="overline" color="rgba(255,255,255,0.8)">
              {t('stats.today_progress')}
            </AppText>
            <Row gap={6} align="flex-end" style={{ marginTop: 2 }}>
              <AppText variant="display" color="#FFFFFF">
                {today.totalDone}
              </AppText>
              <AppText variant="bodyStrong" color="rgba(255,255,255,0.75)" style={{ marginBottom: 6 }}>
                / {today.dailyGoal} {t('stats.cards_unit')}
              </AppText>
            </Row>
            <ProgressBar progress={ratio} color="#FFFFFF" trackColor="rgba(255,255,255,0.22)" height={8} gradient={false} style={{ marginTop: 8 }} />
            <AppText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 8 }}>
              {ratio >= 1 ? t('stats.goal_done') : t('stats.goal_remaining', { count: Math.max(0, today.dailyGoal - today.totalDone) })}
            </AppText>
          </View>
          <Illustration name="stats" size={130} backdrop={false} onColor />
        </Row>
      </Card>

      {/* Metric grid */}
      <Row gap={12} align="stretch" style={{ marginBottom: 12 }}>
        <StatTile icon="repeat" tone="green" value={today.reviewsDone} label={t('stats.today_reviewed')} />
        <StatTile icon="time" tone="sky" value={t('stats.minutes_value', { count: Math.round(today.timeMs / 60000) })} label={t('stats.total_time')} />
      </Row>
      <Row gap={12} align="stretch" style={{ marginBottom: 22 }}>
        <StatTile icon="shield-checkmark" tone="indigo" value={`${retention}%`} label={t('stats.retention_rate')} />
        <StatTile icon="trophy" tone="amber" value={today.streakLongest} label={t('stats.streak_record')} />
      </Row>

      {/* Weekly activity */}
      <SectionHeader
        title={t('stats.weekly_title')}
        icon="pulse"
        tone="violet"
        trailing={<Badge size="sm" variant="neutral" label={t('stats.weekly_total', { count: weekTotal })} />}
      />
      <Card style={{ marginBottom: 22 }}>
        <WeeklyBarChart days={weekly} />
      </Card>

      {/* Maturity */}
      <SectionHeader
        title={t('stats.maturity_title')}
        icon="leaf"
        tone="green"
        trailing={<Badge size="sm" variant="neutral" label={t('stats.maturity_total', { count: totalCards })} />}
      />
      <Card style={{ marginBottom: 22 }}>
        <MaturityBreakdown maturity={maturity} total={totalCards} />
      </Card>

      {/* Streak */}
      <Card variant="tinted" tone="orange">
        <Row gap={14}>
          <BrandStatsEmblem variant="streak-crest" size={58} />
          <View style={{ flex: 1 }}>
            <AppText variant="title" weight="extrabold">
              {t('stats.streak_title', { count: today.streakCurrent })}
            </AppText>
            <AppText variant="bodySm" color="textSecondary" style={{ marginTop: 2 }}>
              {t('stats.streak_desc', { best: today.streakLongest })}
            </AppText>
          </View>
        </Row>
      </Card>
    </Screen>
  );
}
