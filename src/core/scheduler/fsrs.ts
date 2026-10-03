import { Card, CardState } from '../types/models';
import {
  Rating,
  SchedulerOptions,
  DEFAULT_SCHEDULER_OPTIONS,
  SchedulingResult,
  RatingIntervalPreviews,
} from './types';
import { formatIntervalPreview } from './dayBoundary';

/**
 * Standard FSRS default parameter weights (w0 to w16)
 */
const FSRS_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 0.22695, 0.56995, 2.85535,
];

export function calculateFSRSNextReview(
  card: Card,
  rating: Rating,
  options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS,
  now: number = Date.now()
): SchedulingResult {
  const isNew = card.state === CardState.New || card.reps === 0;
  let stability = card.stability || 0;
  let difficulty = card.difficulty || 0;
  let nextState = card.state;
  let nextReps = card.reps + 1;
  let nextLapses = card.lapses;

  // Rating grade: 1 Again, 2 Hard, 3 Good, 4 Easy
  const grade = rating;

  if (isNew) {
    // Initial stability from w[grade - 1]
    stability = Math.max(0.1, FSRS_WEIGHTS[grade - 1] || 1.0);
    // Initial difficulty D0(G) = w4 - exp(w5 * (G - 1)) + 1
    difficulty = Math.min(10, Math.max(1, FSRS_WEIGHTS[4] - Math.exp(FSRS_WEIGHTS[5] * (grade - 1)) + 1));

    if (grade === Rating.Again) {
      nextState = CardState.Learning;
      const stepMin = options.learningSteps[0] || 1;
      return {
        cardState: nextState,
        due: now + stepMin * 60 * 1000,
        intervalDays: 0,
        easeFactor: card.ease_factor || 2.5,
        stability,
        difficulty,
        reps: 0,
        lapses: 0,
        buttonLabel: formatIntervalPreview({ type: 'm', value: stepMin }),
      };
    } else {
      nextState = CardState.Review;
    }
  } else {
    // Card already has stability and difficulty
    const elapsedDays = Math.max(0, (now - (card.last_review || card.created_at)) / (86400 * 1000));
    // Retrievability: R = (1 + FACTOR * t / S)^DECAY
    const retrievability = Math.pow(1 + (19 / 81) * (elapsedDays / Math.max(0.1, stability)), -0.5);

    // Update difficulty: D' = D - w6 * (G - 3)
    const nextD = difficulty - FSRS_WEIGHTS[6] * (grade - 3);
    // Mean reversion: D'' = w7 * D0(3) + (1 - w7) * nextD
    difficulty = Math.min(10, Math.max(1, FSRS_WEIGHTS[7] * FSRS_WEIGHTS[4] + (1 - FSRS_WEIGHTS[7]) * nextD));

    if (grade === Rating.Again) {
      // Memory lapse: S' = S_lapse
      nextLapses = card.lapses + 1;
      nextState = CardState.Relearning;
      stability = Math.max(
        0.1,
        FSRS_WEIGHTS[11] *
          Math.pow(difficulty, -FSRS_WEIGHTS[12]) *
          (Math.pow(stability + 1, FSRS_WEIGHTS[13]) - 1) *
          Math.exp((1 - retrievability) * FSRS_WEIGHTS[14])
      );
      const lapseStepMin = options.relearningSteps[0] || 10;
      return {
        cardState: nextState,
        due: now + lapseStepMin * 60 * 1000,
        intervalDays: 1,
        easeFactor: card.ease_factor || 2.5,
        stability,
        difficulty,
        reps: nextReps,
        lapses: nextLapses,
        buttonLabel: formatIntervalPreview({ type: 'm', value: lapseStepMin }),
      };
    } else {
      // Successful recall: S' = S_recall
      nextState = CardState.Review;
      const hardPenalty = grade === Rating.Hard ? FSRS_WEIGHTS[15] : 1.0;
      const easyBonus = grade === Rating.Easy ? FSRS_WEIGHTS[16] : 1.0;

      stability = Math.max(
        0.2,
        stability *
          (1 +
            Math.exp(FSRS_WEIGHTS[8]) *
              (11 - difficulty) *
              Math.pow(stability, -FSRS_WEIGHTS[9]) *
              (Math.exp((1 - retrievability) * FSRS_WEIGHTS[10]) - 1) *
              hardPenalty *
              easyBonus)
      );
    }
  }

  // Calculate interval I from stability and desired retention (default 0.9)
  const desiredR = Math.min(0.99, Math.max(0.7, options.desiredRetention || 0.9));
  // Interval equation: I = S * 9 * (1/R - 1)
  let intervalDays = Math.round(stability * 9 * (1 / desiredR - 1));
  intervalDays = Math.min(options.maximumInterval, Math.max(1, intervalDays));

  const nextDue = now + intervalDays * 86400 * 1000;

  return {
    cardState: nextState,
    due: nextDue,
    intervalDays,
    easeFactor: card.ease_factor || 2.5,
    stability,
    difficulty,
    reps: nextReps,
    lapses: nextLapses,
    buttonLabel: formatIntervalPreview({ type: 'd', value: intervalDays }),
  };
}

export function previewFSRSIntervals(
  card: Card,
  options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS,
  now: number = Date.now()
): RatingIntervalPreviews {
  return {
    [Rating.Again]: calculateFSRSNextReview(card, Rating.Again, options, now),
    [Rating.Hard]: calculateFSRSNextReview(card, Rating.Hard, options, now),
    [Rating.Good]: calculateFSRSNextReview(card, Rating.Good, options, now),
    [Rating.Easy]: calculateFSRSNextReview(card, Rating.Easy, options, now),
  };
}
