import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, TextField } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { checkDatabaseIntegrity } from '../../core/db/connection';
import { mediaManager } from '../../core/media/mediaManager';
import { browserRepository } from '../../core/db/repositories/browserRepository';

export default function ToolsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  // Find & Replace Modal
  const [findReplaceModal, setFindReplaceModal] = useState(false);
  const [searchWord, setSearchWord] = useState('');
  const [replaceWord, setReplaceWord] = useState('');

  // Storage Stats
  const [mediaStats, setMediaStats] = useState({ count: 0, totalSizeBytes: 0 });

  useEffect(() => {
    mediaManager.getStorageStats().then(setMediaStats);
  }, []);

  const handleCheckDb = async () => {
    const res = await checkDatabaseIntegrity();
    if (res.ok) {
      CustomAlert.alert('Database Check', rtl ? 'فحص سلامة قاعدة البيانات: ممتاز! قاعدة البيانات تعمل بشكل سليم.' : 'PRAGMA integrity_check: OK! Database is healthy.');
    } else {
      CustomAlert.alert(t('common.warning'), res.message);
    }
  };

  const handleCheckEmptyCards = async () => {
    const empty = await browserRepository.findEmptyCards();
    if (empty.length === 0) {
      CustomAlert.alert(t('tools.empty_cards'), rtl ? 'لم يتم العثور على بطاقات فارغة في مجموعتك.' : 'No empty cards found in your collection.');
    } else {
      CustomAlert.alert(
        rtl ? 'تم العثور على بطاقات فارغة' : 'Empty Cards Found',
        rtl ? `تم العثور على ${empty.length} بطاقة ذات وجه فارغ. هل ترغب في حذفها؟` : `Found ${empty.length} cards with empty fronts. Would you like to delete them?`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              await browserRepository.deleteEmptyCards(empty.map((e) => e.cardId));
              CustomAlert.alert(t('common.done'), rtl ? `تم حذف ${empty.length} بطاقة فارغة.` : `Deleted ${empty.length} empty cards.`);
            },
          },
        ]
      );
    }
  };

  const handleFindDuplicates = async () => {
    const duplicates = await browserRepository.findDuplicates();
    if (duplicates.length === 0) {
      CustomAlert.alert(t('tools.duplicates'), rtl ? 'لم يتم العثور على بطاقات أو ملاحظات مكررة.' : 'No duplicate notes found.');
    } else {
      const summary = duplicates
        .slice(0, 5)
        .map((d) => `"${d.sortField}": ${d.count}`)
        .join('\n');
      CustomAlert.alert(
        rtl ? 'تم العثور على تكرارات' : 'Duplicates Found',
        rtl ? `تم العثور على ${duplicates.length} مجموعة مكررة:\n\n${summary}` : `Found ${duplicates.length} duplicate groups:\n\n${summary}`
      );
    }
  };

  const handleExecuteFindReplace = async () => {
    if (!searchWord.trim()) return;
    try {
      const count = await browserRepository.findAndReplace(
        searchWord.trim(),
        replaceWord.trim()
      );
      setFindReplaceModal(false);
      CustomAlert.alert(t('common.done'), rtl ? `تم استبدال الكلمات في ${count} ملاحظة.` : `Replaced occurrences in ${count} notes.`);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const handleVacuum = async () => {
    try {
      await browserRepository.vacuumDatabase();
      CustomAlert.alert(t('common.done'), rtl ? 'تم ضغط وتحسين أداء قاعدة البيانات بنجاح (VACUUM OK).' : 'Database compacted and defragmented (VACUUM OK).');
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header title={t('tools.title')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* 0. Note Types & Fields Management */}
        <Card style={[styles.toolCard, { marginBottom: spacing.md }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Ionicons name="layers-outline" size={20} color={colors.primary} />
            <Text style={[styles.toolTitle, { color: colors.text }]}>
              {rtl ? 'أنماط البطاقات والحقول' : 'Note Types & Fields'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 4, textAlign: rtl ? 'right' : 'left' }}>
            {rtl
              ? 'إدارة أنماط البطاقات، إضافة حقول مخصصة لكل نمط، وتعديل قوالب وتصميم البطاقات.'
              : 'Manage note types, add custom fields, and customize templates and CSS styling.'}
          </Text>
          <Button
            title={rtl ? 'إدارة الأنماط والحقول' : 'Manage Note Types & Fields'}
            variant="secondary"
            size="sm"
            onPress={() => router.push('/note-types')}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* 1. Database & Integrity */}
        <Card style={[styles.toolCard, { marginBottom: spacing.md }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={[styles.toolTitle, { color: colors.text }]}>
              {rtl ? 'فحص سلامة قاعدة البيانات' : 'Database Integrity Check'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 4, textAlign: rtl ? 'right' : 'left' }}>
            {rtl ? 'فحص فهارس وجداول SQLite الداخلية للتأكد من عدم وجود أي تلف أو خطأ.' : 'Verifies internal SQLite indexes and B-Tree tables.'}
          </Text>
          <Button
            title={rtl ? 'فحص الآن' : 'Check Database'}
            variant="ghost"
            size="sm"
            onPress={handleCheckDb}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* 2. Media & Storage */}
        <Card style={[styles.toolCard, { marginBottom: spacing.md }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Ionicons name="folder-outline" size={20} color={colors.primary} />
            <Text style={[styles.toolTitle, { color: colors.text }]}>
              {rtl ? 'ملفات الوسائط والتخزين' : 'Media Files & Storage'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 4, textAlign: rtl ? 'right' : 'left' }}>
            {rtl
              ? `يحتوي التطبيق على ${mediaStats.count} ملف وسائط محلي (${Math.round(mediaStats.totalSizeBytes / 1024)} كيلوبايت)`
              : `${mediaStats.count} media files stored (${Math.round(mediaStats.totalSizeBytes / 1024)} KB)`}
          </Text>
          <Button
            title={rtl ? 'فحص الوسائط' : 'Check Media'}
            variant="ghost"
            size="sm"
            onPress={async () => {
              const stats = await mediaManager.getStorageStats();
              setMediaStats(stats);
              CustomAlert.alert(rtl ? 'ملفات الوسائط' : 'Media Files', rtl ? `تم العثور على ${stats.count} ملف صور وصوت محلي.` : `Found ${stats.count} local images and audio files.`);
            }}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* 3. Empty Cards Cleaner */}
        <Card style={[styles.toolCard, { marginBottom: spacing.md }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.toolTitle, { color: colors.text }]}>
              {rtl ? 'منظف البطاقات الفارغة' : 'Empty Cards Cleaner'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 4, textAlign: rtl ? 'right' : 'left' }}>
            {rtl ? 'البحث عن البطاقات التي ليس لها محتوى وحذفها لتنظيف المجموعة.' : 'Finds and removes cards whose templates evaluate to an empty front.'}
          </Text>
          <Button
            title={rtl ? 'فحص البطاقات الفارغة' : 'Scan for Empty Cards'}
            variant="ghost"
            size="sm"
            onPress={handleCheckEmptyCards}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* 4. Find & Replace */}
        <Card style={[styles.toolCard, { marginBottom: spacing.md }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Ionicons name="search-outline" size={20} color={colors.primary} />
            <Text style={[styles.toolTitle, { color: colors.text }]}>
              {rtl ? 'البحث والاستبدال' : 'Find & Replace'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 4, textAlign: rtl ? 'right' : 'left' }}>
            {rtl ? 'استبدال الكلمات والنصوص بشكل جماعي عبر جميع حقول البطاقات.' : 'Perform bulk text replacements across all note fields in your collection.'}
          </Text>
          <Button
            title={rtl ? 'فتح البحث والاستبدال' : 'Open Find & Replace'}
            variant="secondary"
            size="sm"
            onPress={() => setFindReplaceModal(true)}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* 5. Find Duplicates */}
        <Card style={[styles.toolCard, { marginBottom: spacing.md }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Ionicons name="copy-outline" size={20} color={colors.warning} />
            <Text style={[styles.toolTitle, { color: colors.text }]}>
              {rtl ? 'كاشف البطاقات المكررة' : 'Duplicate Finder'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 4, textAlign: rtl ? 'right' : 'left' }}>
            {rtl ? 'التعرف على البطاقات والملاحظات التي تشترك في نفس السؤال أو المحتوى.' : 'Identifies notes sharing identical prompts or sort fields.'}
          </Text>
          <Button
            title={rtl ? 'البحث عن المكررات' : 'Find Duplicates'}
            variant="ghost"
            size="sm"
            onPress={handleFindDuplicates}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* 6. Tags Manager Link */}
        <Card style={[styles.toolCard, { marginBottom: spacing.md }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
            <Text style={[styles.toolTitle, { color: colors.text }]}>
              {rtl ? 'إدارة الوسوم (Tags)' : 'Tags Manager'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 4, textAlign: rtl ? 'right' : 'left' }}>
            {rtl ? 'إعادة تسمية الوسوم وحذفها وتنظيمها عبر البطاقات.' : 'Rename, inspect, and remove tags across notes.'}
          </Text>
          <Button
            title={rtl ? 'إدارة الوسوم' : 'Manage Tags'}
            variant="ghost"
            size="sm"
            onPress={() => router.push('/tools/tags')}
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* 7. Vacuum Compact */}
        <Card style={[styles.toolCard, { marginBottom: spacing.xl }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Ionicons name="flash-outline" size={20} color={colors.primary} />
            <Text style={[styles.toolTitle, { color: colors.text }]}>
              {rtl ? 'ضغط قاعدة البيانات (VACUUM)' : 'Compact Database (VACUUM)'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 4, textAlign: rtl ? 'right' : 'left' }}>
            {rtl ? 'استعادة المساحة التخزينية غير المستخدمة وإلغاء التجزئة لتسريع الاستجابة.' : 'Reclaims free storage space and defragments SQLite data files.'}
          </Text>
          <Button
            title={rtl ? 'ضغط قاعدة البيانات' : 'Compact Database'}
            variant="primary"
            size="sm"
            onPress={handleVacuum}
            style={{ marginTop: 8 }}
          />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Find & Replace Modal */}
      <Modal
        visible={findReplaceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setFindReplaceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              Find & Replace Text
            </Text>

            <TextField
              label="Find Text"
              value={searchWord}
              onChangeText={setSearchWord}
              placeholder="e.g. old word"
            />

            <TextField
              label="Replace With"
              value={replaceWord}
              onChangeText={setReplaceWord}
              placeholder="e.g. new word"
            />

            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 16 }}>
              <Button
                title={t('common.cancel')}
                variant="ghost"
                size="md"
                onPress={() => setFindReplaceModal(false)}
                style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
              />
              <Button
                title="Replace All"
                variant="primary"
                size="md"
                onPress={handleExecuteFindReplace}
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
  toolCard: {
    padding: 16,
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: 'bold',
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
