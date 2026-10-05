import React, { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection } from '../../theme';
import { Header, IconButton, Button, SearchBar, AppText, Row, EmptyState, Chip, IconName } from '../../components/ui';
import { NoteEditorModal } from '../../components/card/NoteEditorModal';
import { BulkRescheduleModal } from '../../components/browser/BulkRescheduleModal';
import { useCardBrowser, SELECT_BATCH } from '../../features/browser/useCardBrowser';
import { BrowserCardRow, BulkActionBar, SortSheet, TagSheet } from '../../features/browser/components/BrowserParts';
import type { BrowserCardItem } from '../../core/db/repositories/browserRepository';

const FILTERS: { token: string; key: string; icon: IconName }[] = [
  { token: 'is:studied', key: 'f_studied', icon: 'checkmark-done' },
  { token: 'is:due', key: 'f_due', icon: 'alarm' },
  { token: 'is:new', key: 'f_new', icon: 'sparkles' },
  { token: 'is:suspended', key: 'f_suspended', icon: 'pause' },
  { token: 'prop:lapses>1', key: 'f_lapses', icon: 'bug' },
  { token: 'is:buried', key: 'f_buried', icon: 'moon' },
  { token: 'flag:1', key: 'f_flagged', icon: 'flag' },
];

export default function CardBrowserScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const b = useCardBrowser();

  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [sortVisible, setSortVisible] = useState(false);
  const [tagVisible, setTagVisible] = useState(false);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);

  const openEdit = useCallback((noteId: string) => setEditNoteId(noteId), []);
  const renderItem = useCallback(
    ({ item }: { item: BrowserCardItem }) => (
      <BrowserCardRow
        item={item}
        selected={b.selectedIds.has(item.id)}
        multiSelect={b.multiSelect}
        onToggleSelect={b.toggleSelect}
        onOpenEdit={openEdit}
      />
    ),
    [b.selectedIds, b.multiSelect, b.toggleSelect, openEdit]
  );

  const showBulkBar = b.multiSelect && b.selectedIds.size > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <Header
        title={t('browser.title')}
        icon="search"
        iconTone="sky"
        onBack={() => router.back()}
        rightElement={
          <>
            <IconButton icon="swap-vertical" onPress={() => setSortVisible(true)} accessibilityLabel={t('browser.sort')} />
            <IconButton icon="construct" onPress={() => router.push('/tools')} accessibilityLabel={t('browser.tools')} />
            <Button
              title={b.multiSelect ? t('browser.done') : t('browser.select')}
              icon={b.multiSelect ? 'checkmark' : 'checkbox-outline'}
              variant={b.multiSelect ? 'primary' : 'ghost'}
              size="sm"
              onPress={b.toggleMultiSelect}
            />
          </>
        }
      />

      <View style={{ paddingHorizontal: 16 }}>
        <SearchBar value={b.query} onChangeText={b.setQuery} placeholder={t('browser.search_placeholder')} autoCapitalize="none" style={{ marginBottom: 10 }} />
        <FilterChips query={b.query} onToggle={b.applyToken} />
        <Row justify="space-between" style={{ marginVertical: 6 }}>
          <AppText variant="bodySm" weight="bold" color="textSecondary" style={{ flex: 1 }}>
            {b.selectedIds.size > 0
              ? t('browser.selected_of', { count: b.selectedIds.size, total: b.totalCount })
              : t('browser.showing_of', { count: b.cards.length, total: b.totalCount })}
          </AppText>
          <Row gap={10}>
            <Chip label={t('browser.select_20')} icon="add-circle" onPress={() => b.selectNextBatch(SELECT_BATCH)} />
            {b.multiSelect && (
              <Pressable onPress={b.selectAllLoaded} hitSlop={8}>
                <AppText variant="bodySm" weight="extrabold" color="primary">
                  {b.selectedIds.size === b.cards.length ? t('browser.deselect_all') : t('browser.select_loaded')}
                </AppText>
              </Pressable>
            )}
          </Row>
        </Row>
      </View>

      {b.loading && b.cards.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="bodySm" color="textSecondary" style={{ marginTop: 10 }}>
            {t('browser.loading')}
          </AppText>
        </View>
      ) : (
        <FlatList
          data={b.cards}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          extraData={b.selectedIds}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          onEndReached={b.loadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: showBulkBar ? 190 : 60 }}
          ListFooterComponent={
            b.loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
                <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                  {t('browser.loading_more')}
                </AppText>
              </View>
            ) : !b.loading && b.cards.length > 0 && b.cards.length >= b.totalCount ? (
              <AppText variant="caption" color="textMuted" align="center" style={{ paddingVertical: 16 }}>
                {t('browser.all_loaded')}
              </AppText>
            ) : null
          }
          ListEmptyComponent={<EmptyState compact illustration="search" title={t('browser.empty_title')} description={t('browser.empty_desc')} />}
        />
      )}

      {showBulkBar && (
        <BulkActionBar
          count={b.selectedIds.size}
          onStudy={b.studySelected}
          actions={[
            { key: 'tag', icon: 'pricetag', tone: 'green', label: t('browser.a_tag'), onPress: () => setTagVisible(true) },
            { key: 'studied', icon: 'checkmark-done', tone: 'teal', label: t('browser.a_studied'), onPress: b.markStudied },
            { key: 'reschedule', icon: 'calendar', tone: 'indigo', label: t('browser.a_reschedule'), onPress: () => setRescheduleVisible(true) },
            { key: 'suspend', icon: 'pause-circle', tone: 'amber', label: t('browser.a_suspend'), onPress: b.suspend },
            { key: 'reset', icon: 'refresh', tone: 'slate', label: t('browser.a_reset'), onPress: b.resetProgress },
            { key: 'delete', icon: 'trash', tone: 'rose', label: t('browser.a_delete'), onPress: b.remove, destructive: true },
          ]}
        />
      )}

      <SortSheet visible={sortVisible} onClose={() => setSortVisible(false)} column={b.sortColumn} order={b.sortOrder} onChange={b.setSort} />
      <TagSheet visible={tagVisible} count={b.selectedIds.size} onClose={() => setTagVisible(false)} onApply={b.addTag} />
      <NoteEditorModal visible={editNoteId !== null} noteId={editNoteId} onClose={() => setEditNoteId(null)} onSaved={() => b.reload()} />
      <BulkRescheduleModal
        visible={rescheduleVisible}
        selectedCardIds={Array.from(b.selectedIds)}
        onClose={() => setRescheduleVisible(false)}
        onSuccess={b.onRescheduled}
      />
    </SafeAreaView>
  );
}

/** Quick filters: each chip toggles a search token in the query. */
function FilterChips({ query, onToggle }: { query: string; onToggle: (token: string) => void }) {
  const { t } = useTranslation();
  const dir = useDirection();
  return (
    <FlatList
      horizontal
      inverted={dir.rtl}
      data={FILTERS}
      keyExtractor={(f) => f.token}
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -16, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
      renderItem={({ item }) => (
        <Chip label={t(`browser.${item.key}`)} icon={item.icon} selected={query.includes(item.token)} onPress={() => onToggle(item.token)} />
      )}
    />
  );
}
