import { useCallback, useEffect, useState } from 'react';
import { useFocusData } from '../../hooks/useFocusData';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { queueBuilder } from '../../core/scheduler/queueBuilder';
import { browserRepository, BrowserCardItem } from '../../core/db/repositories/browserRepository';

/** Max cards previewed in the deck's Cards tab (the full browser handles the rest). */
const CARD_PREVIEW_LIMIT = 40;

interface DeckDetail {
  deck: DeckWithCounts | null;
  studiedCount: number;
  remainingNewCards: number;
}

/** Loads a deck with its counts on focus and remembers it as the last studied deck. */
export const useDeckDetail = (id: string | undefined) =>
  useFocusData<DeckDetail>(
    async () => {
      if (!id) return { deck: null, studiedCount: 0, remainingNewCards: 0 };
      const all = await deckRepository.getAllWithCounts();
      const deck = all.find((d) => d.id === id) ?? null;
      if (!deck) return { deck: null, studiedCount: 0, remainingNewCards: 0 };
      const [studiedCount, { remaining }] = await Promise.all([
        queueBuilder.getStudiedCardsCount(deck.id),
        queueBuilder.getRemainingNewCardsToday(deck.id),
      ]);
      deckRepository.setLastStudiedDeckId(deck.id).catch(() => {});
      return { deck, studiedCount, remainingNewCards: remaining };
    },
    { deck: null, studiedCount: 0, remainingNewCards: 0 },
    'deck'
  );

/** Card preview list for the deck's Cards tab, re-queried as the search changes. */
export const useDeckCards = (deck: DeckWithCounts | null, enabled: boolean, search: string) => {
  const [cards, setCards] = useState<BrowserCardItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!deck) return;
    setLoading(true);
    try {
      const q = `deck:"${deck.name}" ${search}`.trim();
      setCards(await browserRepository.searchCards(q, CARD_PREVIEW_LIMIT, 0, 'created_at', 'DESC'));
    } catch (e) {
      console.error('Failed to load deck cards:', e);
    } finally {
      setLoading(false);
    }
  }, [deck, search]);

  useEffect(() => {
    if (enabled && deck) load();
  }, [enabled, deck, load]);

  return { cards, loading, reload: load };
};

/** Share of the deck's cards scheduled in the future (i.e. currently mastered). */
export const masteryRatio = (deck: DeckWithCounts) =>
  deck.card_count > 0 ? (deck.future_count || 0) / deck.card_count : 0;
