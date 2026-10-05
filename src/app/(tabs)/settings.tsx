import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card } from '../../components/ui';

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const rtl = isRTL();

  const renderItem = ({
    icon,
    iconColor = colors.primary,
    title,
    subtitle,
    onPress,
  }: SettingsItemProps) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
          flexDirection: rtl ? 'row-reverse' : 'row',
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: `${iconColor}15`,
            marginRight: rtl ? 0 : 12,
            marginLeft: rtl ? 12 : 0,
          },
        ]}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <View style={[styles.textCol, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
        <Text style={[styles.itemTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {title}
        </Text>
        <Text
          style={[styles.itemSubtitle, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name={rtl ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color={colors.textMuted}
        style={{ marginLeft: rtl ? 0 : 8, marginRight: rtl ? 8 : 0 }}
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header title={t('settings.title')} />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Offline Badge */}
        <View style={[styles.offlineBanner, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <Text style={[styles.offlineText, { color: colors.text, marginRight: rtl ? 8 : 0, marginLeft: rtl ? 0 : 8 }]}>
            {t('settings.offline_badge')}
          </Text>
        </View>

        {/* Section 1: Study & Appearance */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'تخصيص التجربة والدراسة' : 'Experience & Study'}
        </Text>
        <Card style={[styles.groupCard, { marginBottom: spacing.lg }]}>
          {renderItem({
            icon: 'sparkles-outline',
            iconColor: colors.primary,
            title: rtl ? 'مساعد الذكاء الاصطناعي' : 'AI Study Assistant',
            subtitle: rtl ? 'المفتاح، المزود، والتصحيح الذكي' : 'API Key, Provider & Smart Grading',
            onPress: () => router.push('/settings/ai'),
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {renderItem({
            icon: 'color-palette-outline',
            iconColor: colors.primary,
            title: t('settings.appearance'),
            subtitle: rtl ? 'السمة الداكنة والفاتحة واللغة' : 'Theme mode and language selection',
            onPress: () => router.push('/settings/appearance'),
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {renderItem({
            icon: 'calculator-outline',
            iconColor: colors.accent,
            title: rtl ? 'الدراسة والخوارزمية' : 'Study & Algorithm',
            subtitle: rtl ? 'خوارزمية FSRS/SM-2 والحدود اليومية' : 'FSRS/SM-2 scheduling and daily limits',
            onPress: () => router.push('/settings/study'),
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {renderItem({
            icon: 'calendar-outline',
            iconColor: colors.warning,
            title: rtl ? 'خطة وجدول المذاكرة' : 'Study Planner & Pace',
            subtitle: rtl ? 'توقعات المراجعة والتذكيرات الذكية' : 'Review forecast and pace calculator',
            onPress: () => router.push('/planner'),
          })}
        </Card>

        {/* Section 2: Security & Backup */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'الأمان والنسخ الاحتياطي' : 'Security & Backup'}
        </Text>
        <Card style={[styles.groupCard, { marginBottom: spacing.lg }]}>
          {renderItem({
            icon: 'lock-closed-outline',
            iconColor: colors.error,
            title: rtl ? 'قفل التطبيق برمز PIN' : 'App Lock & Security',
            subtitle: rtl ? 'حماية بياناتك وبطاقاتك برمز سري' : 'Protect flashcards with local PIN lock',
            onPress: () => router.push('/settings/security'),
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {renderItem({
            icon: 'cloud-upload-outline',
            iconColor: colors.primary,
            title: rtl ? 'النسخ الاحتياطي والاستعادة' : 'Backup & Restore',
            subtitle: rtl ? 'لقطات محلية واسترجاع سهل' : 'Automated local snapshots and restore',
            onPress: () => router.push('/settings/backup'),
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {renderItem({
            icon: 'share-outline',
            iconColor: colors.gold,
            title: rtl ? 'تصدير البطاقات' : 'Export Collection',
            subtitle: rtl ? 'تصدير بصيغ APKG و CSV و JSON' : 'Export decks to APKG, CSV, or JSON',
            onPress: () => router.push('/settings/export'),
          })}
        </Card>

        {/* Section 3: Tools & Database */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'الأدوات وقاعدة البيانات' : 'Tools & Database'}
        </Text>
        <Card style={[styles.groupCard, { marginBottom: spacing.lg }]}>
          {renderItem({
            icon: 'search-outline',
            iconColor: colors.primary,
            title: rtl ? 'متصفح البطاقات' : 'Card Browser',
            subtitle: rtl ? 'بحث متقدم وتعديل شامل للمحتوى' : 'Advanced search and batch editing',
            onPress: () => router.push('/browser'),
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {renderItem({
            icon: 'pricetags-outline',
            iconColor: colors.accent,
            title: rtl ? 'إدارة الوسوم' : 'Tag Manager',
            subtitle: rtl ? 'تنظيم وإعادة تسمية وسوم البطاقات' : 'Organize and manage tags',
            onPress: () => router.push('/tools/tags'),
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {renderItem({
            icon: 'server-outline',
            iconColor: colors.warning,
            title: t('settings.database'),
            subtitle: rtl ? 'فحص السلامة وضغط مساحة التخزين' : 'Integrity checks and database optimization',
            onPress: () => router.push('/settings/data'),
          })}
        </Card>

        {/* Section 4: About */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'حول التطبيق' : 'About'}
        </Text>
        <Card style={[styles.groupCard, { marginBottom: spacing.xl }]}>
          {renderItem({
            icon: 'information-circle-outline',
            iconColor: colors.primary,
            title: t('settings.about'),
            subtitle: rtl ? 'الإصدار 1.0.0 وبيان الخصوصية المحلية' : 'Version 1.0.0 and local privacy guarantee',
            onPress: () => router.push('/settings/about'),
          })}
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
  offlineBanner: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  groupCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});
