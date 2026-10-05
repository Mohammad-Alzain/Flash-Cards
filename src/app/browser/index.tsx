import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, Badge, TextField, Chip } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { EmptySearchIllustration } from '../../components/brand';
import { NoteEditorModal } from '../../components/card/NoteEditorModal';
import { BulkRescheduleModal } from '../../components/browser/BulkRescheduleModal';
import {
  browserRepository,
  BrowserCardItem,
  BrowserSortColumn,
  BrowserSortOrder,
  BulkRescheduleResult,
} from '../../core/db/repositories/browserRepository';

const PAGE_SIZE = 50;

interface BrowserCardRowProps {
  item: BrowserCardItem;
  isSelected: boolean;
  isMultiSelect: boolean;
  rtl: boolean;
  colors: any;
  typography: any;
  spacing: any;
  onToggleSelect: (id: string) => void;
  onOpenEdit: (noteId: string) => void;
}

const BrowserCardRow = React.memo<BrowserCardRowProps>(
  ({
    item,
    isSelected,
    isMultiSelect,
    rtl,
    colors,
    typography,
    spacing,
    onToggleSelect,
    onOpenEdit,
  }) => {
    return (
      <Card
        style={[
          styles.itemCard,
          {
            marginBottom: spacing.sm,
            borderColor: isSelected ? colors.primary : colors.border,
            backgroundColor: isSelected ? colors.primaryLight : colors.surfaceRaised,
          },
        ]}
        onPress={() => {
          if (isMultiSelect) {
            onToggleSelect(item.id);
          } else {
            onOpenEdit(item.note_id);
          }
        }}
      >
        <View style={[styles.itemRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {isMultiSelect && (
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: isSelected ? colors.primary : colors.borderDarker,
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  marginRight: rtl ? 0 : 10,
                  marginLeft: rtl ? 10 : 0,
                },
              ]}
            >
              {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
          )}

          <View style={styles.itemTextCol}>
            <Text
              style={[
                styles.sortFieldText,
                {
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
              numberOfLines={2}
            >
              {item.sort_field || '(No Prompt)'}
            </Text>

            <View
              style={[
                styles.metaRow,
                {
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  marginTop: 4,
                  alignItems: 'center',
                },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {item.deck_name}
              </Text>
              {item.tags ? (
                <View
                  style={{
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    marginHorizontal: 6,
                  }}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={11}
                    color={colors.textMuted}
                    style={{ marginRight: 2 }}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {item.tags}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={[styles.badgeCol, { alignItems: rtl ? 'flex-start' : 'flex-end' }]}>
            {item.suspended === 1 ? (
              <Badge count="Suspended" variant="warning" size="sm" />
            ) : item.state === 0 ? (
              <Badge count="New" variant="new" size="sm" />
            ) : (
              <Badge count={`${item.interval_days}d`} variant="due" size="sm" />
            )}
            {!isMultiSelect && (
              <Ionicons
                name="create-outline"
                size={16}
                color={colors.textSecondary}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
        </View>
      </Card>
    );
  },
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.isMultiSelect === next.isMultiSelect &&
      prev.item.id === next.item.id &&
      prev.item.sort_field === next.item.sort_field &&
      prev.item.tags === next.item.tags &&
      prev.item.suspended === next.item.suspended &&
      prev.item.interval_days === next.item.interval_days &&
      prev.colors === next.colors &&
      prev.rtl === next.rtl
    );
  }
);

export default function CardBrowserScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();
  const params = useLocalSearchParams<{ query?: string; deckName?: string; deckId?: string }>();

  const initialQuery = params.query || (params.deckName ? `deck:"${params.deckName}"` : '');

  const [cards, setCards] = useState<BrowserCardItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (params.query) {
      setSearchQuery(params.query);
    } else if (params.deckName) {
      setSearchQuery(`deck:"${params.deckName}"`);
    }
  }, [params.query, params.deckName]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<BrowserSortColumn>('created_at');
  const [sortOrder, setSortOrder] = useState<BrowserSortOrder>('DESC');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Multi-select mode
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit Note Modal
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Bulk Tag Modal
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagLoading, setTagLoading] = useState(false);

  // Bulk Reschedule Modal
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);

  // Load cards (first page or reload)
  const loadCards = useCallback(
    async (
      query: string,
      col: BrowserSortColumn = sortColumn,
      ord: BrowserSortOrder = sortOrder
    ) => {
      setLoading(true);
      try {
        const [count, results] = await Promise.all([
          browserRepository.countCards(query),
          browserRepository.searchCards(query, PAGE_SIZE, 0, col, ord),
        ]);
        setTotalCount(count);
        setCards(results);
      } catch (e) {
        console.error('Failed to search cards:', e);
      } finally {
        setLoading(false);
      }
    },
    [sortColumn, sortOrder]
  );

  // Infinite scroll: fetch next page
  const handleLoadMore = async () => {
    if (loading || loadingMore || cards.length >= totalCount) return;
    setLoadingMore(true);
    try {
      const nextBatch = await browserRepository.searchCards(
        searchQuery,
        PAGE_SIZE,
        cards.length,
        sortColumn,
        sortOrder
      );
      if (nextBatch.length > 0) {
        setCards((prev) => [...prev, ...nextBatch]);
      }
    } catch (e) {
      console.error('Failed to load more cards:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCards(searchQuery, sortColumn, sortOrder);
    }, [loadCards, searchQuery, sortColumn, sortOrder])
  );

  const handleApplyFilter = (filter: string) => {
    if (searchQuery.includes(filter)) {
      const newQ = searchQuery.replace(filter, '').trim();
      setSearchQuery(newQ);
    } else {
      const newQ = `${searchQuery} ${filter}`.trim();
      setSearchQuery(newQ);
    }
  };

  const handleToggleSelectCard = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  }, []);

  const handleOpenEdit = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
    setEditModalVisible(true);
  }, []);

  const handleSelectAllLoaded = () => {
    if (selectedIds.size === cards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map((c) => c.id)));
    }
  };

  const handleSelectNextBatch = (batchSize: number = 20) => {
    setIsMultiSelect(true);
    const updated = new Set(selectedIds);
    let added = 0;
    for (const card of cards) {
      if (!updated.has(card.id)) {
        updated.add(card.id);
        added++;
        if (added >= batchSize) break;
      }
    }
    setSelectedIds(updated);
  };

  // Bulk Actions
  const handleStudySelected = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    router.push(`/study/review?cardIds=${ids.join(',')}`);
  };

  const handleBulkMarkStudied = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await browserRepository.bulkMarkStudied(ids);
    CustomAlert.alert(
      t('common.done'),
      rtl ? `تم تعيين ${ids.length} بطاقة كمدروسة.` : `Marked ${ids.length} cards as studied.`
    );
    setSelectedIds(new Set());
    setIsMultiSelect(false);
    await loadCards(searchQuery, sortColumn, sortOrder);
  };

  const handleBulkSuspend = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await browserRepository.bulkSetSuspended(ids, true);
    CustomAlert.alert(
      t('common.done'),
      rtl ? `تم تعليق ${ids.length} بطاقة.` : `Suspended ${ids.length} cards.`
    );
    setSelectedIds(new Set());
    setIsMultiSelect(false);
    await loadCards(searchQuery, sortColumn, sortOrder);
  };

  const handleBulkReset = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await browserRepository.bulkResetProgress(ids);
    CustomAlert.alert(
      t('common.done'),
      rtl ? `تمت إعادة تعيين ${ids.length} بطاقة.` : `Reset progress for ${ids.length} cards.`
    );
    setSelectedIds(new Set());
    setIsMultiSelect(false);
    await loadCards(searchQuery, sortColumn, sortOrder);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    CustomAlert.alert(
      t('common.delete'),
      rtl
        ? `هل أنت متأكد من حذف ${ids.length} بطاقة محددة نهائياً؟`
        : `Permanently delete ${ids.length} selected cards?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await browserRepository.bulkDeleteCards(ids);
            setSelectedIds(new Set());
            setIsMultiSelect(false);
            await loadCards(searchQuery, sortColumn, sortOrder);
          },
        },
      ]
    );
  };

  // Bulk Add Tag
  const handleConfirmAddTag = async () => {
    if (!tagInput.trim() || selectedIds.size === 0) return;
    setTagLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const count = await browserRepository.bulkAddTags(ids, tagInput.trim());
      setTagModalVisible(false);
      setTagInput('');
      CustomAlert.alert(
        t('common.done'),
        rtl
          ? `تمت إضافة الوسم بنجاح إلى ${count} ملاحظة.`
          : `Successfully added tag to ${count} notes.`
      );
      await loadCards(searchQuery, sortColumn, sortOrder);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e?.message || 'Failed to add tags');
    } finally {
      setTagLoading(false);
    }
  };

  // Bulk Reschedule Success Handler
  const handleRescheduleSuccess = (result: BulkRescheduleResult) => {
    CustomAlert.alert(
      t('common.done'),
      rtl
        ? `تم بنجاح تعديل وتحديث مواعيد إعادة ${result.updatedCount} بطاقة مدروسة!`
        : `Successfully updated review schedules for ${result.updatedCount} cards!`
    );
    setSelectedIds(new Set());
    setIsMultiSelect(false);
    loadCards(searchQuery, sortColumn, sortOrder);
  };

  // Sorting Selection
  const handleSelectSort = (col: BrowserSortColumn, ord: BrowserSortOrder) => {
    setSortColumn(col);
    setSortOrder(ord);
    setSortModalVisible(false);
    loadCards(searchQuery, col, ord);
  };

  const sortColumnLabels: { col: BrowserSortColumn; labelAr: string; labelEn: string }[] = [
    { col: 'created_at', labelAr: 'تاريخ الإنشاء', labelEn: 'Date Created' },
    { col: 'due', labelAr: 'تاريخ الاستحقاق / المراجعة', labelEn: 'Due Date' },
    { col: 'sort_field', labelAr: 'الحقل الأول (أبجدياً)', labelEn: 'Front Field' },
    { col: 'ease_factor', labelAr: 'عامل السهولة', labelEn: 'Ease Factor' },
    { col: 'interval_days', labelAr: 'الفاصل الزمني', labelEn: 'Interval Days' },
    { col: 'reps', labelAr: 'عدد مرات التكرار', labelEn: 'Repetitions' },
    { col: 'lapses', labelAr: 'مرات النسيان', labelEn: 'Lapses' },
  ];

  const renderCardItem = useCallback(
    ({ item }: { item: BrowserCardItem }) => (
      <BrowserCardRow
        item={item}
        isSelected={selectedIds.has(item.id)}
        isMultiSelect={isMultiSelect}
        rtl={rtl}
        colors={colors}
        typography={typography}
        spacing={spacing}
        onToggleSelect={handleToggleSelectCard}
        onOpenEdit={handleOpenEdit}
      />
    ),
    [
      selectedIds,
      isMultiSelect,
      rtl,
      colors,
      typography,
      spacing,
      handleToggleSelectCard,
      handleOpenEdit,
    ]
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {rtl ? 'جاري تحميل المزيد...' : 'Loading more cards...'}
          </Text>
        </View>
      );
    }
    if (!loading && cards.length > 0 && cards.length >= totalCount) {
      return (
        <View style={styles.footerLoader}>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            {rtl ? 'تم عرض جميع البطاقات' : 'All cards loaded'}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <Header
        title={rtl ? 'متصفح البطاقات' : 'Card Browser'}
        onBack={() => router.back()}
        rightElement={
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
            <Button
              title={rtl ? 'ترتيب' : 'Sort'}
              icon={<Ionicons name="swap-vertical-outline" size={15} color={colors.primary} />}
              variant="ghost"
              size="sm"
              onPress={() => setSortModalVisible(true)}
            />
            <Button
              title={rtl ? 'الأدوات' : 'Tools'}
              icon={<Ionicons name="build-outline" size={15} color={colors.primary} />}
              variant="ghost"
              size="sm"
              onPress={() => router.push('/tools')}
            />
            <Button
              title={isMultiSelect ? (rtl ? 'تم' : 'Done') : (rtl ? 'تحديد' : 'Select')}
              variant={isMultiSelect ? 'primary' : 'ghost'}
              size="sm"
              onPress={() => {
                setIsMultiSelect(!isMultiSelect);
                setSelectedIds(new Set());
              }}
            />
          </View>
        }
      />

      {/* Search Input Bar */}
      <View style={[styles.searchBar, { paddingHorizontal: spacing.lg, marginTop: spacing.sm }]}>
        <TextField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={
            rtl
              ? 'بحث (مثال: is:due tag:vocab "resilience")'
              : 'e.g. is:due tag:vocab "resilience"'
          }
          clearButton
          style={{ marginBottom: 0 }}
        />
      </View>

      {/* Quick Filter Chips */}
      <View
        style={[styles.chipsContainer, { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip
            label={rtl ? 'مدروسة' : 'is:studied'}
            selected={searchQuery.includes('is:studied')}
            onPress={() => handleApplyFilter('is:studied')}
          />
          <Chip
            label={rtl ? 'مستحقة للمراجعة' : 'is:due'}
            selected={searchQuery.includes('is:due')}
            onPress={() => handleApplyFilter('is:due')}
          />
          <Chip
            label={rtl ? 'جديدة' : 'is:new'}
            selected={searchQuery.includes('is:new')}
            onPress={() => handleApplyFilter('is:new')}
          />
          <Chip
            label={rtl ? 'معلّقة' : 'is:suspended'}
            selected={searchQuery.includes('is:suspended')}
            onPress={() => handleApplyFilter('is:suspended')}
          />
          <Chip
            label={rtl ? 'أخطاء متكررة' : 'prop:lapses>1'}
            selected={searchQuery.includes('prop:lapses>1')}
            onPress={() => handleApplyFilter('prop:lapses>1')}
          />
          <Chip
            label={rtl ? 'مؤجلة' : 'is:buried'}
            selected={searchQuery.includes('is:buried')}
            onPress={() => handleApplyFilter('is:buried')}
          />
          <Chip
            label={rtl ? 'معلّمة بنجمة' : 'flag:1'}
            selected={searchQuery.includes('flag:1')}
            onPress={() => handleApplyFilter('flag:1')}
          />
        </ScrollView>
      </View>

      {/* Results Header / Batch Selection */}
      <View
        style={[
          styles.resultsHeader,
          {
            paddingHorizontal: spacing.lg,
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginVertical: 4,
          },
        ]}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
          {selectedIds.size > 0
            ? rtl
              ? `تم تحديد ${selectedIds.size} من أصل ${totalCount}`
              : `${selectedIds.size} of ${totalCount} selected`
            : rtl
            ? `عرض ${cards.length} من أصل ${totalCount} بطاقة`
            : `Showing ${cards.length} of ${totalCount} cards`}
        </Text>

        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => handleSelectNextBatch(20)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: colors.surface,
              marginRight: rtl ? 0 : 8,
              marginLeft: rtl ? 8 : 0,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
              {rtl ? '+ تحديد 20' : '+ Select 20'}
            </Text>
          </Pressable>

          {isMultiSelect && (
            <Pressable onPress={handleSelectAllLoaded}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: 'bold' }}>
                {selectedIds.size === cards.length
                  ? rtl
                    ? 'إلغاء الكل'
                    : 'Deselect All'
                  : rtl
                  ? 'تحديد المعروض'
                  : 'Select Loaded'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Cards List with Infinite Scrolling */}
      {loading && cards.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>
            {rtl ? 'جاري تحميل البطاقات...' : 'Loading cards...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          renderItem={renderCardItem}
          keyExtractor={(item) => item.id}
          extraData={selectedIds}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: isMultiSelect ? 160 : 60 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptySearchIllustration size={130} />
              <Text
                style={{
                  color: colors.text,
                  marginTop: 12,
                  fontSize: 16,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {rtl ? 'لا توجد بطاقات مطابقة' : 'No matching cards found'}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  marginTop: 4,
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                {rtl
                  ? 'جرب البحث بكلمات أخرى أو تغيير الفلاتر الحالية'
                  : 'Try searching with different terms or adjust filters'}
              </Text>
            </View>
          }
        />
      )}

      {/* Bulk Action Bottom Bar */}
      {isMultiSelect && selectedIds.size > 0 && (
        <View
          style={[
            styles.bulkBar,
            {
              backgroundColor: colors.surfaceRaised,
              borderTopColor: colors.border,
            },
          ]}
        >
          {/* Header Row: Count info & Quick Study button */}
          <View
            style={[
              styles.bulkHeaderRow,
              { flexDirection: rtl ? 'row-reverse' : 'row' },
            ]}
          >
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: rtl ? 0 : 8,
                  marginLeft: rtl ? 8 : 0,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                  {selectedIds.size}
                </Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
                {rtl ? 'بطاقة محددة' : 'cards selected'}
              </Text>
            </View>

            <Pressable
              onPress={handleStudySelected}
              style={({ pressed }) => [
                styles.studyPillBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                },
              ]}
            >
              <Ionicons
                name="play"
                size={14}
                color="#FFFFFF"
                style={{ marginRight: rtl ? 0 : 4, marginLeft: rtl ? 4 : 0 }}
              />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                {rtl ? 'مذاكرة المحددة' : 'Study Selected'}
              </Text>
            </Pressable>
          </View>

          {/* Action Tools Grid / Row */}
          <View style={[styles.bulkToolsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {/* 1. Add Tag */}
            <Pressable
              onPress={() => setTagModalVisible(true)}
              style={({ pressed }) => [
                styles.bulkToolItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.bulkToolIconBox,
                  { backgroundColor: `${colors.primary}15` },
                ]}
              >
                <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.bulkToolLabel, { color: colors.text }]}>
                {rtl ? 'إضافة وسم' : 'Add Tag'}
              </Text>
            </Pressable>

            {/* 2. Mark Studied */}
            <Pressable
              onPress={handleBulkMarkStudied}
              style={({ pressed }) => [
                styles.bulkToolItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.bulkToolIconBox,
                  { backgroundColor: `${colors.dueCards}18` },
                ]}
              >
                <Ionicons name="checkmark-done" size={18} color={colors.dueCards} />
              </View>
              <Text style={[styles.bulkToolLabel, { color: colors.text }]}>
                {rtl ? 'مدروسة' : 'Studied'}
              </Text>
            </Pressable>

            {/* 3. Bulk Reschedule Review Dates */}
            <Pressable
              onPress={() => setRescheduleModalVisible(true)}
              style={({ pressed }) => [
                styles.bulkToolItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.bulkToolIconBox,
                  { backgroundColor: `${colors.primary}18` },
                ]}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.bulkToolLabel, { color: colors.text }]}>
                {rtl ? 'تعديل المواعيد' : 'Reschedule'}
              </Text>
            </Pressable>

            {/* 3. Suspend */}
            <Pressable
              onPress={handleBulkSuspend}
              style={({ pressed }) => [
                styles.bulkToolItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.bulkToolIconBox,
                  { backgroundColor: `${colors.warning}18` },
                ]}
              >
                <Ionicons name="pause-circle-outline" size={18} color={colors.warning} />
              </View>
              <Text style={[styles.bulkToolLabel, { color: colors.text }]}>
                {rtl ? 'تعليق' : 'Suspend'}
              </Text>
            </Pressable>

            {/* 4. Reset */}
            <Pressable
              onPress={handleBulkReset}
              style={({ pressed }) => [
                styles.bulkToolItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.bulkToolIconBox,
                  { backgroundColor: `${colors.secondary}18` },
                ]}
              >
                <Ionicons name="refresh-outline" size={18} color={colors.secondary} />
              </View>
              <Text style={[styles.bulkToolLabel, { color: colors.text }]}>
                {rtl ? 'إعادة ضبط' : 'Reset'}
              </Text>
            </Pressable>

            {/* 5. Delete */}
            <Pressable
              onPress={handleBulkDelete}
              style={({ pressed }) => [
                styles.bulkToolItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.bulkToolIconBox,
                  { backgroundColor: `${colors.error}18` },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </View>
              <Text style={[styles.bulkToolLabel, { color: colors.error }]}>
                {rtl ? 'حذف' : 'Delete'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Bulk Tag Input Modal */}
      <Modal
        visible={tagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTagModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.tagModalContent,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons
                name="pricetag-outline"
                size={22}
                color={colors.primary}
                style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
              />
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                }}
              >
                {rtl ? 'إضافة وسم للبطاقات المحددة' : 'Add Tag to Selected Cards'}
              </Text>
            </View>

            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginBottom: 14,
                textAlign: rtl ? 'right' : 'left',
              }}
            >
              {rtl
                ? `سيتم تطبيق الوسم على ${selectedIds.size} بطاقة محددة. يمكنك كتابة وسوم متعددة مفصولة بمسافة.`
                : `Tag will be added to ${selectedIds.size} selected cards. You can enter multiple tags separated by space.`}
            </Text>

            <TextField
              value={tagInput}
              onChangeText={setTagInput}
              placeholder={rtl ? 'أدخل اسم الوسم (مثال: هام درس_1)' : 'e.g. important lesson_1'}
              autoFocus
              clearButton
            />

            <View
              style={[
                styles.modalButtonsRow,
                { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 14 },
              ]}
            >
              <Button
                title={rtl ? 'إلغاء' : 'Cancel'}
                variant="ghost"
                size="md"
                onPress={() => setTagModalVisible(false)}
                style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
              />
              <Button
                title={rtl ? 'تطبيق الوسم' : 'Apply Tag'}
                variant="primary"
                size="md"
                disabled={!tagInput.trim() || tagLoading}
                onPress={handleConfirmAddTag}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Sorting Options Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.sortModalContent,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                }}
              >
                {rtl ? 'خيارات ترتيب البطاقات' : 'Sort Cards By'}
              </Text>
              <Pressable onPress={() => setSortModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Sort Order Toggle */}
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                marginBottom: 16,
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 4,
              }}
            >
              <Pressable
                onPress={() => handleSelectSort(sortColumn, 'DESC')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 6,
                  backgroundColor: sortOrder === 'DESC' ? colors.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: sortOrder === 'DESC' ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: 'bold',
                    fontSize: 13,
                  }}
                >
                  {rtl ? 'تنازلي (الأحدث / الأكبر)' : 'Descending'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSelectSort(sortColumn, 'ASC')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 6,
                  backgroundColor: sortOrder === 'ASC' ? colors.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: sortOrder === 'ASC' ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: 'bold',
                    fontSize: 13,
                  }}
                >
                  {rtl ? 'تصاعدي (الأقدم / الأصغر)' : 'Ascending'}
                </Text>
              </Pressable>
            </View>

            {/* Sort Column List */}
            <ScrollView style={{ maxHeight: 320 }}>
              {sortColumnLabels.map((item) => {
                const isSelected = sortColumn === item.col;
                return (
                  <Pressable
                    key={item.col}
                    onPress={() => handleSelectSort(item.col, sortOrder)}
                    style={[
                      styles.sortItemRow,
                      {
                        flexDirection: rtl ? 'row-reverse' : 'row',
                        backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isSelected ? colors.primary : colors.text,
                        fontWeight: isSelected ? 'bold' : 'normal',
                        fontSize: 14,
                        flex: 1,
                        textAlign: rtl ? 'right' : 'left',
                      }}
                    >
                      {rtl ? item.labelAr : item.labelEn}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name={sortOrder === 'DESC' ? 'arrow-down' : 'arrow-up'}
                        size={18}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Note Editor Modal */}
      <NoteEditorModal
        visible={editModalVisible}
        noteId={selectedNoteId}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedNoteId(null);
        }}
        onSaved={() => {
          loadCards(searchQuery, sortColumn, sortOrder);
        }}
      />

      {/* Bulk Reschedule Modal */}
      <BulkRescheduleModal
        visible={rescheduleModalVisible}
        selectedCardIds={Array.from(selectedIds)}
        onClose={() => setRescheduleModalVisible(false)}
        onSuccess={handleRescheduleSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  searchBar: {},
  chipsContainer: {},
  resultsHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemCard: {},
  itemRow: {
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
  },
  sortFieldText: {},
  metaRow: {
    alignItems: 'center',
  },
  badgeCol: {
    marginLeft: 8,
  },
  bulkBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bulkHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  studyPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkToolsRow: {
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bulkToolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  bulkToolIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bulkToolLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  footerLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tagModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  sortModalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalButtonsRow: {
    justifyContent: 'flex-end',
  },
  sortItemRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
