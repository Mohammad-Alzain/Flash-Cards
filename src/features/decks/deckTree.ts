import type { DeckTreeNode } from '../../core/db/repositories/deckRepository';

/** Keeps nodes whose name matches, plus ancestors of matching descendants. */
export const filterDeckTree = (nodes: DeckTreeNode[], query: string): DeckTreeNode[] => {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const out: DeckTreeNode[] = [];
  for (const node of nodes) {
    const children = filterDeckTree(node.children, q);
    const selfMatches = node.name.toLowerCase().includes(q) || node.short_name.toLowerCase().includes(q);
    if (selfMatches || children.length > 0) out.push({ ...node, children });
  }
  return out;
};

/** Root decks with children start expanded. */
export const defaultExpanded = (tree: DeckTreeNode[]) =>
  new Set(tree.filter((n) => n.children?.length > 0).map((n) => n.id));

/** Aggregate counts for the whole collection (roots already include sub-decks). */
export const sumTree = (tree: DeckTreeNode[]) =>
  tree.reduce(
    (acc, n) => ({
      cards: acc.cards + (n.total_card_count ?? n.card_count),
      due: acc.due + (n.total_due_count ?? n.due_count),
      fresh: acc.fresh + (n.total_new_count ?? n.new_count),
    }),
    { cards: 0, due: 0, fresh: 0 }
  );
