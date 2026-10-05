import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import {
  browserRepository,
  BrowserCardItem,
  BrowserSortColumn,
  BrowserSortOrder,
  BulkRescheduleResult,
} from '../../core/db/repositories/browserRepository';

const PAGE_SIZE = 50;
/** "+ Select N" quick batch size. */
export const SELECT_BATCH = 20;

/** Toggles a search token in/out of the query string. */
export const toggleToken = (query: string, token: string) =>
  query.includes(token) ? query.replace(token, '').replace(/\s+/g, ' ').trim() : `${query} ${token}`.trim();

export const useCardBrowser = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string; deckName?: string; deckId?: string }>();
  const initialQuery = params.query || (params.deckName ? `deck:"${params.deckName}"` : '');

  const [cards, setCards] = useState<BrowserCardItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortColumn, setSortColumn] = useState<BrowserSortColumn>('created_at');
  const [sortOrder, setSortOrder] = useState<BrowserSortOrder>('DESC');
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (params.query) setQuery(params.query);
    else if (params.deckName) setQuery(`deck:"${params.deckName}"`);
  }, [params.query, params.deckName]);

  const load = useCallback(
    async (q: string = query, col: BrowserSortColumn = sortColumn, ord: BrowserSortOrder = sortOrder) => {
      setLoading(true);
      try {
        const [count, results] = await Promise.all([
          browserRepository.countCards(q),
          browserRepository.searchCards(q, PAGE_SIZE, 0, col, ord),
        ]);
        setTotalCount(count);
        setCards(results);
      } catch (e) {
        console.error('Failed to search cards:', e);
      } finally {
        setLoading(false);
      }
    },
    [query, sortColumn, sortOrder]
  );

  useFocusEffect(
    useCallback(() => {
      load(query, sortColumn, sortOrder);
    }, [load, query, sortColumn, sortOrder])
  );

  const loadMore = async () => {
    if (loading || loadingMore || cards.length >= totalCount) return;
    setLoadingMore(true);
    try {
      const next = await browserRepository.searchCards(query, PAGE_SIZE, cards.length, sortColumn, sortOrder);
      if (next.length > 0) setCards((prev) => [...prev, ...next]);
    } catch (e) {
      console.error('Failed to load more cards:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleMultiSelect = () => {
    setMultiSelect((m) => !m);
    setSelectedIds(new Set());
  };

  const selectAllLoaded = () =>
    setSelectedIds(selectedIds.size === cards.length ? new Set() : new Set(cards.map((c) => c.id)));

  const selectNextBatch = (batch = SELECT_BATCH) => {
    setMultiSelect(true);
    const next = new Set(selectedIds);
    let added = 0;
    for (const card of cards) {
      if (!next.has(card.id)) {
        next.add(card.id);
        if (++added >= batch) break;
      }
    }
    setSelectedIds(next);
  };

  const finishBulk = async () => {
    setSelectedIds(new Set());
    setMultiSelect(false);
    await load();
  };

  const ids = () => Array.from(selectedIds);

  const studySelected = () => {
    if (selectedIds.size === 0) return;
    router.push(`/study/review?cardIds=${ids().join(',')}`);
  };

  const markStudied = async () => {
    if (selectedIds.size === 0) return;
    await browserRepository.bulkMarkStudied(ids());
    CustomAlert.alert(t('common.done'), t('browser.marked_studied', { count: selectedIds.size }));
    await finishBulk();
  };

  const suspend = async () => {
    if (selectedIds.size === 0) return;
    await browserRepository.bulkSetSuspended(ids(), true);
    CustomAlert.alert(t('common.done'), t('browser.suspended_msg', { count: selectedIds.size }));
    await finishBulk();
  };

  const resetProgress = async () => {
    if (selectedIds.size === 0) return;
    await browserRepository.bulkResetProgress(ids());
    CustomAlert.alert(t('common.done'), t('browser.reset_msg', { count: selectedIds.size }));
    await finishBulk();
  };

  const remove = () => {
    if (selectedIds.size === 0) return;
    const list = ids();
    CustomAlert.alert(t('common.delete'), t('browser.delete_confirm', { count: list.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await browserRepository.bulkDeleteCards(list);
          await finishBulk();
        },
      },
    ]);
  };

  /** Returns true when the tag sheet can close. */
  const addTag = async (tag: string) => {
    if (!tag.trim() || selectedIds.size === 0) return false;
    try {
      const count = await browserRepository.bulkAddTags(ids(), tag.trim());
      CustomAlert.alert(t('common.done'), t('browser.tag_added', { count }));
      await load();
      return true;
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e?.message || t('browser.tag_failed'));
      return false;
    }
  };

  const onRescheduled = (result: BulkRescheduleResult) => {
    CustomAlert.alert(t('common.done'), t('browser.rescheduled_msg', { count: result.updatedCount }));
    finishBulk();
  };

  const setSort = (col: BrowserSortColumn, ord: BrowserSortOrder) => {
    setSortColumn(col);
    setSortOrder(ord);
    load(query, col, ord);
  };

  return {
    cards,
    totalCount,
    query,
    setQuery,
    applyToken: (token: string) => setQuery((q) => toggleToken(q, token)),
    loading,
    loadingMore,
    loadMore,
    reload: load,
    sortColumn,
    sortOrder,
    setSort,
    multiSelect,
    toggleMultiSelect,
    selectedIds,
    toggleSelect,
    selectAllLoaded,
    selectNextBatch,
    studySelected,
    markStudied,
    suspend,
    resetProgress,
    remove,
    addTag,
    onRescheduled,
  };
};
