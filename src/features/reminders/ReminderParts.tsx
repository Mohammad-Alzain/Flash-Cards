import React, { useEffect, useState } from 'react';
import { View, Linking, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useTheme, alpha } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import { BottomSheet, Button, Row, AppText, NumberStepper, Chip, PressableScale, Card, IconTile, IconButton, ListItem } from '../../components/ui';
import { ReminderError } from '../../core/reminders/reminderService';
import {
  ALL_DAYS_MASK,
  WEEKDAYS,
  formatTimeOfDay,
  isDaySelected,
  isEveryDay,
  parseTimeOfDay,
  selectedDays,
  splitIds,
  toggleDay,
} from '../../core/reminders/reminderTime';
import { Schedule } from '../../core/types/models';

const TIME_PRESETS = ['07:00', '08:00', '12:30', '18:00', '21:00'];
/** Monday–Friday. */
const WEEKDAY_MASK = 0b0111110;
const MINUTE_STEP = 5;

/** Shows a translated alert for a reminder failure (with a settings shortcut for permissions). */
export const alertReminderError = (e: unknown) => {
  const code = e instanceof ReminderError ? e.code : null;
  const msg = code ? i18n.t(`reminders.err_${code}`) : (e as Error)?.message || i18n.t('common.error');
  const permission = code === 'NOTIFICATIONS_PERMISSION_DENIED' || code === 'CALENDAR_PERMISSION_DENIED';
  CustomAlert.alert(
    i18n.t('common.error'),
    msg,
    permission
      ? [
          { text: i18n.t('common.close'), style: 'cancel' },
          { text: i18n.t('reminders.open_settings'), onPress: () => Linking.openSettings().catch(() => {}) },
        ]
      : undefined
  );
};

/** Short localized day names in the order the week is shown. */
const useDayLabels = () => {
  const { t } = useTranslation();
  return WEEKDAYS.map((d) => ({ day: d, label: t(`reminders.day_${d}`) }));
};

export const describeDays = (mask: number, t: (k: string) => string) =>
  isEveryDay(mask)
    ? t('reminders.every_day')
    : mask === WEEKDAY_MASK
    ? t('reminders.weekdays_only')
    : selectedDays(mask)
        .map((d) => t(`reminders.day_${d}`))
        .join('، ');

interface ReminderSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (params: { timeOfDay: string; daysMask: number; addToCalendar: boolean }) => Promise<void>;
}

