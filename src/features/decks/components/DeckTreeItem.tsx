import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection, toneForKey, ToneName } from '../../../theme';
import { AppText, Row, IconTile, IconButton, PressableScale, ProgressBar } from '../../../components/ui';
import type { DeckTreeNode } from '../../../core/db/repositories/deckRepository';
import { DeckCountPills } from './DeckCountPills';
import { deckSeenRatio } from './DeckTile';

interface DeckTreeItemProps {
  node: DeckTreeNode;
  expandedIds: Set<string>;
  forceExpanded: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  depth?: number;
  parentTone?: ToneName;
}

/** Recursive deck row: root decks are cards, sub-decks nest under a guide line. */
export const DeckTreeItem: React.FC<DeckTreeItemProps> = ({
  node,
  expandedIds,
  forceExpanded,
  onToggle,
  onOpen,
  depth = 0,
  parentTone,
}) => {
  const { colors, shape, shadow, tone } = useTheme();
  const dir = useDirection();
  const { t } = useTranslation();
  const isChild = depth > 0;
  const hasChildren = node.children?.length > 0;
  const expanded = forceExpanded || expandedIds.has(node.id);
  const toneName = parentTone ?? toneForKey(node.id);
  const toneColor = tone(toneName).fg;
  const total = node.total_card_count ?? node.card_count;

  return (
    <View style={{ marginBottom: isChild ? 8 : 12 }}>
      <PressableScale
        onPress={() => onOpen(node.id)}
        activeScale={0.985}
        accessibilityRole="button"
        accessibilityLabel={node.name}
        style={[
          {
            backgroundColor: colors.surfaceRaised,
            borderRadius: isChild ? 18 : shape.card,
            borderWidth: 1,
            borderColor: colors.border,
            padding: isChild ? 12 : 14,
          },
          isChild ? null : shadow(1),
        ]}
      >
        <Row gap={12}>
          <IconTile
            icon={hasChildren ? 'folder-open' : isChild ? 'document-text' : 'layers'}
            tone={toneName}
            size={isChild ? 36 : 46}
            variant={isChild ? 'soft' : 'solid'}
          />
          <View style={{ flex: 1 }}>
            <AppText variant={isChild ? 'title' : 'h3'} weight="extrabold" numberOfLines={1}>
              {isChild ? node.short_name : node.name}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {t('decks.cards_badge', { count: total })}
              {hasChildren ? ` · ${t('decks.subdecks_count', { count: node.children.length })}` : ''}
            </AppText>
          </View>
          {hasChildren && (
            <IconButton
              icon={expanded ? 'chevron-up' : 'chevron-down'}
              onPress={() => onToggle(node.id)}
              variant="tinted"
              size={34}
              color={toneColor}
              accessibilityLabel={expanded ? t('decks.collapse') : t('decks.expand')}
            />
          )}
        </Row>

        <ProgressBar
          progress={deckSeenRatio(total, node.total_new_count ?? node.new_count)}
          color={toneColor}
          height={isChild ? 5 : 6}
          style={{ marginTop: 12, marginBottom: 10 }}
        />
        <DeckCountPills
          newCount={node.total_new_count ?? node.new_count}
          learnCount={node.total_learn_count ?? node.learn_count}
          dueCount={node.total_due_count ?? node.due_count}
        />
      </PressableScale>

      {hasChildren && expanded && (
        <View
          style={[
            { marginTop: 8 },
            dir.ms(14),
            dir.ps(12),
            dir.rtl
              ? { borderRightWidth: 2, borderRightColor: tone(toneName).border }
              : { borderLeftWidth: 2, borderLeftColor: tone(toneName).border },
          ]}
        >
          {node.children.map((child) => (
            <DeckTreeItem
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              forceExpanded={forceExpanded}
              onToggle={onToggle}
              onOpen={onOpen}
              depth={depth + 1}
              parentTone={toneName}
            />
          ))}
        </View>
      )}
    </View>
  );
};
