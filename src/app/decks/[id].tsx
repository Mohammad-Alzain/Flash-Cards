import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, Badge, TextField, ProgressRing } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { ExportModal } from '../../components/export/ExportModal';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { queueBuilder } from '../../core/scheduler/queueBuilder';
import { ErrorModal } from '../../components/common/ErrorModal';
import { reportError, AppErrorDetails } from '../../core/utils/errorHandler';
import { BulkRescheduleModal } from '../../components/browser/BulkRescheduleModal';
import { NoteEditorModal } from '../../components/card/NoteEditorModal';
import {
  browserRepository,
  BrowserCardItem,
  BulkRescheduleResult,
} from '../../core/db/repositories/browserRepository';

type DeckTab = 'study' | 'cards' | 'tools';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [activeTab, setActiveTab] = useState<DeckTab>('study');
  const [deck, setDeck] = useState<DeckWithCounts | null>(null);
  const [studiedCount, setStudiedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeError, setActiveError] = useState<AppErrorDetails | null>(null);

  // Cards Tab State
  const [deckCards, setDeckCards] = useState<BrowserCardItem[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardSearch, setCardSearch] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteEditorVisible, setNoteEditorVisible] = useState(false);

  // Edit Deck Settings Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNewPerDay, setEditNewPerDay] = useState('20');
  const [editReviewsPerDay, setEditReviewsPerDay] = useState('100');

  // Export Modal
  const [exportModalVisible, setExportModalVisible] = useState(false);

  // Reschedule Studied Cards Modal
  const [deckRescheduleVisible, setDeckRescheduleVisible] = useState(false);
  const [deckStudiedCardIds, setDeckStudiedCardIds] = useState<string[]>([]);

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
        deckRepository.setLastStudiedDeckId(current.id).catch(() => {});
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

  // Load preview cards when switching to 'cards' tab or searching
  const loadCardsInDeck = useCallback(async (queryText = '') => {
    if (!deck) return;
    setCardsLoading(true);
    try {
      const q = `deck:"${deck.name}" ${queryText}`.trim();
      const results = await browserRepository.searchCards(q, 40, 0, 'created_at', 'DESC');
      setDeckCards(results);
    } catch (e) {
      console.error('Failed to load deck cards:', e);
    } finally {
      setCardsLoading(false);
    }
  }, [deck]);

  useEffect(() => {
    if (activeTab === 'cards' && deck) {
      loadCardsInDeck(cardSearch);
    }
  }, [activeTab, deck, cardSearch, loadCardsInDeck]);

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

  const handleOpenDeckReschedule = async () => {
    if (!deck) return;
    try {
      const ids = await browserRepository.getStudiedCardIdsInDeck(deck.id);
      if (ids.length === 0) {
        CustomAlert.alert(
          t('common.info') || 'تنبيه',
          rtl
            ? 'لا توجد كلمات مدروسة في هذه الرزمة بعد لتعديل مواعيدها.'
            : 'No studied cards in this deck yet.'
        );
        return;
      }
      setDeckStudiedCardIds(ids);
      setDeckRescheduleVisible(true);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const handleDeckRescheduleSuccess = (result: BulkRescheduleResult) => {
    CustomAlert.alert(
      t('common.done'),
      rtl
        ? `تم بنجاح تعديل وتحديث مواعيد إعادة ${result.updatedCount} كلمة مدروسة في رزمة "${deck?.name}"!`
        : `Successfully rescheduled ${result.updatedCount} cards in "${deck?.name}"!`
    );
    loadDeck();
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
              const errDetails = reportError('Delete Deck', err, t('common.error'));
              setActiveError(errDetails);
            }
          },
        },
      ]
    );
  };

  if (!deck) return null;

  const hasDue = deck.due_count > 0;
  const hasNew = deck.new_count > 0;
  const masteredCount = deck.future_count || 0;
  const masteryPercent = deck.card_count > 0 ? Math.round((masteredCount / deck.card_count) * 100) : 0;

  // Render Tabs Navigation Bar
  const renderTabBar = () => {
    const tabs: { key: DeckTab; label: string; icon: any; count?: number }[] = [
      { key: 'study', label: rtl ? 'المذاكرة' : 'Study', icon: 'school' },
      { key: 'cards', label: rtl ? 'البطاقات' : 'Cards', icon: 'documents', count: deck.card_count },
      { key: 'tools', label: rtl ? 'الأدوات' : 'Tools', icon: 'settings' },
    ];

    return (
      <View style={[styles.tabBarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.tabBarInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: isActive ? colors.primary : 'transparent',
                    flexDirection: rtl ? 'row-reverse' : 'row',
                  },
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isActive ? tab.icon : `${tab.icon}-outline`}
                  size={16}
                  color={isActive ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isActive ? '800' : '600',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                  {tab.count !== undefined ? ` (${tab.count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // 1. Tab Content: STUDY (المذاكرة)
  const renderStudyTab = () => {
    return (
      <View style={styles.tabContentArea}>
        {/* Mastery Gauge & Metrics Card */}
        <Card style={[styles.masteryCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <View style={[styles.masteryRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {/* Progress Ring */}
            <View style={styles.ringWrapper}>
              <ProgressRing
                progress={masteryPercent / 100}
                size={96}
                strokeWidth={9}
                color={colors.primary}
                label={`${masteryPercent}%`}
                sublabel={rtl ? 'إتقان' : 'Mastered'}
              />
            </View>

            {/* Metrics Breakdown Grid — Perfectly aligned key-value rows */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricItem, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={[styles.metricLabelGroup, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.metricDot, { backgroundColor: colors.dueCards || '#EF4444' }]} />
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    {rtl ? 'مستحقة اليوم' : 'Due Today'}
                  </Text>
                </View>
                <Text style={[styles.metricCount, { color: colors.text, textAlign: rtl ? 'left' : 'right' }]}>
                  {deck.due_count}
                </Text>
              </View>

              <View style={[styles.metricItem, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={[styles.metricLabelGroup, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.metricDot, { backgroundColor: colors.newCards || '#3B82F6' }]} />
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    {rtl ? 'جديدة' : 'New'}
                  </Text>
                </View>
                <Text style={[styles.metricCount, { color: colors.text, textAlign: rtl ? 'left' : 'right' }]}>
                  {deck.new_count}
                </Text>
              </View>

              <View style={[styles.metricItem, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={[styles.metricLabelGroup, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.metricDot, { backgroundColor: colors.learningCards || '#F59E0B' }]} />
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    {rtl ? 'قيد التعلم' : 'Learning'}
                  </Text>
                </View>
                <Text style={[styles.metricCount, { color: colors.text, textAlign: rtl ? 'left' : 'right' }]}>
                  {deck.learn_count}
                </Text>
              </View>

              <View style={[styles.metricItem, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={[styles.metricLabelGroup, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.metricDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    {rtl ? 'متقنة لاحقاً' : 'Future'}
                  </Text>
                </View>
                <Text style={[styles.metricCount, { color: colors.text, textAlign: rtl ? 'left' : 'right' }]}>
                  {masteredCount}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Primary Hero Action Button */}
        <View style={styles.heroActionWrapper}>
          {hasDue ? (
            <Button
              title={`${t('home.start_review')} (${deck.due_count})`}
              icon={<Ionicons name="flash" size={18} color="#FFFFFF" />}
              variant="primary"
              size="lg"
              onPress={() => router.push(`/study/review?deckId=${deck.id}`)}
              style={styles.heroButton}
            />
          ) : hasNew ? (
            <Button
              title={`${t('home.start_learning')} (${deck.new_count})`}
              icon={<Ionicons name="sparkles" size={18} color="#FFFFFF" />}
              variant="primary"
              size="lg"
              onPress={() => router.push(`/study/learn?deckId=${deck.id}`)}
              style={styles.heroButton}
            />
          ) : (
            <View style={[styles.doneBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Ionicons name="checkmark-done-circle" size={28} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.doneTitle, { color: colors.primary, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'أحسنت! أتممت مراجعات اليوم كاملة' : 'Great job! Daily reviews completed'}
                </Text>
                <Text style={[styles.doneSub, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'جميع البطاقات مستقرة. يمكنك المراجعة الحرة أو الاستماع عبر البودكاست.' : 'All cards are mastered. You can listen or cram anytime.'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Companion Study Modes List */}
        <Text style={[styles.sectionHeading, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'أنماط المذاكرة السريعة' : 'Alternative Study Modes'}
        </Text>

        <View style={styles.modesContainer}>
          {/* Podcast Mode */}
          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
            onPress={() => router.push(`/study/podcast?deckId=${deck.id}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.modeRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={[styles.modeIconCircle, { backgroundColor: '#3B82F618' }]}>
                <Ionicons name="headset" size={22} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modeTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'وضع البودكاست والاستماع' : 'Hands-Free Podcast Mode'}
                </Text>
                <Text style={[styles.modeDesc, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'مراجعة صوتية ذكية في الخلفية وأثناء قفل الهاتف مع مشغل الإشعارات' : 'Audio review in background & lockscreen with media notification'}
                </Text>
              </View>
              <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Learn New Cards (if due was primary) */}
          {hasDue && hasNew && (
            <TouchableOpacity
              style={[styles.modeCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              onPress={() => router.push(`/study/learn?deckId=${deck.id}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.modeRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={[styles.modeIconCircle, { backgroundColor: '#10B98118' }]}>
                  <Ionicons name="sparkles" size={22} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                    {rtl ? `تعلم بطاقات جديدة (${deck.new_count})` : `Learn New Cards (${deck.new_count})`}
                  </Text>
                  <Text style={[styles.modeDesc, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                    {rtl ? 'بدء دراسة كلمات ومفردات لم تدرسها من قبل' : 'Introduce and memorize new vocabulary'}
                  </Text>
                </View>
                <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Cram / Free Review */}
          {studiedCount > 0 && (
            <TouchableOpacity
              style={[styles.modeCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              onPress={() => router.push(`/study/review?deckId=${deck.id}&mode=studied`)}
              activeOpacity={0.7}
            >
              <View style={[styles.modeRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={[styles.modeIconCircle, { backgroundColor: '#F59E0B18' }]}>
                  <Ionicons name="repeat" size={22} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                    {rtl ? `المراجعة الحرة (${studiedCount} كلمة)` : `Free Review (${studiedCount} cards)`}
                  </Text>
                  <Text style={[styles.modeDesc, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                    {rtl ? 'مذاكرة وتثبيت الكلمات دون التأثير على خوارزمية التكرار' : 'Practice studied cards freely without affecting interval'}
                  </Text>
                </View>
                <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // 2. Tab Content: CARDS (البطاقات)
  const renderCardsTab = () => {
    return (
      <View style={styles.tabContentArea}>
        {/* Search & Add Bar */}
        <View style={[styles.cardsToolBar, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
              placeholder={rtl ? 'بحث في بطاقات الرزمة...' : 'Search deck cards...'}
              placeholderTextColor={colors.textMuted}
              value={cardSearch}
              onChangeText={setCardSearch}
            />
            {cardSearch ? (
              <TouchableOpacity onPress={() => setCardSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.addCardBtn,
              {
                backgroundColor: colors.primary,
                flexDirection: rtl ? 'row-reverse' : 'row',
              },
            ]}
            onPress={() => router.push({ pathname: '/modal/add-note', params: { deckId: id } })}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addCardBtnText}>{rtl ? 'إضافة' : 'Add'}</Text>
          </TouchableOpacity>
        </View>

        {/* Cards List or Loading */}
        {cardsLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>
              {rtl ? 'جاري تحميل البطاقات...' : 'Loading cards...'}
            </Text>
          </View>
        ) : deckCards.length === 0 ? (
          <View style={styles.emptyCardsBox}>
            <Ionicons name="documents-outline" size={44} color={colors.textMuted} />
            <Text style={[styles.emptyCardsTitle, { color: colors.text }]}>
              {cardSearch
                ? rtl
                  ? 'لا توجد بطاقات مطابقة لبحثك'
                  : 'No matching cards'
                : rtl
                ? 'لا توجد بطاقات في هذه الرزمة بعد'
                : 'No cards in this deck yet'}
            </Text>
            <Button
              title={rtl ? 'إضافة بطاقة جديدة الآن' : 'Add First Card'}
              variant="primary"
              size="sm"
              onPress={() => router.push({ pathname: '/modal/add-note', params: { deckId: id } })}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : (
          <View style={styles.cardsList}>
            {deckCards.map((item) => {
              const stateColor =
                item.state === 0
                  ? colors.newCards || '#3B82F6'
                  : item.state === 1
                  ? colors.learningCards || '#F59E0B'
                  : colors.dueCards || '#10B981';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.cardItemRow,
                    {
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                      borderRightColor: rtl ? stateColor : colors.border,
                      borderLeftColor: rtl ? colors.border : stateColor,
                      borderRightWidth: rtl ? 3.5 : 1,
                      borderLeftWidth: rtl ? 1 : 3.5,
                    },
                  ]}
                  onPress={() => {
                    setSelectedNoteId(item.note_id);
                    setNoteEditorVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.cardItemInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.cardPrompt, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
                        numberOfLines={1}
                      >
                        {item.sort_field || '(No Prompt)'}
                      </Text>
                      {item.tags ? (
                        <Text style={[styles.cardTags, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                          🏷️ {item.tags}
                        </Text>
                      ) : null}
                    </View>

                    {/* Horizontal Badge + Chevron */}
                    <View style={[styles.cardItemMeta, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                      <Badge
                        count={
                          item.state === 0
                            ? rtl ? 'جديدة' : 'New'
                            : item.state === 1
                            ? rtl ? 'تعلم' : 'Learn'
                            : rtl ? 'مراجعة' : 'Due'
                        }
                        variant={item.state === 0 ? 'new' : item.state === 1 ? 'learn' : 'due'}
                        size="sm"
                      />
                      <Ionicons
                        name={rtl ? 'chevron-back' : 'chevron-forward'}
                        size={16}
                        color={colors.textSecondary}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.fullBrowserLink, { borderColor: colors.border }]}
              onPress={() => router.push(`/browser?deckId=${deck.id}&deckName=${encodeURIComponent(deck.name)}`)}
              activeOpacity={0.7}
            >
              <Text style={[styles.fullBrowserLinkText, { color: colors.primary }]}>
                {rtl ? 'فتح مستعرض البطاقات الكامل والفرز ➜' : 'Open Full Browser & Advanced Filters ➜'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // 3. Tab Content: TOOLS & SETTINGS (الأدوات والإعدادات)
  const renderToolsTab = () => {
    return (
      <View style={styles.tabContentArea}>
        {/* Group 1: Review & Scheduling */}
        <Text style={[styles.groupHeading, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'إدارة التكرار والجدولة' : 'Spaced Repetition & Quiz'}
        </Text>

        <Card style={[styles.groupedListCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          {/* Bulk Reschedule */}
          <TouchableOpacity
            style={[styles.groupRowItem, { borderBottomColor: colors.border }]}
            onPress={handleOpenDeckReschedule}
            disabled={studiedCount === 0}
            activeOpacity={0.7}
          >
            <View style={[styles.groupRowInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={[styles.groupIconBox, { backgroundColor: '#F59E0B18' }]}>
                <Ionicons name="calendar-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupRowTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'تعديل مواعيد الكلمات المدروسة' : 'Bulk Reschedule Studied Words'}
                </Text>
                <Text style={[styles.groupRowSub, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                  {studiedCount > 0
                    ? rtl
                      ? `إعادة جدولة، إزاحة، أو توزيع ${studiedCount} كلمة`
                      : `Shift, distribute, or set due dates for ${studiedCount} cards`
                    : rtl
                    ? 'لا توجد كلمات مدروسة في الرزمة بعد'
                    : 'No studied cards in this deck'}
                </Text>
              </View>
              <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Smart Quiz */}
          <TouchableOpacity
            style={styles.groupRowItem}
            onPress={() => router.push(`/(tabs)/quiz?deckId=${deck.id}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.groupRowInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={[styles.groupIconBox, { backgroundColor: '#8B5CF618' }]}>
                <Ionicons name="school-outline" size={20} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupRowTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'اختبار وتدريب الرزمة' : 'Smart Deck Quiz'}
                </Text>
                <Text style={[styles.groupRowSub, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'توليد اختبارات ذكية وتحدي معلومات تفاعلي' : 'Generate interactive multiple-choice quizzes'}
                </Text>
              </View>
              <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Group 2: Data & Sharing */}
        <Text style={[styles.groupHeading, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'المشاركة والنسخ الاحتياطي' : 'Sharing & Backup'}
        </Text>

        <Card style={[styles.groupedListCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          {/* Export Deck */}
          <TouchableOpacity
            style={styles.groupRowItem}
            onPress={() => setExportModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.groupRowInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={[styles.groupIconBox, { backgroundColor: '#EC489918' }]}>
                <Ionicons name="share-social-outline" size={20} color="#EC4899" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupRowTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'تصدير ومشاركة الرزمة' : 'Export & Share Deck'}
                </Text>
                <Text style={[styles.groupRowSub, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'تصدير كـ APKG (Anki) أو Excel أو CSV' : 'Export as APKG (Anki), Excel, or CSV'}
                </Text>
              </View>
              <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Group 3: Deck Preferences */}
        <Text style={[styles.groupHeading, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'إعدادات وحدود الرزمة' : 'Deck Settings & Limits'}
        </Text>

        <Card style={[styles.groupedListCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          {/* Edit Settings */}
          <TouchableOpacity
            style={styles.groupRowItem}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.groupRowInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={[styles.groupIconBox, { backgroundColor: '#3B82F618' }]}>
                <Ionicons name="options-outline" size={20} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupRowTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'تعديل الاسم والحدود اليومية' : 'Edit Name & Daily Limits'}
                </Text>
                <Text style={[styles.groupRowSub, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl
                    ? `جديدة: ${deck.new_per_day} • مراجعات: ${deck.reviews_per_day}`
                    : `New: ${deck.new_per_day}/day • Reviews: ${deck.reviews_per_day}/day`}
                </Text>
              </View>
              <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Group 4: Danger Zone */}
        <Text style={[styles.groupHeading, { color: colors.error || '#EF4444', textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'المنطقة الخطرة' : 'Danger Zone'}
        </Text>

        <Card style={[styles.groupedListCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          {/* Delete Deck */}
          <TouchableOpacity
            style={styles.groupRowItem}
            onPress={handleDeleteDeck}
            activeOpacity={0.7}
          >
            <View style={[styles.groupRowInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={[styles.groupIconBox, { backgroundColor: `${colors.error || '#EF4444'}18` }]}>
                <Ionicons name="trash-outline" size={20} color={colors.error || '#EF4444'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupRowTitle, { color: colors.error || '#EF4444', textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'حذف هذه الرزمة بالكامل' : 'Delete This Deck'}
                </Text>
                <Text style={[styles.groupRowSub, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'حذف الرزمة وكافة البطاقات المسجلة بداخلها نهائياً' : 'Permanently remove deck and its cards'}
                </Text>
              </View>
              <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.error || '#EF4444'} />
            </View>
          </TouchableOpacity>
        </Card>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <Header
        title={deck.name}
        onBack={() => router.back()}
        rightElement={
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/modal/add-note', params: { deckId: id } })}
              activeOpacity={0.7}
              accessibilityLabel={rtl ? 'إضافة بطاقة' : 'Add Card'}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel={rtl ? 'إعدادات الرزمة' : 'Deck Settings'}
            >
              <Ionicons name="settings-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Deck Description (if present) */}
        {deck.description ? (
          <Text style={[styles.deckDescText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
            {deck.description}
          </Text>
        ) : null}

        {/* 3-Tab Bar (المذاكرة | البطاقات | الأدوات) */}
        {renderTabBar()}

        {/* Dynamic Tab Content Area */}
        {activeTab === 'study' && renderStudyTab()}
        {activeTab === 'cards' && renderCardsTab()}
        {activeTab === 'tools' && renderToolsTab()}

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
          <Card style={[styles.modalCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="settings-outline" size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {rtl ? 'إعدادات وحدود الرزمة' : 'Deck Settings'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

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
              label={rtl ? 'البطاقات الجديدة يومياً' : 'New Cards per Day'}
              value={editNewPerDay}
              onChangeText={setEditNewPerDay}
            />

            <TextField
              label={rtl ? 'الحد الأقصى للمراجعات يومياً' : 'Max Reviews per Day'}
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

      {/* Export Modal */}
      <ExportModal
        visible={exportModalVisible}
        deckId={deck.id}
        deckName={deck.name}
        onClose={() => setExportModalVisible(false)}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={activeError !== null}
        error={activeError}
        onClose={() => setActiveError(null)}
      />

      {/* Bulk Reschedule Studied Cards Modal */}
      <BulkRescheduleModal
        visible={deckRescheduleVisible}
        selectedCardIds={deckStudiedCardIds}
        deckName={deck?.name}
        onClose={() => setDeckRescheduleVisible(false)}
        onSuccess={handleDeckRescheduleSuccess}
      />

      {/* Note Editor Modal */}
      <NoteEditorModal
        visible={noteEditorVisible}
        noteId={selectedNoteId}
        onClose={() => {
          setNoteEditorVisible(false);
          setSelectedNoteId(null);
        }}
        onSaved={() => {
          loadCardsInDeck(cardSearch);
          loadDeck();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  deckDescText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tabBarInner: {
    alignItems: 'center',
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 8,
  },
  tabButtonText: {
    fontSize: 13,
  },
  tabContentArea: {
    marginTop: 2,
  },

  // Study Tab Styles
  masteryCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  masteryRow: {
    alignItems: 'center',
    gap: 16,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsGrid: {
    flex: 1,
    gap: 8,
  },
  metricItem: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metricLabelGroup: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  metricCount: {
    fontSize: 14,
    fontWeight: '800',
    minWidth: 32,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroActionWrapper: {
    marginBottom: 20,
  },
  heroButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  doneTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  doneSub: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  modesContainer: {
    gap: 10,
  },
  modeCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  modeRow: {
    alignItems: 'center',
    gap: 12,
  },
  modeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  modeDesc: {
    fontSize: 11,
    lineHeight: 16,
  },

  // Cards Tab Styles
  cardsToolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 12,
    flexShrink: 0,
  },
  addCardBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardsBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCardsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  cardsList: {
    gap: 8,
  },
  cardItemRow: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardPrompt: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardTags: {
    fontSize: 11,
  },
  cardItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullBrowserLink: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 6,
  },
  fullBrowserLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Tools Tab Styles
  groupHeading: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  groupedListCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  groupRowItem: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.15)',
  },
  groupRowInner: {
    alignItems: 'center',
    gap: 12,
  },
  groupIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  groupRowSub: {
    fontSize: 11,
    lineHeight: 16,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalActions: {
    gap: 8,
  },
});
