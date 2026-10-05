import { useFocusData } from '../../hooks/useFocusData';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { statsRepository, TodayStatsSummary } from '../../core/db/repositories/statsRepository';
import { queueBuilder } from '../../core/scheduler/queueBuilder';

export interface GlobalCounts {
  due: number;
  newCards: number;
  learn: number;
  total: number;
}

export interface HomeData {
  decks: DeckWithCounts[];
  lastStudiedDeck: DeckWithCounts | null;
  counts: GlobalCounts;
  today: TodayStatsSummary;
  remainingNewCards: number;
}

export const EMPTY_TODAY: TodayStatsSummary = {
  newDone: 0,
  reviewsDone: 0,
  totalDone: 0,
  dailyGoal: 20,
  timeMs: 0,
  streakCurrent: 1,
  streakLongest: 1,
  xpTotal: 0,
};

const INITIAL: HomeData = {
  decks: [],
  lastStudiedDeck: null,
  counts: { due: 0, newCards: 0, learn: 0, total: 0 },
  today: EMPTY_TODAY,
  remainingNewCards: 20,
};

export interface LearnTarget {
  deck: DeckWithCounts | null;
  newCount: number;
}

/**
 * "Learn Now" is scoped to the last studied deck so new cards from unrelated
 * decks don't get mixed; falls back to the first deck that has new cards.
 * Count is capped by the remaining daily new cards quota for today.
 */
export const pickLearnTarget = (data: HomeData): LearnTarget => {
  const deck =
    data.lastStudiedDeck ||
    data.decks.find((d) => d.new_count > 0 || (d.total_new_count || 0) > 0) ||
    data.decks[0] ||
    null;
  if (!deck) {
    const raw = data.counts.newCards;
    return { deck: null, newCount: Math.min(raw, data.remainingNewCards ?? raw) };
  }
  const rawCount = deck.has_subdecks ? deck.total_new_count ?? deck.new_count : deck.new_count;
  const newCount = Math.min(rawCount, data.remainingNewCards ?? rawCount);
  return { deck, newCount };
};

export const useHomeData = () =>
  useFocusData<HomeData>(
    async () => {
      const [decks, counts, today, lastStudiedDeck] = await Promise.all([
        deckRepository.getAllWithCounts(),
        cardRepository.getGlobalCounts(),
        statsRepository.getTodaySummary(),
        deckRepository.getLastStudiedDeckWithCounts(),
      ]);
      const targetDeckId =
        lastStudiedDeck?.id ||
        decks.find((d) => d.new_count > 0 || (d.total_new_count || 0) > 0)?.id ||
        decks[0]?.id;
      const { remaining } = await queueBuilder.getRemainingNewCardsToday(targetDeckId);
      return { decks, counts, today, lastStudiedDeck, remainingNewCards: remaining };
    },
    INITIAL,
    'home'
  );
