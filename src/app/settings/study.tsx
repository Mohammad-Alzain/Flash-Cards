import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Chip, TextField, Button } from '../../components/ui';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';
import { notificationService } from '../../core/notifications/notificationService';

export default function StudySettingsScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const rtl = isRTL();

  const [algorithm, setAlgorithm] = useState<'sm2' | 'fsrs'>('sm2');
  const [dailyNewLimit, setDailyNewLimit] = useState('20');
  const [dailyReviewLimit, setDailyReviewLimit] = useState('100');
  const [rolloverHour, setRolloverHour] = useState('4');
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [quickCardOnOpen, setQuickCardOnOpen] = useState(false);
  const [notificationCards, setNotificationCards] = useState(true);
  const [testingNotif, setTestingNotif] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsRepository.get('scheduler_algorithm', 'sm2'),
      settingsRepository.get('daily_new_limit', '20'),
      settingsRepository.get('daily_review_limit', '100'),
      settingsRepository.get('rollover_hour', '4'),
      settingsRepository.get('auto_play_audio', '1'),
      settingsRepository.get('quick_card_on_open', '0'),
      settingsRepository.get('notification_cards_enabled', '1'),
    ]).then(([algo, newLim, revLim, roll, audio, quickCard, notifCards]) => {
      setAlgorithm(algo as any);
      setDailyNewLimit(String(newLim));
      setDailyReviewLimit(String(revLim));
      setRolloverHour(String(roll));
      setAutoPlayAudio(audio !== '0');
      setQuickCardOnOpen(quickCard === '1');
      setNotificationCards(notifCards !== '0');
    });
  }, []);

  const handleAlgorithmChange = async (algo: 'sm2' | 'fsrs') => {
    setAlgorithm(algo);
    await settingsRepository.set('scheduler_algorithm', algo);
  };

  const handleNewLimitChange = async (val: string) => {
    setDailyNewLimit(val);
    await settingsRepository.set('daily_new_limit', val);
  };

  const handleReviewLimitChange = async (val: string) => {
    setDailyReviewLimit(val);
    await settingsRepository.set('daily_review_limit', val);
  };

  const handleRolloverChange = async (val: string) => {
    setRolloverHour(val);
    await settingsRepository.set('rollover_hour', val);
  };

  const handleAudioToggle = async (val: boolean) => {
    setAutoPlayAudio(val);
    await settingsRepository.set('auto_play_audio', val ? '1' : '0');
  };

  const handleQuickCardToggle = async (val: boolean) => {
    setQuickCardOnOpen(val);
    await settingsRepository.set('quick_card_on_open', val ? '1' : '0');
  };

  const handleNotificationCardsToggle = async (val: boolean) => {
    setNotificationCards(val);
    await settingsRepository.set('notification_cards_enabled', val ? '1' : '0');
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    await notificationService.sendInteractiveFlashcardNotification();
    setTestingNotif(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={rtl ? 'إعدادات الدراسة والخوارزمية' : 'Study & Algorithm Settings'}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Algorithm Card */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Ionicons
              name="calculator-outline"
              size={22}
              color={colors.primary}
              style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
            />
            <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'خوارزمية التكرار المتباعد' : 'Spaced Repetition Algorithm'}
            </Text>
          </View>

          <Text style={[styles.cardDescription, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl
              ? 'اختر خوارزمية جدولة البطاقات الذكية (Anki SM-2 الافتراضية أو FSRS الحديثة)'
              : 'Choose card scheduling algorithm (Standard SM-2 or Modern FSRS)'}
          </Text>

          <View style={[styles.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 12 }]}>
            <Chip
              label="SM-2 (Standard)"
              selected={algorithm === 'sm2'}
              onPress={() => handleAlgorithmChange('sm2')}
            />
            <Chip
              label="FSRS (Modern AI)"
              selected={algorithm === 'fsrs'}
              onPress={() => handleAlgorithmChange('fsrs')}
            />
          </View>
        </Card>

        {/* Daily Limits Card */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Ionicons
              name="speedometer-outline"
              size={22}
              color={colors.primary}
              style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
            />
            <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'الحدود اليومية' : 'Daily Study Limits'}
            </Text>
          </View>

          <TextField
            label={rtl ? 'عدد البطاقات الجديدة اليومية' : 'Daily New Cards Limit'}
            value={dailyNewLimit}
            onChangeText={handleNewLimitChange}
            placeholder="20"
            style={{ marginBottom: spacing.sm }}
          />

          <TextField
            label={rtl ? 'أقصى عدد للمراجعات اليومية' : 'Daily Maximum Reviews'}
            value={dailyReviewLimit}
            onChangeText={handleReviewLimitChange}
            placeholder="100"
            style={{ marginBottom: spacing.sm }}
          />

          <TextField
            label={rtl ? 'ساعة بداية اليوم الدراسي الجديد' : 'Next Day Rollover Hour (0-23)'}
            value={rolloverHour}
            onChangeText={handleRolloverChange}
            placeholder="4"
          />
        </Card>

        {/* Audio Card */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1, paddingRight: rtl ? 0 : 12, paddingLeft: rtl ? 12 : 0 }}>
              <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Ionicons
                  name="volume-high-outline"
                  size={22}
                  color={colors.primary}
                  style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
                />
                <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'تشغيل الصوت تلقائياً' : 'Auto-play Audio'}
                </Text>
              </View>
              <Text style={[styles.cardDescription, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                {rtl
                  ? 'تشغيل المقاطع الصوتية والنطق بمجرد ظهور وجه أو ظهر البطاقة'
                  : 'Automatically play audio clips and pronunciation on card reveal'}
              </Text>
            </View>

            <Switch
              value={autoPlayAudio}
              onValueChange={handleAudioToggle}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>

        {/* Study Without Opening App Card */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.primary}
              style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
            />
            <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'الدراسة بدون فتح التطبيق' : 'Study Without Opening the App'}
            </Text>
          </View>

          <Text style={[styles.cardDescription, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left', marginBottom: 14 }]}>
            {rtl
              ? 'ميزات ذكية تتيح لك تثبيت الحفظ أثناء استخدامك العادي للهاتف دون الحاجة للدخول لجلسة دراسة كاملة'
              : 'Smart ambient learning features while using your phone normally'}
          </Text>

          {/* Feature 1: Notification Cards */}
          <View style={{ paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
            <View style={[styles.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={{ flex: 1, paddingRight: rtl ? 0 : 12, paddingLeft: rtl ? 12 : 0 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>
                  {rtl ? 'بطاقات تفاعلية في الإشعارات' : 'Interactive Notification Cards'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: rtl ? 'right' : 'left' }}>
                  {rtl
                    ? 'يصلك إشعار بالكلمة مع زرين (أعرفها / لا أعرفها) للإجابة والمراجعة مباشرة من شريط الإشعارات.'
                    : 'Get card prompts with Know / Don\'t Know actions directly in your notification shade.'}
                </Text>
              </View>
              <Switch
                value={notificationCards}
                onValueChange={handleNotificationCardsToggle}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            {notificationCards && (
              <Button
                title={testingNotif ? (rtl ? 'جاري الإرسال...' : 'Sending...') : (rtl ? '🔔 تجربة إرسال بطاقة في الإشعارات الآن' : 'Test Notification Card Now')}
                variant="secondary"
                size="sm"
                onPress={handleTestNotification}
                disabled={testingNotif}
                style={{ marginTop: 10 }}
              />
            )}
          </View>

          {/* Feature 2: Quick Unlock Card */}
          <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
            <View style={[styles.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={{ flex: 1, paddingRight: rtl ? 0 : 12, paddingLeft: rtl ? 12 : 0 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>
                  {rtl ? 'سؤال عند فتح الهاتف / التطبيق' : 'Quick Card on App Open'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: rtl ? 'right' : 'left' }}>
                  {rtl
                    ? 'بطاقة واحدة سريعة تجيب عليها وتمر عليها قبل فتح الشاشة الرئيسية لاستغلال كل لحظة.'
                    : 'A single flashcard you answer upon unlocking or opening the app before accessing the home screen.'}
                </Text>
              </View>
              <Switch
                value={quickCardOnOpen}
                onValueChange={handleQuickCardToggle}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <Button
              title={rtl ? '⚡ معاينة وتجربة بطاقة الفتح السريعة' : 'Preview Quick Unlock Card'}
              variant="secondary"
              size="sm"
              onPress={() => router.push('/modal/quick-card')}
              style={{ marginTop: 10 }}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  card: {
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  chipsRow: {
    flexWrap: 'wrap',
    gap: 8,
  },
  rowBetween: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
