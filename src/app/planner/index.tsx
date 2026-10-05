import React, { useState } from 'react';
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection, alpha } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import {
  Screen,
  Header,
  Card,
  Row,
  AppText,
  Button,
  IconButton,
  TextField,
  SectionHeader,
  Badge,
  StatTile,
  GradientFill,
  IconTile,
  EmptyState,
} from '../../components/ui';
import { forecastService, DayForecast, ExamPaceResult } from '../../core/scheduler/forecast';
import { reminderService } from '../../core/reminders/reminderService';
import { ReminderSheet, ReminderCard, alertReminderError } from '../../features/reminders/ReminderParts';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { Schedule } from '../../core/types/models';
import { useFocusData } from '../../hooks/useFocusData';

const FORECAST_DAYS = 14;
const DEFAULT_EXAM_DAYS = 30;
const BAR_HEIGHT = 110;

interface PlannerData {
  forecast: DayForecast[];
  schedules: Schedule[];
  decks: DeckWithCounts[];
  totalNew: number;
}

export default function PlannerScreen() {
  const { colors, heroGradient, tone } = useTheme();
  const dir = useDirection();
  const { t } = useTranslation();
  const router = useRouter();
  const [examDays, setExamDays] = useState(String(DEFAULT_EXAM_DAYS));
  const [pace, setPace] = useState<ExamPaceResult | null>(null);
  const [reminderVisible, setReminderVisible] = useState(false);

  const { data, reload } = useFocusData<PlannerData>(
    async () => {
      const [forecast, schedules, decks, counts] = await Promise.all([
        forecastService.getDueForecast(FORECAST_DAYS),
        reminderService.list(),
        deckRepository.getAllWithCounts(),
        cardRepository.getGlobalCounts(),
      ]);
      setPace(forecastService.calculateExamPace(counts.newCards, parseInt(examDays, 10) || DEFAULT_EXAM_DAYS));
      return { forecast, schedules, decks, totalNew: counts.newCards };
    },
    { forecast: [], schedules: [], decks: [], totalNew: 0 },
    'planner'
  );

  const recalc = () => setPace(forecastService.calculateExamPace(data.totalNew, parseInt(examDays, 10) || DEFAULT_EXAM_DAYS));

  // Applies the quota to the first deck (existing behaviour).
  const applyQuota = async () => {
    if (!pace || data.decks.length === 0) return;
    try {
      const target = data.decks[0];
      await deckRepository.update(target.id, { new_per_day: pace.recommendedNewPerDay });
      CustomAlert.alert(t('common.done'), t('planner.applied_msg', { count: pace.recommendedNewPerDay, name: target.name }));
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const addReminder = async (params: { timeOfDay: string; daysMask: number; addToCalendar: boolean }) => {
    try {
      await reminderService.create(params);
      setReminderVisible(false);
      CustomAlert.alert(t('reminders.saved_title'), t('reminders.saved_msg', { time: params.timeOfDay }));
    } catch (e) {
      setReminderVisible(false);
      alertReminderError(e);
    } finally {
      await reload();
    }
  };

  const run = async (task: () => Promise<unknown>) => {
    try {
      await task();
    } catch (e) {
      alertReminderError(e);
    } finally {
      await reload();
    }
  };

  const maxDue = Math.max(1, ...data.forecast.map((f) => f.dueCount));
  const totalDue = data.forecast.reduce((s, f) => s + f.dueCount, 0);

  return (
    <Screen
      decor
      header={<Header title={t('planner.title')} subtitle={t('planner.subtitle')} icon="calendar" iconTone="amber" onBack={() => router.back()} />}
      overlay={
        <ReminderSheet visible={reminderVisible} onClose={() => setReminderVisible(false)} onSave={addReminder} />
      }
    >
      {/* Forecast */}
      <SectionHeader
        title={t('planner.forecast_heading')}
        icon="trending-up"
        tone="green"
        trailing={<Badge size="sm" variant="due" label={t('planner.total_due', { count: totalDue })} />}
      />
      <Card style={{ marginBottom: 22 }}>
        <FlatList
          horizontal
          inverted={dir.rtl}
          data={data.forecast}
          keyExtractor={(d) => d.dateStr}
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          renderItem={({ item, index }) => {
            const today = index === 0;
            const h = Math.max(8, (item.dueCount / maxDue) * BAR_HEIGHT);
            return (
              <View style={{ alignItems: 'center', width: 36 }}>
                <AppText variant="caption" weight="black" color={item.dueCount > 0 ? (today ? 'primary' : 'dueCards') : 'textMuted'}>
                  {item.dueCount}
                </AppText>
                <View style={{ height: BAR_HEIGHT, width: 22, borderRadius: 11, backgroundColor: colors.surface, justifyContent: 'flex-end', overflow: 'hidden', marginVertical: 4 }}>
                  <View style={{ height: h, borderRadius: 11, overflow: 'hidden', backgroundColor: alpha(colors.dueCards, 0.8) }}>
                    {today && <GradientFill colors={heroGradient} direction="vertical" radius={11} />}
                  </View>
                </View>
                <AppText variant="caption" size={11} weight={today ? 'black' : 'semibold'} color={today ? 'primary' : 'textSecondary'}>
                  {today ? t('planner.today') : item.dayLabel}
                </AppText>
                <AppText variant="caption" size={9.5} color="textMuted">
                  {item.dateStr.slice(5)}
                </AppText>
              </View>
            );
          }}
        />
      </Card>

      {/* Exam pace */}
      <SectionHeader title={t('planner.exam_planner_heading')} icon="school" tone="violet" />
      <Card style={{ marginBottom: 22 }}>
        <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 12 }}>
          {t('planner.exam_desc')}
        </AppText>
        <Row gap={10} align="flex-end">
          <TextField
            label={t('planner.days_until_exam')}
            value={examDays}
            onChangeText={setExamDays}
            keyboardType="number-pad"
            icon="hourglass"
            style={{ flex: 1, width: undefined, marginBottom: 0 }}
          />
          <Button title={t('planner.recalculate')} icon="calculator" variant="soft" onPress={recalc} />
        </Row>
        {pace && (
          <>
            <Row gap={8} align="stretch" style={{ marginTop: 14 }}>
              <StatTile layout="compact" icon="sparkles" tone="blue" value={pace.recommendedNewPerDay} label={t('planner.new_per_day_label')} />
              <StatTile layout="compact" icon="repeat" tone="green" value={pace.estimatedReviewLoadPerDay} label={t('planner.reviews_per_day_label')} />
            </Row>
            <Row gap={8} style={{ marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: tone('violet').bg }}>
              <IconTile icon="flag" tone="violet" size={30} />
              <AppText variant="bodySm" weight="bold" style={{ flex: 1 }}>
                {t('planner.finish_date', { date: pace.finishDateStr })}
              </AppText>
            </Row>
            <Button title={t('planner.apply_to_deck')} icon="checkmark-done" onPress={applyQuota} fullWidth style={{ marginTop: 12 }} />
          </>
        )}
      </Card>

      {/* Reminders */}
      <SectionHeader
        title={t('planner.reminders_heading')}
        icon="alarm"
        tone="amber"
        trailing={<IconButton icon="add" variant="primary" size={36} onPress={() => setReminderVisible(true)} accessibilityLabel={t('planner.add_reminder')} />}
      />
      {data.schedules.length === 0 ? (
        <Card variant="flat">
          <EmptyState compact illustration="sleep" title={t('planner.add_reminder')} description={t('planner.no_reminders')} />
        </Card>
      ) : (
        data.schedules.map((s) => (
          <ReminderCard
            key={s.id}
            schedule={s}
            onToggle={(v) => run(() => reminderService.setEnabled(s.id, v))}
            onToggleCalendar={() =>
              run(async () => {
                const linked = await reminderService.toggleCalendar(s.id);
                CustomAlert.alert(t('common.done'), linked ? t('reminders.calendar_added') : t('reminders.calendar_removed'));
              })
            }
            onDelete={() => run(() => reminderService.remove(s.id))}
          />
        ))
      )}
    </Screen>
  );
}
