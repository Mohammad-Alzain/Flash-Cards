import React, { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '../../theme';
import { BottomSheet, Button, Row, AppText, ChoiceChips, ListItem, NumberStepper, SegmentedControl } from '../ui';
import { BulkRescheduleMode, BulkRescheduleOptions, BulkRescheduleResult, browserRepository } from '../../core/db/repositories/browserRepository';

interface BulkRescheduleModalProps {
  visible: boolean;
  selectedCardIds: string[];
  deckName?: string;
  onClose: () => void;
  onSuccess: (result: BulkRescheduleResult) => void;
}

const SHIFT_PRESETS = [1, 3, 7, 14, -1, -3];
const SPREAD_PRESETS = [3, 5, 7, 14, 30];
const TARGET_PRESETS = [0, 1, 2, 3, 7];
const MULTIPLIERS: { val: number; key: string }[] = [
  { val: 0.5, key: 'm_05' },
  { val: 0.8, key: 'm_08' },
  { val: 1.2, key: 'm_12' },
  { val: 1.5, key: 'm_15' },
  { val: 2.0, key: 'm_20' },
];

/** Shift / distribute / pin / scale the due dates of many cards at once. */
export function BulkRescheduleModal({ visible, selectedCardIds, deckName, onClose, onSuccess }: BulkRescheduleModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<BulkRescheduleMode>('shift');
  const [shiftDays, setShiftDays] = useState(3);
  const [updateIntervals, setUpdateIntervals] = useState(true);
  const [targetDays, setTargetDays] = useState(1);
  const [spreadDays, setSpreadDays] = useState(7);
  const [startTomorrow, setStartTomorrow] = useState(true);
  const [multiplier, setMultiplier] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const count = selectedCardIds.length;

  const apply = async () => {
    if (count === 0 || loading) return;
    try {
      setLoading(true);
      const options: BulkRescheduleOptions = {
        mode,
        shiftDays: mode === 'shift' ? shiftDays : undefined,
        updateIntervalsWithShift: mode === 'shift' ? updateIntervals : undefined,
        targetDaysFromNow: mode === 'specific_date' ? targetDays : undefined,
        spreadOverDays: mode === 'distribute' ? spreadDays : undefined,
        startFromDays: mode === 'distribute' ? (startTomorrow ? 1 : 0) : undefined,
        multiplier: mode === 'multiplier' ? multiplier : undefined,
      };
      onSuccess(await browserRepository.bulkRescheduleCards(selectedCardIds, options));
      onClose();
    } catch (e) {
      console.error('Failed to bulk reschedule cards:', e);
    } finally {
      setLoading(false);
    }
  };

  const targetLabel = (d: number) =>
    d === 0 ? t('reschedule.today') : d === 1 ? t('reschedule.tomorrow') : d === 7 ? t('reschedule.in_week') : t('reschedule.in_days', { count: d });

  const help = (key: string) => (
    <Row gap={8} align="flex-start" style={{ padding: 12, borderRadius: 14, backgroundColor: alpha(colors.primary, 0.07), marginBottom: 14 }}>
      <Ionicons name="information-circle" size={18} color={colors.primary} />
      <AppText variant="bodySm" color="textSecondary" style={{ flex: 1 }}>
        {t(key)}
      </AppText>
    </Row>
  );

  const custom = (labelKey: string, value: number, onChange: (v: number) => void, min?: number) => (
    <Row justify="space-between" style={{ marginBottom: 12 }}>
      <AppText variant="bodySm" weight="bold" style={{ flex: 1 }}>
        {t(labelKey)}
      </AppText>
      <NumberStepper value={value} onChange={onChange} min={min} />
    </Row>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('reschedule.title')}
      subtitle={deckName ? t('reschedule.subtitle_deck', { count, deck: deckName }) : t('reschedule.subtitle', { count })}
      icon="calendar"
      tone="amber"
      scrollable
      footer={
        <Row gap={10}>
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button title={t('reschedule.apply', { count })} icon="checkmark-done" loading={loading} disabled={count === 0} onPress={apply} style={{ flex: 1.4 }} />
        </Row>
      }
    >
      <SegmentedControl<BulkRescheduleMode>
        value={mode}
        onChange={setMode}
        style={{ marginBottom: 14 }}
        options={[
          { value: 'shift', label: t('reschedule.mode_shift'), icon: 'time' },
          { value: 'distribute', label: t('reschedule.mode_distribute'), icon: 'git-merge' },
          { value: 'specific_date', label: t('reschedule.mode_specific'), icon: 'calendar' },
          { value: 'multiplier', label: t('reschedule.mode_multiplier'), icon: 'trending-up' },
        ]}
      />

      {mode === 'shift' && (
        <View>
          {help('reschedule.shift_help')}
          <ChoiceChips
            label={t('reschedule.presets')}
            options={SHIFT_PRESETS.map((d) => ({ value: d, label: d > 0 ? t('reschedule.plus_days', { count: d }) : t('reschedule.minus_days', { count: -d }) }))}
            value={shiftDays}
            onChange={setShiftDays}
          />
          {custom('reschedule.custom_shift', shiftDays, setShiftDays)}
          <ListItem icon="resize" tone="violet" title={t('reschedule.update_intervals')} switchValue={updateIntervals} onSwitchChange={setUpdateIntervals} style={{ paddingHorizontal: 0 }} />
        </View>
      )}

      {mode === 'distribute' && (
        <View>
          {help('reschedule.distribute_help')}
          <ChoiceChips
            label={t('reschedule.presets')}
            options={SPREAD_PRESETS.map((d) => ({ value: d, label: t('reschedule.over_days', { count: d }) }))}
            value={spreadDays}
            onChange={setSpreadDays}
          />
          {custom('reschedule.custom_spread', spreadDays, setSpreadDays, 1)}
          <ChoiceChips
            options={[
              { value: 1, label: t('reschedule.start_tomorrow'), icon: 'sunny' },
              { value: 0, label: t('reschedule.start_today'), icon: 'today' },
            ]}
            value={startTomorrow ? 1 : 0}
            onChange={(v) => setStartTomorrow(v === 1)}
          />
          <AppText variant="bodySm" weight="bold" color="primary">
            📊 {t('reschedule.estimate', { perDay: Math.ceil(count / Math.max(1, spreadDays)), days: spreadDays })}
          </AppText>
        </View>
      )}

      {mode === 'specific_date' && (
        <View>
          {help('reschedule.specific_help')}
          <ChoiceChips label={t('reschedule.presets')} options={TARGET_PRESETS.map((d) => ({ value: d, label: targetLabel(d) }))} value={targetDays} onChange={setTargetDays} />
          {custom('reschedule.custom_target', targetDays, setTargetDays, 0)}
        </View>
      )}

      {mode === 'multiplier' && (
        <View>
          {help('reschedule.multiplier_help')}
          <ChoiceChips label={t('reschedule.presets')} options={MULTIPLIERS.map((m) => ({ value: m.val, label: t(`reschedule.${m.key}`) }))} value={multiplier} onChange={setMultiplier} />
        </View>
      )}
    </BottomSheet>
  );
}
