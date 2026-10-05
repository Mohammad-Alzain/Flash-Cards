import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, Badge, TextField } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { browserRepository } from '../../core/db/repositories/browserRepository';

export default function TagsManagerScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Rename modal
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await browserRepository.getAllTagsWithCounts();
      setTags(data);
    } catch (e) {
      console.error('Failed to load tags:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTags();
    }, [loadTags])
  );

  const handleExecuteRename = async () => {
    if (!renameTarget || !newTagName.trim()) return;
    try {
      await browserRepository.renameTag(renameTarget, newTagName.trim());
      setRenameTarget(null);
      setNewTagName('');
      await loadTags();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const handleDeleteTag = (targetTag: string) => {
    CustomAlert.alert(
      t('common.delete'),
      rtl ? `هل تريد حذف الوسم "${targetTag}" من جميع الملاحظات؟` : `Remove tag "${targetTag}" from all notes?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await browserRepository.deleteTag(targetTag);
            await loadTags();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header title={rtl ? 'إدارة الوسوم' : 'Tags Manager'} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {tags.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
            {rtl ? 'لا توجد وسوم في مجموعتك بعد.' : 'No tags found in your collection.'}
          </Text>
        ) : (
          tags.map((item) => (
            <Card key={item.tag} style={[styles.tagCard, { marginBottom: spacing.sm }]}>
              <View style={[styles.tagRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={styles.tagInfoCol}>
                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                    <Text
                      style={[
                        styles.tagName,
                        {
                          color: colors.text,
                          fontSize: typography.sizes.md,
                          fontWeight: typography.weights.bold,
                          textAlign: rtl ? 'right' : 'left',
                        },
                      ]}
                    >
                      {item.tag}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: rtl ? 'right' : 'left' }}>
                    {rtl ? `مستخدم في ${item.count} ملاحظة` : `Used in ${item.count} notes`}
                  </Text>
                </View>

                <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                  <Button
                    title={rtl ? 'تعديل' : 'Rename'}
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      setRenameTarget(item.tag);
                      setNewTagName(item.tag);
                    }}
                  />
                  <Button
                    icon={<Ionicons name="trash-outline" size={16} color="#FFFFFF" />}
                    variant="danger"
                    size="sm"
                    onPress={() => handleDeleteTag(item.tag)}
                  />
                </View>
              </View>
            </Card>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Rename Tag Modal */}
      <Modal
        visible={!!renameTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: rtl ? 'right' : 'left' }}>
              {rtl ? 'تعديل اسم الوسم' : 'Rename Tag'}
            </Text>

            <TextField
              label={rtl ? 'اسم الوسم الجديد' : 'New Tag Name'}
              value={newTagName}
              onChangeText={setNewTagName}
            />

            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 8, marginTop: 16 }}>
              <Button
                title={t('common.cancel')}
                variant="ghost"
                size="md"
                onPress={() => setRenameTarget(null)}
                style={{ flex: 1 }}
              />
              <Button
                title={t('common.save')}
                variant="primary"
                size="md"
                onPress={handleExecuteRename}
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
  tagCard: {
    paddingVertical: 12,
  },
  tagRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagInfoCol: {
    flex: 1,
  },
  tagName: {},
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
