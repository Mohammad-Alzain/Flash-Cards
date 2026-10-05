import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import {
  BulkRescheduleMode,
  BulkRescheduleOptions,
  BulkRescheduleResult,
  browserRepository,
} from '../../core/db/repositories/browserRepository';

interface BulkRescheduleModalProps {
  visible: boolean;
  selectedCardIds: string[];
  deckName?: string;
  onClose: () => void;
  onSuccess: (result: BulkRescheduleResult) => void;
}

export function BulkRescheduleModal({
  visible,
  selectedCardIds,
  deckName,
  onClose,
  onSuccess,
}: BulkRescheduleModalProps) {
  const { colors, typography, spacing } = useTheme();
  const rtl = isRTL();

  const [mode, setMode] = useState<BulkRescheduleMode>('shift');
  const [shiftDays, setShiftDays] = useState<number>(3);
  const [updateIntervals, setUpdateIntervals] = useState<boolean>(true);
  const [targetDays, setTargetDays] = useState<number>(1); // Tomorrow
  const [spreadDays, setSpreadDays] = useState<number>(7); // 1 week
  const [startTomorrow, setStartTomorrow] = useState<boolean>(true);
  const [multiplier, setMultiplier] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(false);

  const cardCount = selectedCardIds.length;

  const handleApply = async () => {
    if (cardCount === 0 || loading) return;
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

      const result = await browserRepository.bulkRescheduleCards(selectedCardIds, options);
      onSuccess(result);
      onClose();
    } catch (e) {
      console.error('Failed to bulk reschedule cards:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderModeTabs = () => {
    const tabs: { key: BulkRescheduleMode; label: string; icon: any }[] = [
      {
        key: 'shift',
        label: rtl ? 'إزاحة (تأخير/تقديم)' : 'Shift (Delay/Advance)',
        icon: 'time-outline',
      },
      {
        key: 'distribute',
        label: rtl ? 'توزيع ذكي' : 'Distribute (Spread)',
        icon: 'git-merge-outline',
      },
      {
        key: 'specific_date',
        label: rtl ? 'موعد محدد' : 'Specific Due',
        icon: 'calendar-outline',
      },
      {
        key: 'multiplier',
        label: rtl ? 'مضاعف الفترات' : 'Interval Multiplier',
        icon: 'trending-up-outline',
      },
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
      >
        {tabs.map((tab) => {
          const active = mode === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setMode(tab.key)}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: active ? colors.primary : colors.surfaceRaised,
                  borderColor: active ? colors.primary : colors.border,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  gap: 8,
                },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={active ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: active ? '#FFFFFF' : colors.text,
                    fontWeight: active ? '700' : '600',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderShiftControls = () => {
    const presets = [
      { label: rtl ? '+1 يوم' : '+1 day', val: 1 },
      { label: rtl ? '+3 أيام' : '+3 days', val: 3 },
      { label: rtl ? '+7 أيام' : '+7 days', val: 7 },
      { label: rtl ? '+14 يوم' : '+14 days', val: 14 },
      { label: rtl ? '-1 يوم (تقديم)' : '-1 day', val: -1 },
      { label: rtl ? '-3 أيام' : '-3 days', val: -3 },
    ];

    return (
      <View style={styles.sectionBody}>
        <Text style={[styles.helpText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl
            ? 'قم بتأخير مواعيد المراجعة (مثالي للإجازات والرحلات) أو تقديمها للمراجعة المبكرة قبل الامتحانات.'
            : 'Postpone reviews (ideal for holidays/trips) or advance them ahead of exams.'}
        </Text>

        <Text style={[styles.inputLabel, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'خيارات سريعة:' : 'Quick Presets:'}
        </Text>
        <View style={[styles.chipsWrap, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p.val}
              onPress={() => setShiftDays(p.val)}
              style={[
                styles.chip,
                {
                  backgroundColor: shiftDays === p.val ? colors.primary : colors.surface,
                  borderColor: shiftDays === p.val ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: shiftDays === p.val ? '#FFFFFF' : colors.text,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.customRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.inputLabel, { color: colors.text, marginBottom: 0 }]}>
            {rtl ? 'عدد أيام الإزاحة مخصص:' : 'Custom shift days:'}
          </Text>
          <View style={[styles.numberBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity
              onPress={() => setShiftDays((prev) => prev - 1)}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            <TextInput
              style={[styles.numberInput, { color: colors.text }]}
              value={String(shiftDays)}
              onChangeText={(t) => setShiftDays(parseInt(t, 10) || 0)}
              keyboardType="numeric"
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={() => setShiftDays((prev) => prev + 1)}
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Toggle Interval Adjustment */}
        <TouchableOpacity
          onPress={() => setUpdateIntervals(!updateIntervals)}
          style={[styles.toggleRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 10 }]}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.checkboxBox,
              {
                borderColor: updateIntervals ? colors.primary : colors.border,
                backgroundColor: updateIntervals ? colors.primary : 'transparent',
              },
            ]}
          >
            {updateIntervals && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <Text style={[styles.toggleLabel, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl
              ? 'تحديث فترات التكرار (Interval) بالتناسب مع أيام الإزاحة'
              : 'Adjust interval days proportionally with shift'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDistributeControls = () => {
    const presets = [
      { label: rtl ? 'على 3 أيام' : '3 days', val: 3 },
      { label: rtl ? 'على 5 أيام' : '5 days', val: 5 },
      { label: rtl ? 'على 7 أيام' : '7 days', val: 7 },
      { label: rtl ? 'على 14 يوم' : '14 days', val: 14 },
      { label: rtl ? 'على 30 يوم' : '30 days', val: 30 },
    ];

    const perDay = Math.ceil(cardCount / Math.max(1, spreadDays));

    return (
      <View style={styles.sectionBody}>
        <Text style={[styles.helpText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl
            ? 'توزيع البطاقات المتراكمة بالتساوي على مدار عدة أيام لمنع الضغط الدراسي والاختناق في يوم واحد.'
            : 'Distribute backlog cards evenly across several days to prevent study fatigue.'}
        </Text>

        <Text style={[styles.inputLabel, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'فترة التوزيع المطلوبة:' : 'Distribution duration:'}
        </Text>
        <View style={[styles.chipsWrap, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p.val}
              onPress={() => setSpreadDays(p.val)}
              style={[
                styles.chip,
                {
                  backgroundColor: spreadDays === p.val ? colors.primary : colors.surface,
                  borderColor: spreadDays === p.val ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: spreadDays === p.val ? '#FFFFFF' : colors.text,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.customRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.inputLabel, { color: colors.text, marginBottom: 0 }]}>
            {rtl ? 'عدد أيام التوزيع مخصص:' : 'Custom spread days:'}
          </Text>
          <View style={[styles.numberBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity
              onPress={() => setSpreadDays((prev) => Math.max(1, prev - 1))}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            <TextInput
              style={[styles.numberInput, { color: colors.text }]}
              value={String(spreadDays)}
              onChangeText={(t) => setSpreadDays(Math.max(1, parseInt(t, 10) || 1))}
              keyboardType="numeric"
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={() => setSpreadDays((prev) => prev + 1)}
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Start day selection */}
        <View style={[styles.chipsWrap, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 10 }]}>
          <TouchableOpacity
            onPress={() => setStartTomorrow(true)}
            style={[
              styles.chip,
              {
                backgroundColor: startTomorrow ? colors.primary : colors.surface,
                borderColor: startTomorrow ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: startTomorrow ? '#FFF' : colors.text, fontWeight: '700' }}>
              {rtl ? 'بدء التوزيع من غداً' : 'Start from tomorrow'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStartTomorrow(false)}
            style={[
              styles.chip,
              {
                backgroundColor: !startTomorrow ? colors.primary : colors.surface,
                borderColor: !startTomorrow ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: !startTomorrow ? '#FFF' : colors.text, fontWeight: '700' }}>
              {rtl ? 'بدء التوزيع من اليوم' : 'Start from today'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Ionicons name="pie-chart-outline" size={18} color={colors.primary} />
          <Text style={[styles.infoBannerText, { color: colors.primary, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl
              ? `المعدل التقديري: ~${perDay} بطاقة لكل يوم على مدى ${spreadDays} أيام.`
              : `Estimated load: ~${perDay} cards per day over ${spreadDays} days.`}
          </Text>
        </View>
      </View>
    );
  };

  const renderSpecificDateControls = () => {
    const presets = [
      { label: rtl ? 'اليوم (0)' : 'Today (0)', val: 0 },
      { label: rtl ? 'غداً (1)' : 'Tomorrow (1)', val: 1 },
      { label: rtl ? 'بعد يومين (2)' : 'In 2 days', val: 2 },
      { label: rtl ? 'بعد 3 أيام (3)' : 'In 3 days', val: 3 },
      { label: rtl ? 'بعد أسبوع (7)' : 'In 1 week', val: 7 },
    ];

    return (
      <View style={styles.sectionBody}>
        <Text style={[styles.helpText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl
            ? 'اجعل جميع البطاقات المحددة مستحقة للمراجعة في موعد محدد وثابت (مثلاً: جاهزة للمراجعة غداً).'
            : 'Make all selected cards due on a specific fixed date (e.g. all due tomorrow).'}
        </Text>

        <Text style={[styles.inputLabel, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'الموعد المستهدف:' : 'Target due date:'}
        </Text>
        <View style={[styles.chipsWrap, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p.val}
              onPress={() => setTargetDays(p.val)}
              style={[
                styles.chip,
                {
                  backgroundColor: targetDays === p.val ? colors.primary : colors.surface,
                  borderColor: targetDays === p.val ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: targetDays === p.val ? '#FFFFFF' : colors.text,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.customRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.inputLabel, { color: colors.text, marginBottom: 0 }]}>
            {rtl ? 'أيام من اليوم مخصص:' : 'Custom days from now:'}
          </Text>
          <View style={[styles.numberBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity
              onPress={() => setTargetDays((prev) => Math.max(0, prev - 1))}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            <TextInput
              style={[styles.numberInput, { color: colors.text }]}
              value={String(targetDays)}
              onChangeText={(t) => setTargetDays(Math.max(0, parseInt(t, 10) || 0))}
              keyboardType="numeric"
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={() => setTargetDays((prev) => prev + 1)}
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderMultiplierControls = () => {
    const presets = [
      { label: '0.5x (تكثيف 50%)', val: 0.5 },
      { label: '0.8x (تسريع)', val: 0.8 },
      { label: '1.2x (تمديد خفيف)', val: 1.2 },
      { label: '1.5x (تمديد 50%)', val: 1.5 },
      { label: '2.0x (مضاعفة الفترات)', val: 2.0 },
    ];

    return (
      <View style={styles.sectionBody}>
        <Text style={[styles.helpText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl
            ? 'تعديل فترات التكرار المتباعدة بنسبة مضاعفة لتسريع وتيرة المراجعة أو إبطائها حسب جدولك.'
            : 'Scale spaced repetition intervals by a factor to speed up or slow down review frequency.'}
        </Text>

        <Text style={[styles.inputLabel, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'معامل التكرار:' : 'Interval Multiplier:'}
        </Text>
        <View style={[styles.chipsWrap, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p.val}
              onPress={() => setMultiplier(p.val)}
              style={[
                styles.chip,
                {
                  backgroundColor: multiplier === p.val ? colors.primary : colors.surface,
                  borderColor: multiplier === p.val ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: multiplier === p.val ? '#FFFFFF' : colors.text,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.headerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="calendar" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'تعديل مواعيد المراجعة' : 'Bulk Reschedule Reviews'}
                </Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl
                    ? `تعديل جدول ${cardCount} بطاقة مدروسة ${deckName ? `• ${deckName}` : ''}`
                    : `Adjust schedule for ${cardCount} cards ${deckName ? `• ${deckName}` : ''}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mode Tabs */}
          {renderModeTabs()}

          {/* Controls based on active mode */}
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {mode === 'shift' && renderShiftControls()}
            {mode === 'distribute' && renderDistributeControls()}
            {mode === 'specific_date' && renderSpecificDateControls()}
            {mode === 'multiplier' && renderMultiplierControls()}
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.footerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              disabled={loading}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                {rtl ? 'إلغاء' : 'Cancel'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              style={[
                styles.applyBtn,
                {
                  backgroundColor: colors.primary,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  gap: 8,
                },
              ]}
              disabled={loading || cardCount === 0}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.applyBtnText}>
                    {rtl ? `تطبيق على ${cardCount} بطاقة` : `Apply to ${cardCount} cards`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 16,
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  tabsRow: {
    gap: 8,
    paddingVertical: 14,
  },
  tabBtn: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  tabLabel: {
    fontSize: 13,
  },
  contentScroll: {
    marginVertical: 4,
    maxHeight: 320,
  },
  sectionBody: {
    paddingVertical: 8,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  chipsWrap: {
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  customRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  numberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  numberInput: {
    width: 50,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
  toggleRow: {
    alignItems: 'center',
    marginVertical: 8,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  infoBannerText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  footerRow: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
