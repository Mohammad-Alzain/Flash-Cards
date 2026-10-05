import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, AppText, Row, ProgressRing, ProgressBar } from '../../../components/ui';
import { Mascot } from '../../../components/illustrations';
import type { TodayStatsSummary } from '../../../core/db/repositories/statsRepository';

interface HomeHeroProps {
  today: TodayStatsSummary;
}

/** Gradient hero: daily goal progress with the mascot reacting to it. */
export const HomeHero: React.FC<HomeHeroProps> = ({ today }) => {
  const { t } = useTranslation();
  const ratio = today.dailyGoal > 0 ? Math.min(1, today.totalDone / today.dailyGoal) : 0;
  const done = ratio >= 1;
  const remaining = Math.max(0, today.dailyGoal - today.totalDone);

  return (
    <Card variant="gradient" padding={20} style={{ marginBottom: 18 }}>
      <Row gap={14}>
        <View style={{ flex: 1 }}>
          <AppText variant="overline" color="rgba(255,255,255,0.8)">
            {t('home.daily_goal')}
          </AppText>
          <Row gap={6} align="flex-end" style={{ marginTop: 4 }}>
            <AppText variant="display" color="#FFFFFF">
              {today.totalDone}
            </AppText>
            <AppText variant="h3" color="rgba(255,255,255,0.7)" style={{ marginBottom: 4 }}>
              / {today.dailyGoal}
            </AppText>
          </Row>
          <AppText variant="bodySm" weight="bold" color="rgba(255,255,255,0.85)" style={{ marginBottom: 12 }}>
            {done ? t('home.goal_done') : t('home.goal_remaining', { count: remaining })}
          </AppText>
          <ProgressBar
            progress={ratio}
            color="#FFFFFF"
            trackColor="rgba(255,255,255,0.22)"
            height={8}
            gradient={false}
          />
        </View>

        <ProgressRing
          progress={ratio}
          size={112}
          strokeWidth={9}
          color="#FFFFFF"
          trackColor="rgba(255,255,255,0.2)"
        >
          <Mascot onColor size={62} expression={done ? 'excited' : today.totalDone > 0 ? 'happy' : 'wink'} pose={done ? 'cheer' : 'idle'} />
        </ProgressRing>
      </Row>
    </Card>
  );
};
