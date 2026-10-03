import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Modal,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, Badge, TextField, ProgressBar } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { forecastService, DayForecast, ExamPaceResult } from '../../core/scheduler/forecast';
import { scheduleRepository } from '../../core/db/repositories/scheduleRepository';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { Schedule } from '../../core/types/models';

export default function PlannerScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [totalNewCards, setTotalNewCards] = useState(0);

  // Exam Planner State
  const [daysUntilExam, setDaysUntilExam] = useState('30');
  const [examPace, setExamPace] = useState<ExamPaceResult | null>(null);

  // Add Reminder Modal
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');

  const loadData = useCallback(async () => {
    try {
      const [fData, sData, dData, cCounts] = await Promise.all([
        forecastService.getDueForecast(14),
        scheduleRepository.getAll(),
        deckRepository.getAllWithCounts(),
        cardRepository.getGlobalCounts(),
      ]);
      setForecast(fData);
      setSchedules(sData);
      setDecks(dData);
      setTotalNewCards(cCounts.newCards);

      const pace = forecastService.calculateExamPace(cCounts.newCards, parseInt(daysUntilExam, 10) || 30);
      setExamPace(pace);
    } catch (e) {
      console.error('Failed to load planner data:', e);
    }
  }, [daysUntilExam]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRecalculatePace = () => {
    const days = parseInt(daysUntilExam, 10) || 30;
    const pace = forecastService.calculateExamPace(totalNewCards, days);
    setExamPace(pace);
  };

  const handleApplyQuota = async () => {
    if (!examPace || decks.length === 0) return;
    try {
      const targetDeck = decks[0];
      await deckRepository.update(targetDeck.id, {
        new_per_day: examPace.recommendedNewPerDay,
      });
      CustomAlert.alert(
        t('common.done'),
        `Applied ${examPace.recommendedNewPerDay} new cards/day to "${targetDeck.name}".`
      );
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const handleAddSchedule = async () => {
    if (!reminderTime.trim()) return;
    try {
      await scheduleRepository.create({
        timeOfDay: reminderTime.trim(),
      });
      setReminderModalVisible(false);
      await loadData();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    await scheduleRepository.toggle(id, enabled);
    await loadData();
  };

  const handleDeleteSchedule = async (id: string) => {
    await scheduleRepository.delete(id);
    await loadData();
  };

  const maxDueInForecast = Math.max(1, ...forecast.map((f) => f.dueCount));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header title={t('planner.title')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* 1. 14-Day Review Forecast */}
        <Card style={[styles.sectionCard, { marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Ionicons name="trending-up-outline" size={20} color={colors.primary} style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }} />
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
            >
              {t('planner.forecast_heading')}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
            {forecast.map((day, i) => {
              const barRatio = day.dueCount / maxDueInForecast;
              const isToday = i === 0;

              return (
                <View key={day.dateStr} style={styles.chartCol}>
                  <Text style={[styles.barCountText, { color: day.dueCount > 0 ? colors.dueCards : colors.textMuted }]}>
                    {day.dueCount}
                  </Text>

                  <View style={[styles.barTrack, { backgroundColor: colors.surface }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(8, barRatio * 100)}%`,
                          backgroundColor: isToday ? colors.primary : colors.dueCards,
                        },
                      ]}
                    />
                  </View>

                  <Text
                    style={[
                      styles.dayLabel,
                      {
                        color: isToday ? colors.primary : colors.textSecondary,
                        fontWeight: isToday ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {isToday ? 'Today' : day.dayLabel}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                    {day.dateStr.slice(5)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </Card>

        {/* 2. Exam & Target Date Planner */}
        <Card style={[styles.sectionCard, { marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }} />
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
            >
              {t('planner.exam_planner_heading')}
            </Text>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: spacing.md, textAlign: rtl ? 'right' : 'left' }}>
            Calculate the exact daily study quota needed to finish all new cards before your exam date.
          </Text>

          <View style={[styles.inputRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}>
              <TextField
                label={t('planner.days_until_exam')}
                value={daysUntilExam}
                onChangeText={(val) => {
                  setDaysUntilExam(val);
                }}
                placeholder="e.g. 30"
                style={{ marginBottom: 0 }}
              />
            </View>
            <Button
              title="Recalculate"
              variant="secondary"
              size="md"
              onPress={handleRecalculatePace}
              style={{ marginTop: 22 }}
            />
          </View>

          {examPace && (
            <View style={[styles.paceBox, { backgroundColor: colors.surface, marginTop: spacing.md }]}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: 'bold' }}>
                {t('planner.recommended_new', { count: examPace.recommendedNewPerDay })}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {t('planner.est_reviews', { count: examPace.estimatedReviewLoadPerDay })}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                Estimated deck completion: {examPace.finishDateStr}
              </Text>

              <Button
                title={t('planner.apply_to_deck')}
                variant="primary"
                size="sm"
                onPress={handleApplyQuota}
                style={{ marginTop: 12 }}
              />
            </View>
          )}
        </Card>

        {/* 3. Daily Reminders & Schedules */}
        <Card style={[styles.sectionCard, { marginBottom: spacing.xl }]}>
          <View style={[styles.remindersHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
            >
              ⏰ {t('planner.reminders_heading')}
            </Text>

            <Button
              title={`+ ${t('planner.add_reminder')}`}
              variant="secondary"
              size="sm"
              onPress={() => setReminderModalVisible(true)}
            />
          </View>

          {schedules.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8, textAlign: rtl ? 'right' : 'left' }}>
              {t('planner.no_reminders')}
            </Text>
          ) : (
            schedules.map((sch) => (
              <View
                key={sch.id}
                style={[
                  styles.scheduleItem,
                  {
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                    {sch.time_of_day}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Daily Due Cards Reminder
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Switch
                    value={sch.enabled === 1}
                    onValueChange={(val) => handleToggleSchedule(sch.id, val)}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    style={{ marginRight: 12 }}
                  />

                  <Button
                    title=""
                    icon={<Ionicons name="trash-outline" size={16} color="#FFFFFF" />}
                    variant="danger"
                    size="sm"
                    onPress={() => handleDeleteSchedule(sch.id)}
                  />
                </View>
              </View>
            ))
          )}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Reminder Modal */}
      <Modal
        visible={reminderModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              {t('planner.add_reminder')}
            </Text>

            <TextField
              label={t('planner.reminder_time')}
              value={reminderTime}
              onChangeText={setReminderTime}
              placeholder="HH:MM (24-hour format e.g. 08:30)"
            />

            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 16 }}>
              <Button
                title={t('common.cancel')}
                variant="ghost"
                size="md"
                onPress={() => setReminderModalVisible(false)}
                style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
              />
              <Button
                title={t('common.save')}
                variant="primary"
                size="md"
                onPress={handleAddSchedule}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  sectionCard: {},
  sectionTitle: {},
  chartScroll: {
    paddingVertical: 12,
  },
  chartCol: {
    alignItems: 'center',
    width: 52,
    marginRight: 6,
  },
  barCountText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
  },
  dayLabel: {
    fontSize: 11,
    marginTop: 6,
  },
  inputRow: {
    alignItems: 'center',
  },
  paceBox: {
    padding: 16,
    borderRadius: 12,
  },
  remindersHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scheduleItem: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    padding: 24,
  },
});
