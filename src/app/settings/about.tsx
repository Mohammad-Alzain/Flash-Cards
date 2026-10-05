import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Badge } from '../../components/ui';
import { Logo } from '../../components/brand/Logo';

export default function AboutSettingsScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const rtl = isRTL();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('settings.about')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* App Branding Card */}
        <Card style={[styles.brandCard, { borderColor: colors.primary, marginBottom: spacing.lg }]}>
          <Logo variant="mark" size={68} style={{ marginBottom: 14 }} />

          <Text style={[styles.appName, { color: colors.text }]}>
            {t('settings.app_name')}
          </Text>

          <Badge label={t('settings.version')} variant="neutral" style={{ marginTop: 6 }} />

          <View style={[styles.offlineBanner, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, marginTop: 16, flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <Text style={[styles.offlineTitle, { color: colors.text }]}>
              {t('settings.offline_badge')}
            </Text>
          </View>

          <Text style={[styles.offlineDesc, { color: colors.textSecondary, marginTop: 8 }]}>
            {t('settings.offline_desc')}
          </Text>
        </Card>

        {/* Features Checklist */}
        <Card style={[styles.featuresCard, { marginBottom: spacing.lg }]}>
          <Text style={[styles.sectionHeading, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl ? 'الميزات والقدرات المدعومة' : 'Core Capabilities'}
          </Text>

          {[
            rtl ? 'جدولة FSRS المتقدمة و SM-2 القياسية' : 'Advanced FSRS & Classic SM-2 Schedulers',
            rtl ? 'توافق كامل مع قوالب Anki واستيراد APKG' : 'Full Anki Template Engine & APKG Import',
            rtl ? 'وضع الاختبارات التفاعلية ودفتر الأخطاء' : 'Interactive Quizzes & Mistakes Notebook',
            rtl ? 'أمان وقفل برمز PIN وتشفير محلي' : 'Local PIN App Lock & Privacy',
            rtl ? 'سبورة للكتابة باليد ونطق صوتي TTS' : 'Handwriting Whiteboard & TTS Audio',
          ].map((item, idx) => (
            <View key={idx} style={[styles.featureRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }]}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.featureText, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                {item}
              </Text>
            </View>
          ))}
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
  brandCard: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 2,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F615',
    marginBottom: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  offlineDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  featuresCard: {
    padding: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  featureRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureText: {
    fontSize: 13,
    flex: 1,
  },
});