/** Create-reminder sheet: time, repeat days and calendar linking. */
export const ReminderSheet: React.FC<ReminderSheetProps> = ({ visible, onClose, onSave }) => {
  const { colors, shape } = useTheme();
  const { t } = useTranslation();
  const days = useDayLabels();
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [mask, setMask] = useState(ALL_DAYS_MASK);
  const [calendar, setCalendar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSaving(false);
  }, [visible]);

  const time = formatTimeOfDay(hour, minute);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ timeOfDay: time, daysMask: mask, addToCalendar: calendar });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('planner.add_reminder')}
      icon="alarm"
      tone="amber"
      scrollable
      footer={
        <Row gap={10}>
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button title={t('common.save')} icon="checkmark" loading={saving} disabled={mask === 0} onPress={save} style={{ flex: 1 }} />
        </Row>
      }
    >
      {/* Big clock + steppers */}
      <View style={{ alignItems: 'center', paddingVertical: 14, borderRadius: shape.card, backgroundColor: alpha(colors.primary, 0.07), marginBottom: 14 }}>
        <AppText size={44} weight="black" color="primary" align="center" style={{ letterSpacing: 2, writingDirection: 'ltr' }}>
          {time}
        </AppText>
        <Row gap={18} style={{ marginTop: 10 }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <AppText variant="caption" weight="bold" color="textMuted">
              {t('reminders.hour')}
            </AppText>
            <NumberStepper value={hour} onChange={setHour} min={0} max={23} wrap pad={2} width={52} />
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <AppText variant="caption" weight="bold" color="textMuted">
              {t('reminders.minute')}
            </AppText>
            <NumberStepper value={minute} onChange={setMinute} min={0} max={59} step={MINUTE_STEP} wrap pad={2} width={52} />
          </View>
        </Row>
      </View>
      <Row wrap gap={8} justify="center" style={{ marginBottom: 18 }}>
        {TIME_PRESETS.map((p) => {
          const parsed = parseTimeOfDay(p)!;
          return (
            <Chip
              key={p}
              label={p}
              icon="time"
              selected={parsed.hour === hour && parsed.minute === minute}
              onPress={() => {
                setHour(parsed.hour);
                setMinute(parsed.minute);
              }}
            />
          );
        })}
      </Row>

      {/* Days */}
      <Row justify="space-between" style={{ marginBottom: 8 }}>
        <AppText variant="bodySm" weight="extrabold">
          {t('reminders.days')}
        </AppText>
        <Row gap={6}>
          <Chip label={t('reminders.every_day')} selected={mask === ALL_DAYS_MASK} onPress={() => setMask(ALL_DAYS_MASK)} />
          <Chip label={t('reminders.weekdays_only')} selected={mask === WEEKDAY_MASK} onPress={() => setMask(WEEKDAY_MASK)} />
        </Row>
      </Row>
      <Row justify="space-between" style={{ marginBottom: 16 }}>
        {days.map(({ day, label }) => {
          const on = isDaySelected(mask, day);
          return (
            <PressableScale
              key={day}
              onPress={() => setMask(toggleDay(mask, day))}
              haptic
              activeScale={0.9}
              accessibilityState={{ selected: on }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.border,
              }}
            >
              <AppText variant="caption" size={10.5} weight="extrabold" color={on ? '#FFFFFF' : 'textSecondary'} align="center" numberOfLines={1}>
                {label}
              </AppText>
            </PressableScale>
          );
        })}
      </Row>

      <Card variant="flat" padding={0}>
        <ListItem
          icon="calendar"
          tone="sky"
          title={t('reminders.add_to_calendar')}
          subtitle={t('reminders.add_to_calendar_desc')}
          switchValue={calendar}
          onSwitchChange={setCalendar}
        />
      </Card>
    </BottomSheet>
  );
};

interface ReminderCardProps {
  schedule: Schedule;
  onToggle: (enabled: boolean) => void;
  onToggleCalendar: () => void;
  onDelete: () => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({ schedule: s, onToggle, onToggleCalendar, onDelete }) => {
  const { colors, tone } = useTheme();
  const { t } = useTranslation();
  const enabled = s.enabled === 1;
  const inCalendar = splitIds(s.calendar_event_ids).length > 0;
  return (
    <Card style={{ marginBottom: 10, opacity: enabled ? 1 : 0.75 }}>
      <Row gap={12}>
        <IconTile icon="alarm" tone={enabled ? 'amber' : 'slate'} size={46} variant={enabled ? 'solid' : 'soft'} />
        <View style={{ flex: 1 }}>
          <AppText variant="h2" weight="black" style={{ writingDirection: 'ltr' }}>
            {s.time_of_day}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {describeDays(s.days_of_week_mask, t)}
          </AppText>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ true: alpha(colors.primary, 0.55), false: colors.border }}
          thumbColor={enabled ? colors.primary : '#FFFFFF'}
        />
      </Row>
      <Row gap={8} style={{ marginTop: 12 }}>
        <Button
          title={inCalendar ? t('reminders.in_calendar') : t('reminders.link_calendar')}
          icon={inCalendar ? 'checkmark-circle' : 'calendar'}
          variant={inCalendar ? 'soft' : 'ghost'}
          size="sm"
          onPress={onToggleCalendar}
          style={{ flex: 1 }}
        />
        {inCalendar && <Ionicons name="sync" size={16} color={tone('sky').fg} />}
        <IconButton icon="trash" variant="danger" size={38} onPress={onDelete} accessibilityLabel={t('common.delete')} />
      </Row>
    </Card>
  );
};
