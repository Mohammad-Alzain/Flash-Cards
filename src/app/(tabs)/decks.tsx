import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import {
  Screen,
  Header,
  Button,
  IconButton,
  SearchBar,
  EmptyState,
  TextField,
  BottomSheet,
  StatTile,
  Row,
} from '../../components/ui';
import { deckRepository, DeckTreeNode } from '../../core/db/repositories/deckRepository';
import { useFocusData } from '../../hooks/useFocusData';
import { DeckTreeItem } from '../../features/decks/components/DeckTreeItem';
import { filterDeckTree, defaultExpanded, sumTree } from '../../features/decks/deckTree';

export default function DecksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: tree, refreshing, refresh, reload } = useFocusData<DeckTreeNode[]>(
    () => deckRepository.getDeckTree(),
    [],
    'deck tree'
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Parent decks start expanded the first time the tree loads.
  useEffect(() => {
    setExpandedIds((prev) => (prev.size === 0 ? defaultExpanded(tree) : prev));
  }, [tree]);

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const closeSheet = () => {
    setSheetVisible(false);
    setName('');
    setDescription('');
  };

  const createDeck = async () => {
    if (!name.trim()) {
      CustomAlert.alert(t('common.warning'), t('decks.deck_name_placeholder'));
      return;
    }
    setCreating(true);
    try {
      await deckRepository.create(name.trim(), description.trim());
      closeSheet();
      await reload();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Failed to create deck');
    } finally {
      setCreating(false);
    }
  };

  const searching = query.trim().length > 0;
  const visible = filterDeckTree(tree, query);
  const totals = sumTree(tree);

  return (
    <Screen
      decor
      tabBarSpace
      refreshing={refreshing}
      onRefresh={refresh}
      header={
        <Header
          large
          title={t('decks.title')}
          subtitle={t('decks.subtitle')}
          icon="albums"
          iconTone="violet"
          rightElement={
            <>
              <IconButton icon="cloud-download-outline" onPress={() => router.push('/import')} accessibilityLabel={t('decks.import')} />
              <IconButton icon="add" variant="primary" onPress={() => setSheetVisible(true)} accessibilityLabel={t('decks.new_deck')} />
            </>
          }
        />
      }
      overlay={
        <BottomSheet
          visible={sheetVisible}
          onClose={closeSheet}
          title={t('decks.new_deck')}
          icon="layers"
          tone="violet"
          footer={
            <Row gap={10}>
              <Button title={t('common.cancel')} variant="ghost" onPress={closeSheet} style={{ flex: 1 }} />
              <Button title={t('decks.create')} icon="checkmark" loading={creating} onPress={createDeck} style={{ flex: 1 }} />
            </Row>
          }
        >
          <TextField
            label={t('decks.deck_name')}
            placeholder={t('decks.deck_name_placeholder')}
            value={name}
            onChangeText={setName}
            icon="text"
            autoFocus
          />
          <TextField
            label={t('decks.deck_desc')}
            placeholder={t('decks.deck_desc_placeholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={{ marginBottom: 0 }}
          />
        </BottomSheet>
      }
    >
      {tree.length > 0 && (
        <Row gap={8} align="stretch" style={{ marginBottom: 14 }}>
          <StatTile layout="compact" icon="albums" tone="violet" value={tree.length} label={t('decks.summary_decks')} />
          <StatTile layout="compact" icon="copy" tone="sky" value={totals.cards} label={t('decks.summary_cards')} />
          <StatTile layout="compact" icon="alarm" tone="green" value={totals.due} label={t('decks.summary_due')} />
        </Row>
      )}

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={t('decks.search_placeholder')}
        style={{ marginBottom: 16 }}
      />

      {visible.length === 0 ? (
        <EmptyState
          illustration={searching ? 'search' : 'empty-decks'}
          title={searching ? t('decks.no_match_title') : t('decks.empty_title')}
          description={searching ? t('decks.no_match_desc') : t('decks.empty_desc')}
          actionTitle={searching ? undefined : t('decks.new_deck')}
          actionIcon="add"
          onAction={searching ? undefined : () => setSheetVisible(true)}
          secondaryTitle={searching ? undefined : t('decks.import')}
          onSecondary={searching ? undefined : () => router.push('/import')}
        />
      ) : (
        visible.map((node) => (
          <DeckTreeItem
            key={node.id}
            node={node}
            expandedIds={expandedIds}
            forceExpanded={searching}
            onToggle={toggle}
            onOpen={(id) => router.push(`/decks/${id}`)}
          />
        ))
      )}
    </Screen>
  );
}
