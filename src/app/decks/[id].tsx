import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, Badge, TextField } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { exportToApkg } from '../../core/exporters/apkgExporter';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { queueBuilder } from '../../core/scheduler/queueBuilder';
import { Deck } from '../../core/types/models';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();
  const [exporting, setExporting] = useState(false);

  const [deck, setDeck] = useState<DeckWithCounts | null>(null);
  const [studiedCount, setStudiedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Edit Deck Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNewPerDay, setEditNewPerDay] = useState('20');
  const [editReviewsPerDay, setEditReviewsPerDay] = useState('100');

  const loadDeck = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const all = await deckRepository.getAllWithCounts();
      const current = all.find((d) => d.id === id);
      if (current) {
        setDeck(current);
        setEditName(current.name);
        setEditDesc(current.description || '');
        setEditNewPerDay(String(current.new_per_day || 20));
        setEditReviewsPerDay(String(current.reviews_per_day || 100));
        const studied = await queueBuilder.getStudiedCardsCount(current.id);
        setStudiedCount(studied);
      }
    } catch (e) {
      console.error('Failed to load deck:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadDeck();
    }, [loadDeck])
  );

  const handleSaveDeckSettings = async () => {
    if (!deck) return;
    try {
      await deckRepository.update(deck.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        new_per_day: parseInt(editNewPerDay, 10) || 20,
        reviews_per_day: parseInt(editReviewsPerDay, 10) || 100,
      });
      setEditModalVisible(false);
      await loadDeck();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const handleDeleteDeck = () => {
    if (!deck) return;
    CustomAlert.alert(
      t('common.delete'),
      rtl
        ? `هل أنت متأكد من حذف الحزمة "${deck.name}" وجميع البطاقات التابعة لها؟`
        : `Delete deck "${deck.name}" and all its cards?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deckRepository.delete(deck.id);
              router.back();
            } catch (err: any) {
              CustomAlert.alert(t('common.error'), err.message);
            }
          },
        },
      ]
    );
  };

  const handleQuickExport = async () => {
    if (!deck) return;
    try {
      setExporting(true);
      const res = await exportToApkg({ deckId: deck.id });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.filePath, {
          mimeType: 'application/octet-stream',
          dialogTitle: `Export ${deck.name}`,
          UTI: 'public.data',
        });
      } else {
        CustomAlert.alert(t('common.done'), `Saved to: ${res.fileName}`);
      }
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    } finally {
      setExporting(false);
    }
  };

  if (!deck) return null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={deck.name}
        onBack={() => router.back()}
        rightElement={
          <Button
            icon={<Ionicons name="settings-outline" size={20} color={colors.text} />}
            variant="ghost"
            size="sm"
            onPress={() => setEditModalVisible(true)}
          />
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Deck Description */}
        {deck.description && (
          <Text
            style={[
              styles.desc,
              {
                color: colors.textSecondary,
                fontSize: typography.sizes.sm,
                textAlign: rtl ? 'right' : 'left',
                marginBottom: spacing.md,
              },
            ]}
          >
            {deck.description}
          </Text>
        )}

        {/* Big Counters Summary Card */}
        <Card style={[styles.summaryCard, { marginBottom: spacing.lg }]}>
          <Text
            style={[
              styles.summaryTitle,
              {
                color: colors.text,
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.bold,
                textAlign: rtl ? 'right' : 'left',
                marginBottom: spacing.sm,
              },
            ]}
          >
            {t('decks.cards_badge', { count: deck.card_count })}
          </Text>

          <View style={[styles.countersRow, { flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }]}>
            <View style={styles.counterBox}>
              <Badge count={deck.new_count} variant="new" size="md" />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {rtl ? 'جديدة' : 'New'}
              </Text>
            </View>

            <View style={styles.counterBox}>
              <Badge count={deck.learn_count} variant="learn" size="md" />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {rtl ? 'قيد التعلم' : 'Learning'}
              </Text>
            </View>

            <View style={styles.counterBox}>
              <Badge count={deck.due_count} variant="due" size="md" />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {rtl ? 'مستحقة اليوم' : 'Due Today'}
              </Text>
            </View>

            <View style={styles.counterBox}>
              <Badge count={deck.future_count || 0} variant="neutral" size="md" />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {rtl ? 'مراجعة لاحقة' : 'Future Review'}
              </Text>
            </View>

            {(deck.suspended_count || 0) > 0 && (
              <View style={styles.counterBox}>
                <Badge count={deck.suspended_count || 0} variant="warning" size="md" />
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  {rtl ? 'معلّقة' : 'Suspended'}
                </Text>
              </View>
            )}
          </View>

          {/* Breakdown summary text explaining all cards */}
          <View
            style={{
              marginTop: spacing.md,
              paddingTop: spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                textAlign: rtl ? 'right' : 'left',
                lineHeight: 16,
              }}
            >
              {rtl
                ? `إجمالي الرزمة (${deck.card_count} بطاقة) = ${deck.new_count} جديدة + ${deck.learn_count} قيد التعلم + ${deck.due_count} مستحقة اليوم + ${deck.future_count || 0} متقنة لمواعيد قادمة${(deck.suspended_count || 0) > 0 ? ` + ${deck.suspended_count} معلقة` : ''}.`
                : `Total ${deck.card_count} cards = ${deck.new_count} new + ${deck.learn_count} learning + ${deck.due_count} due today + ${deck.future_count || 0} future review.`}
            </Text>
          </View>
        </Card>

        {/* Study Actions */}
        <Button
          title={t('home.start_review')}
          variant="primary"
          size="lg"
          disabled={deck.due_count === 0}
          onPress={() => router.push(`/study/review?deckId=${deck.id}`)}
          style={{ marginBottom: spacing.md }}
        />

        <Button
          title={t('home.start_learning')}
          variant="secondary"
          size="lg"
          disabled={deck.new_count === 0}
          onPress={() => router.push(`/study/learn?deckId=${deck.id}`)}
          style={{ marginBottom: spacing.md }}
        />

        {/* Review Studied Cards Shortcut (Cram/Free Review) */}
        {studiedCount > 0 && (
          <Button
            title={`${t('study.review_studied')} (${studiedCount})`}
            icon={<Ionicons name="repeat-outline" size={18} color={colors.primary} />}
            variant="ghost"
            size="md"
            onPress={() => router.push(`/study/review?deckId=${deck.id}&mode=studied`)}
            style={{ marginBottom: spacing.md }}
          />
        )}

        {/* Podcast Mode Shortcut */}
        <Button
          title={t('study.podcastMode') || 'Hands-Free Podcast Mode'}
          icon={<Ionicons name="headset-outline" size={18} color="#FFFFFF" />}
          variant="secondary"
          size="md"
          onPress={() => router.push(`/study/podcast?deckId=${deck.id}`)}
          style={{ marginBottom: spacing.md }}
        />

        {/* Card Creation and Deck Actions Shortcuts */}
        <Card style={[styles.actionCard, { marginBottom: spacing.md }]}>
          <Button
            title={t('add_note.title')}
            icon={<Ionicons name="add-circle-outline" size={18} color={colors.primary} />}
            variant="ghost"
            size="md"
            onPress={() => router.push('/modal/add-note')}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <Button
            title={rtl ? 'استعراض بطاقات الرزمة' : 'Browse & Edit Cards'}
            icon={<Ionicons name="list-outline" size={18} color={colors.primary} />}
            variant="ghost"
            size="md"
            onPress={() => router.push(`/browser?deckId=${deck.id}&deckName=${encodeURIComponent(deck.name)}`)}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <Button
            title={rtl ? 'اختبار وتخصيص حقول الرزمة' : 'Configure & Quiz Deck'}
            icon={<Ionicons name="school-outline" size={18} color={colors.primary} />}
            variant="ghost"
            size="md"
            onPress={() => router.push(`/(tabs)/quiz?deckId=${deck.id}`)}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <Button
            title="Export to Anki (.apkg)"
            icon={<Ionicons name="share-outline" size={18} color={colors.primary} />}
            variant="ghost"
            size="md"
            loading={exporting}
            onPress={handleQuickExport}
          />
        </Card>

        {/* Delete Deck Danger Button */}
        <Button
          title={t('common.delete') + ' ' + t('decks.title')}
          variant="danger"
          size="sm"
          onPress={handleDeleteDeck}
          style={{ marginTop: spacing.xl }}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Deck Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: colors.surfaceRaised }]}>
            <Text
              style={[
                styles.modalTitle,
                {
                  color: colors.text,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                  marginBottom: spacing.md,
                },
              ]}
            >
              Deck Settings
            </Text>

            <TextField
              label={t('decks.deck_name')}
              value={editName}
              onChangeText={setEditName}
            />

            <TextField
              label={t('decks.deck_desc')}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              numberOfLines={2}
            />

            <TextField
              label="New Cards per Day"
              value={editNewPerDay}
              onChangeText={setEditNewPerDay}
            />

            <TextField
              label="Max Reviews per Day"
              value={editReviewsPerDay}
              onChangeText={setEditReviewsPerDay}
            />

            <View style={[styles.modalActions, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: spacing.md }]}>
              <Button
                title={t('common.cancel')}
                variant="ghost"
                size="md"
                onPress={() => setEditModalVisible(false)}
                style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
              />
              <Button
                title={t('common.save')}
                variant="primary"
                size="md"
                onPress={handleSaveDeckSettings}
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
  desc: {},
  summaryCard: {},
  summaryTitle: {},
  countersRow: {
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 8,
  },
  counterBox: {
    alignItems: 'center',
  },
  actionCard: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    padding: 24,
  },
  modalTitle: {},
  modalActions: {},
});
