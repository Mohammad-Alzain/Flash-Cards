import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import {
  Card,
  Button,
  Badge,
  TextField,
  EmptyState,
  Header,
  ProgressBar,
} from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import {
  deckRepository,
  DeckWithCounts,
  DeckTreeNode,
} from '../../core/db/repositories/deckRepository';

const DECK_ACCENT_COLORS = [
  '#4F46E5',
  '#8B5CF6',
  '#0EA5E9',
  '#F59E0B',
  '#EF4444',
  '#10B981',
];

export default function DecksScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [deckTree, setDeckTree] = useState<DeckTreeNode[]>([]);
  const [expandedDeckIds, setExpandedDeckIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Create Deck Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const loadDecks = useCallback(async () => {
    try {
      const tree = await deckRepository.getDeckTree();
      setDeckTree(tree);

      // Auto-expand all parent decks that have children by default
      const parentIds = new Set<string>();
      tree.forEach((node) => {
        if (node.children && node.children.length > 0) {
          parentIds.add(node.id);
        }
      });
      setExpandedDeckIds((prev) => (prev.size === 0 ? parentIds : prev));
    } catch (e) {
      console.error('Failed to load deck tree:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDecks();
    }, [loadDecks])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDecks();
    setRefreshing(false);
  };

  const toggleExpand = (deckId: string) => {
    setExpandedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) {
        next.delete(deckId);
      } else {
        next.add(deckId);
      }
      return next;
    });
  };

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      CustomAlert.alert(t('common.warning'), t('decks.deck_name_placeholder'));
      return;
    }
    setCreating(true);
    try {
      await deckRepository.create(newDeckName.trim(), newDeckDesc.trim());
      setNewDeckName('');
      setNewDeckDesc('');
      setModalVisible(false);
      await loadDecks();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Failed to create deck');
    } finally {
      setCreating(false);
    }
  };

  // Filter tree nodes recursively based on search query
  const filterTree = (nodes: DeckTreeNode[], query: string): DeckTreeNode[] => {
    if (!query.trim()) return nodes;
    const lowerQ = query.toLowerCase();

    const filtered: DeckTreeNode[] = [];
    nodes.forEach((node) => {
      const selfMatches =
        node.name.toLowerCase().includes(lowerQ) ||
        node.short_name.toLowerCase().includes(lowerQ);
      const filteredChildren = filterTree(node.children, query);

      if (selfMatches || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
        });
      }
    });
    return filtered;
  };

  const visibleTree = filterTree(deckTree, searchQuery);

  const getAccentColor = (node: DeckTreeNode): string =>
    DECK_ACCENT_COLORS[Math.abs(node.name.charCodeAt(0)) % DECK_ACCENT_COLORS.length];

  const renderDeckNode = (node: DeckTreeNode, isChild = false, parentAccent?: string) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedDeckIds.has(node.id) || searchQuery.trim().length > 0;

    const displayCardCount = node.total_card_count ?? node.card_count;
    const displayNewCount = node.total_new_count ?? node.new_count;
    const displayLearnCount = node.total_learn_count ?? node.learn_count;
    const displayDueCount = node.total_due_count ?? node.due_count;

    const accentColor = isChild
      ? (parentAccent ?? getAccentColor(node))
      : getAccentColor(node);

    const progressRatio =
      displayCardCount > 0 ? Math.min(1, displayDueCount / displayCardCount) : 0;

    return (
      <View
        key={node.id}
        style={{
          marginBottom: isChild ? spacing.xs : spacing.sm,
          marginLeft: isChild && !rtl ? 20 : 0,
          marginRight: isChild && rtl ? 20 : 0,
        }}
      >
        <Pressable
          onPress={() => router.push(`/decks/${node.id}`)}
          style={({ pressed }) => [
            styles.deckCard,
            {
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
              overflow: 'hidden',
            },
          ]}
        >
          {/* Colored Accent Strip */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: rtl ? undefined : 0,
              right: rtl ? 0 : undefined,
              width: isChild ? 3 : 4,
              backgroundColor: accentColor,
            }}
          />

          <View
            style={{
              paddingLeft: rtl ? (isChild ? 12 : 14) : (isChild ? 14 : 16),
              paddingRight: rtl ? (isChild ? 14 : 16) : (isChild ? 12 : 14),
              paddingVertical: isChild ? 10 : 14,
            }}
          >
            {/* Header row: name + chevron */}
            <View
              style={[
                styles.deckHeaderRow,
                { flexDirection: rtl ? 'row-reverse' : 'row' },
              ]}
            >
              <Text
                style={[
                  styles.deckTitle,
                  {
                    color: colors.text,
                    fontSize: isChild ? typography.sizes.md : typography.sizes.lg,
                    fontWeight: isChild
                      ? typography.weights.semibold
                      : typography.weights.extrabold,
                    textAlign: rtl ? 'right' : 'left',
                    flex: 1,
                  },
                ]}
                numberOfLines={1}
              >
                {isChild ? node.short_name : node.name}
              </Text>

              {/* Accordion chevron */}
              {hasChildren && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleExpand(node.id);
                  }}
                  style={{
                    padding: 4,
                    marginLeft: rtl ? 0 : 8,
                    marginRight: rtl ? 8 : 0,
                  }}
                  hitSlop={8}
                >
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={accentColor}
                  />
                </Pressable>
              )}
            </View>

            {/* Progress bar */}
            <ProgressBar
              progress={progressRatio}
              color={accentColor}
              height={isChild ? 3 : 4}
              style={{ marginTop: isChild ? 8 : 10, marginBottom: isChild ? 8 : 10 }}
            />

            {/* Chips row: new / learning / due */}
            <View
              style={[
                styles.chipsRow,
                { flexDirection: rtl ? 'row-reverse' : 'row' },
              ]}
            >
              {/* New chip */}
              <View
                style={[
                  styles.chip,
                  { backgroundColor: '#3B82F615', borderColor: '#3B82F640' },
                ]}
              >
                <Text style={[styles.chipText, { color: '#3B82F6' }]}>
                  {t('decks.new_badge', { count: displayNewCount })}
                </Text>
              </View>

              {/* Learning chip */}
              <View
                style={[
                  styles.chip,
                  {
                    backgroundColor: '#F59E0B15',
                    borderColor: '#F59E0B40',
                    marginLeft: rtl ? 0 : 6,
                    marginRight: rtl ? 6 : 0,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: '#F59E0B' }]}>
                  {t('decks.learn_badge', { count: displayLearnCount })}
                </Text>
              </View>

              {/* Due chip */}
              <View
                style={[
                  styles.chip,
                  {
                    backgroundColor: '#10B98115',
                    borderColor: '#10B98140',
                    marginLeft: rtl ? 0 : 6,
                    marginRight: rtl ? 6 : 0,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: '#10B981' }]}>
                  {t('decks.due_badge', { count: displayDueCount })}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Accordion Sub-Decks Rendering */}
        {hasChildren && isExpanded && (
          <View style={{ marginTop: 4 }}>
            {node.children.map((child) => renderDeckNode(child, true, accentColor))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <Header
        title={t('decks.title')}
        rightElement={
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <Button
              title=""
              icon={<Ionicons name="cloud-download-outline" size={20} color={colors.primary} />}
              variant="ghost"
              size="sm"
              onPress={() => router.push('/import')}
              style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
            />
            <Button
              title={`+ ${t('decks.new_deck')}`}
              variant="primary"
              size="sm"
              onPress={() => setModalVisible(true)}
            />
          </View>
        }
      />

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            paddingHorizontal: spacing.lg,
            marginTop: spacing.sm,
            marginBottom: spacing.xs,
          },
        ]}
      >
        <View
          style={[
            styles.searchInner,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              flexDirection: rtl ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textMuted}
            style={{
              marginLeft: rtl ? 0 : 12,
              marginRight: rtl ? 12 : 0,
            }}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('decks.search_placeholder')}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.searchInput,
              {
                color: colors.text,
                fontSize: typography.sizes.sm,
                textAlign: rtl ? 'right' : 'left',
                flex: 1,
              },
            ]}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              style={{
                marginRight: rtl ? 0 : 10,
                marginLeft: rtl ? 10 : 0,
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {visibleTree.length === 0 ? (
          <EmptyState
            illustration={searchQuery.trim().length > 0 ? 'search' : 'study'}
            title={
              searchQuery.trim().length > 0
                ? (rtl ? 'لا توجد رزم مطابقة' : 'No matching decks')
                : t('decks.empty_title')
            }
            description={
              searchQuery.trim().length > 0
                ? (rtl ? 'تأكد من كتابة الاسم بشكل صحيح أو امسح البحث' : 'Check spelling or clear the search query')
                : t('decks.empty_desc')
            }
            actionTitle={searchQuery.trim().length > 0 ? undefined : `+ ${t('decks.new_deck')}`}
            onAction={searchQuery.trim().length > 0 ? undefined : () => setModalVisible(true)}
          />
        ) : (
          visibleTree.map((rootNode) => renderDeckNode(rootNode, false))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Create Deck Modal — bottom sheet style */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        />
        <View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: colors.surfaceRaised,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
            },
          ]}
        >
          {/* Drag handle */}
          <View
            style={[styles.sheetHandle, { backgroundColor: colors.border }]}
          />

          <Text
            style={[
              styles.sheetTitle,
              {
                color: colors.text,
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.extrabold,
                textAlign: rtl ? 'right' : 'left',
                marginBottom: spacing.lg,
              },
            ]}
          >
            {t('decks.new_deck')}
          </Text>

          <TextField
            label={t('decks.deck_name_label')}
            placeholder={t('decks.deck_name_placeholder')}
            value={newDeckName}
            onChangeText={setNewDeckName}
            autoFocus
          />

          <TextField
            label={t('decks.deck_desc_label')}
            placeholder={t('decks.deck_desc_placeholder')}
            value={newDeckDesc}
            onChangeText={setNewDeckDesc}
            multiline
            numberOfLines={3}
          />

          <View
            style={[
              styles.sheetActions,
              {
                flexDirection: rtl ? 'row-reverse' : 'row',
                marginTop: spacing.lg,
              },
            ]}
          >
            <Button
              title={t('common.cancel')}
              variant="ghost"
              size="md"
              onPress={() => setModalVisible(false)}
              style={{
                flex: 1,
                marginRight: rtl ? 0 : spacing.sm,
                marginLeft: rtl ? spacing.sm : 0,
              }}
            />
            <Button
              title={t('common.save')}
              variant="primary"
              size="md"
              loading={creating}
              onPress={handleCreateDeck}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  searchContainer: {},
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 44,
  },
  searchInput: {
    paddingVertical: 0,
    height: 44,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  deckCard: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  deckHeaderRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deckTitle: {},
  chipsRow: {
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bottomSheet: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {},
  sheetActions: {
    justifyContent: 'flex-end',
  },
});
