import { Card, CardState } from '../src/core/types/models';
import { Rating, DEFAULT_SCHEDULER_OPTIONS } from '../src/core/scheduler/types';
import { calculateSM2NextReview, previewSM2Intervals } from '../src/core/scheduler/sm2';
import { calculateFSRSNextReview } from '../src/core/scheduler/fsrs';
import { getRolloverDate, getDateStringForRollover, isDueToday } from '../src/core/scheduler/dayBoundary';

describe('Spaced Repetition Scheduler (SM-2 & FSRS)', () => {
  const baseCard: Card = {
    id: 'test_card_1',
    note_id: 'test_note_1',
    deck_id: 'test_deck_1',
    template_ord: 0,
    state: CardState.New,
    due: Date.now(),
    stability: 2.0,
    difficulty: 3.0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    ease_factor: 2.5,
    interval_days: 0,
    last_review: null,
    suspended: 0,
    buried_until: null,
    flag: 0,
    bookmarked: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  test('SM-2: Learning card step progression and graduation', () => {
    const now = 1700000000000;

    // 1. First review: Good -> moves to step 2 (10 min)
    const step1 = calculateSM2NextReview(baseCard, Rating.Good, DEFAULT_SCHEDULER_OPTIONS, now);
    expect(step1.cardState).toBe(CardState.Learning);
    expect(step1.due).toBe(now + 10 * 60 * 1000);
    expect(step1.buttonLabel).toBe('10m');

    // 2. Next review: Good again -> graduates to Review (1 day)
    const cardStep2 = { ...baseCard, state: CardState.Learning, reps: 1 };
    const step2 = calculateSM2NextReview(cardStep2, Rating.Good, DEFAULT_SCHEDULER_OPTIONS, now);
    expect(step2.cardState).toBe(CardState.Review);
    expect(step2.intervalDays).toBe(1);
    expect(step2.buttonLabel).toBe('1d');

    // 3. Easy immediately graduates with easyInterval (4 days)
    const easyStep = calculateSM2NextReview(baseCard, Rating.Easy, DEFAULT_SCHEDULER_OPTIONS, now);
    expect(easyStep.cardState).toBe(CardState.Review);
    expect(easyStep.intervalDays).toBe(4);
    expect(easyStep.buttonLabel).toBe('4d');
  });

  test('SM-2: Review card interval expansion and lapse handling', () => {
    const now = 1700000000000;
    const reviewCard: Card = {
      ...baseCard,
      state: CardState.Review,
      interval_days: 10,
      ease_factor: 2.5,
      reps: 4,
    };

    // Rating Good: 10 * 2.5 = 25 days
    const goodReview = calculateSM2NextReview(reviewCard, Rating.Good, DEFAULT_SCHEDULER_OPTIONS, now);
    expect(goodReview.intervalDays).toBe(25);
    expect(goodReview.cardState).toBe(CardState.Review);
    expect(goodReview.lapses).toBe(0);

    // Rating Again (Lapse): moves to Relearning, lapses = 1
    const lapseReview = calculateSM2NextReview(reviewCard, Rating.Again, DEFAULT_SCHEDULER_OPTIONS, now);
    expect(lapseReview.cardState).toBe(CardState.Relearning);
    expect(lapseReview.lapses).toBe(1);
    expect(lapseReview.due).toBe(now + 10 * 60 * 1000); // 10m relearn step
  });

  test('FSRS: Calculates valid stability, difficulty, and intervals', () => {
    const now = 1700000000000;

    const fsrsResult = calculateFSRSNextReview(baseCard, Rating.Good, DEFAULT_SCHEDULER_OPTIONS, now);
    expect(fsrsResult.stability).toBeGreaterThan(0);
    expect(fsrsResult.difficulty).toBeGreaterThanOrEqual(1);
    expect(fsrsResult.difficulty).toBeLessThanOrEqual(10);
    expect(fsrsResult.intervalDays).toBeGreaterThanOrEqual(1);
  });

  test('Day Boundary: Rollover hour (4:00 AM) handling', () => {
    // 2:30 AM on Oct 10th
    const earlyMorning = new Date(2026, 9, 10, 2, 30, 0, 0).getTime();
    const rolloverDate = getRolloverDate(earlyMorning, 4);

    // Should count as Oct 9th because it is before 4:00 AM
    expect(rolloverDate.getDate()).toBe(9);

    const dateStr = getDateStringForRollover(earlyMorning, 4);
    expect(dateStr).toBe('2026-10-09');

    // Due card at 3:00 AM on Oct 10 is considered due today
    const cardDueAt3am = new Date(2026, 9, 10, 3, 0, 0, 0).getTime();
    expect(isDueToday(cardDueAt3am, earlyMorning, 4)).toBe(true);
  });
});
