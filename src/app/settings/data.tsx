import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button } from '../../components/ui';
import { checkDatabaseIntegrity, getDatabase, resetDatabase } from '../../core/db/connection';
import { deckRepository } from '../../core/db/repositories/deckRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { noteRepository } from '../../core/db/repositories/noteRepository';

export default function DataSettingsScreen() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const rtl = isRTL();

  const [deckCount, setDeckCount] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [checkingDb, setCheckingDb] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    const [decks, cards, notes] = await Promise.all([
      deckRepository.getAllWithCounts(),
      cardRepository.getTotalCount(),
      noteRepository.getTotalCount(),
    ]);
    setDeckCount(decks.length);
    setCardCount(cards);
    setNoteCount(notes);
  };

  const handleIntegrityCheck = async () => {
    setCheckingDb(true);
    try {
      const result = await checkDatabaseIntegrity();
      if (result.ok) {
        CustomAlert.alert(t('settings.integrity_check'), t('settings.integrity_ok'));
      } else {
        CustomAlert.alert(t('common.warning'), result.message);
      }
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    } finally {
      setCheckingDb(false);
    }
  };

  const handleVacuumOptimize = async () => {
    setOptimizing(true);
    try {
      const db = await getDatabase();
      await db.execAsync('VACUUM; ANALYZE;');
      CustomAlert.alert(
        rtl ? 'تم التحسين' : 'Optimized',
        rtl ? 'تم ضغط وتنظيم قاعدة البيانات بنجاح.' : 'Database vacuumed and optimized successfully.'
      );
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handleResetDatabase = () => {
    CustomAlert.alert(
      rtl ? 'تفريغ وإعادة ضبط قاعدة البيانات' : 'Reset Database from Scratch',
      rtl
        ? 'تحذير شديد: سيتم حذف جميع الحزم والبطاقات والوسائط والتاريخ نهائياً، واستعادة الحزمة الأولية الافتراضية. هل أنت متأكد تماماً من المتابعة؟'
        : 'Warning: This will permanently wipe all decks, cards, media, and review history, returning the app to its fresh initial state. Are you sure?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: rtl ? 'نعم، تفريغ الكل' : 'Yes, Reset All',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await resetDatabase();
              await loadCounts();
              CustomAlert.alert(
                rtl ? 'تمت إعادة الضبط' : 'Reset Complete',
                rtl
                  ? 'تم تفريغ كافة البيانات وإعادة ضبط التطبيق بنجاح.'
                  : 'Database and media have been reset to factory defaults.'
              );
            } catch (e: any) {
              CustomAlert.alert(t('common.error'), e.message);
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('settings.database')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Storage Stats Card */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Ionicons
              name="server-outline"
              size={22}
              color={colors.primary}
              style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
            />
            <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'إحصائيات التخزين المحلي' : 'Local Storage Statistics'}
            </Text>
          </View>

          <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text style={{ color: colors.textSecondary }}>{t('settings.total_decks')}:</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{deckCount}</Text>
          </View>
          <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text style={{ color: colors.textSecondary }}>{t('settings.total_cards')}:</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{cardCount}</Text>
          </View>
          <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text style={{ color: colors.textSecondary }}>{t('settings.total_notes')}:</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{noteCount}</Text>
          </View>
        </Card>

        {/* Maintenance Actions Card */}
        <Card style={[styles.card, { marginBottom: spacing.lg }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Ionicons
              name="construct-outline"
              size={22}
              color={colors.primary}
              style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
            />
            <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'الصيانة والفحص' : 'Maintenance & Health'}
            </Text>
          </View>

          <Text style={[styles.cardDescription, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left', marginBottom: 16 }]}>
            {rtl
              ? 'فحص شامل لجداول SQLite وضغط المساحة غير المستخدمة'
              : 'Integrity checks and defragmentation for high database performance'}
          </Text>

          <Button
            title={t('settings.integrity_check')}
            variant="secondary"
            size="md"
            loading={checkingDb}
            icon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />}
            onPress={handleIntegrityCheck}
            style={{ marginBottom: 10 }}
          />

          <Button
            title={rtl ? 'ضغط وتحسين الفهارس (VACUUM)' : 'Optimize & Vacuum Database'}
            variant="ghost"
            size="md"
            loading={optimizing}
            icon={<Ionicons name="sparkles-outline" size={18} color={colors.primary} />}
            onPress={handleVacuumOptimize}
          />
        </Card>

        {/* Danger Zone: Full Wipe & Reset */}
        <Card style={[styles.card, { borderColor: colors.error, borderWidth: 1.5, marginBottom: spacing.xl }]}>
          <View style={[styles.cardHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Ionicons
              name="warning-outline"
              size={22}
              color={colors.error}
              style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
            />
            <Text style={[styles.cardTitle, { color: colors.error, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'منطقة الخطر: إعادة ضبط المصنع' : 'Danger Zone: Factory Reset'}
            </Text>
          </View>

          <Text style={[styles.cardDescription, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left', marginBottom: 16 }]}>
            {rtl
              ? 'حذف كافة البيانات والحزم والبطاقات والملفات الصوتية والصور بالكامل وإعادة ضبط التطبيق من الصفر.'
              : 'Wipe all cards, decks, media, and review history to reset everything completely from scratch.'}
          </Text>

          <Button
            title={rtl ? 'تفريغ قاعدة البيانات وإعادة الضبط من الصفر' : 'Reset Database from Scratch'}
            variant="danger"
            size="md"
            loading={resetting}
            icon={<Ionicons name="trash-bin-outline" size={18} color="#FFFFFF" />}
            onPress={handleResetDatabase}
          />
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
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  statRow: {
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F022',
  },
});
