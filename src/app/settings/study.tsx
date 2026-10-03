import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Chip, TextField } from '../../components/ui';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';

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

  useEffect(() => {
    Promise.all([
      settingsRepository.get('scheduler_algorithm', 'sm2'),
      settingsRepository.get('daily_new_limit', '20'),
      settingsRepository.get('daily_review_limit', '100'),
      settingsRepository.get('rollover_hour', '4'),
      settingsRepository.get('auto_play_audio', '1'),
    ]).then(([algo, newLim, revLim, roll, audio]) => {
      setAlgorithm(algo as any);
      setDailyNewLimit(String(newLim));
      setDailyReviewLimit(String(revLim));
      setRolloverHour(String(roll));
      setAutoPlayAudio(audio !== '0');
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
