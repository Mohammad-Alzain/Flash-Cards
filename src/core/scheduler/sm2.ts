import { Card, CardState } from '../types/models';
import {
  Rating,
  SchedulerOptions,
  DEFAULT_SCHEDULER_OPTIONS,
  SchedulingResult,
  RatingIntervalPreviews,
} from './types';
import { formatIntervalPreview } from './dayBoundary';

export function calculateSM2NextReview(
  card: Card,
  rating: Rating,
  options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS,
  now: number = Date.now()
): SchedulingResult {
  const isLearning = card.state === CardState.New || card.state === CardState.Learning;
  const isRelearning = card.state === CardState.Relearning;

  let nextState = card.state;
  let nextDue = now;
  let nextIntervalDays = card.interval_days || 0;
  let nextEase = card.ease_factor || options.startingEase;
  let nextReps = card.reps;
  let nextLapses = card.lapses;
  let previewLabel = '';

  const steps = isRelearning ? options.relearningSteps : options.learningSteps;

  if (isLearning || isRelearning) {
    // Current step index deduced from reps
    const currentStepIndex = Math.min(card.reps, steps.length - 1);

    if (rating === Rating.Again) {
      // Return to step 0
      const stepMin = steps[0] || 1;
      nextDue = now + stepMin * 60 * 1000;
      nextState = isRelearning ? CardState.Relearning : CardState.Learning;
      nextReps = 0;
      previewLabel = formatIntervalPreview({ type: 'm', value: stepMin });
    } else if (rating === Rating.Hard) {
      // Repeat current step or 1.5x current step
      const stepMin = steps[currentStepIndex] || 1;
      const hardMin = Math.max(1, Math.round(stepMin * 1.5));
      nextDue = now + hardMin * 60 * 1000;
      nextState = isRelearning ? CardState.Relearning : CardState.Learning;
      previewLabel = formatIntervalPreview({ type: 'm', value: hardMin });
    } else if (rating === Rating.Good) {
      if (currentStepIndex + 1 < steps.length) {
        // Advance to next learning step
        const nextStepMin = steps[currentStepIndex + 1];
        nextDue = now + nextStepMin * 60 * 1000;
        nextState = isRelearning ? CardState.Relearning : CardState.Learning;
        nextReps = currentStepIndex + 1;
        previewLabel = formatIntervalPreview({ type: 'm', value: nextStepMin });
      } else {
        // Graduate to Review!
        nextState = CardState.Review;
        nextIntervalDays = options.graduatingInterval;
        nextDue = now + nextIntervalDays * 86400 * 1000;
        nextReps = currentStepIndex + 1;
        previewLabel = formatIntervalPreview({ type: 'd', value: nextIntervalDays });
      }
    } else if (rating === Rating.Easy) {
      // Graduate immediately with easyInterval
      nextState = CardState.Review;
      nextIntervalDays = options.easyInterval;
      nextDue = now + nextIntervalDays * 86400 * 1000;
      nextReps = card.reps + 1;
      previewLabel = formatIntervalPreview({ type: 'd', value: nextIntervalDays });
    }
  } else {
    // Review card (CardState.Review)
    nextReps = card.reps + 1;
    const currentInterval = Math.max(1, card.interval_days || 1);

    if (rating === Rating.Again) {
      // Lapse
      nextLapses = card.lapses + 1;
      nextState = CardState.Relearning;
      nextEase = Math.max(1.3, nextEase - 0.2);
      nextIntervalDays = 1;
      const lapseStepMin = options.relearningSteps[0] || 10;
      nextDue = now + lapseStepMin * 60 * 1000;
      previewLabel = formatIntervalPreview({ type: 'm', value: lapseStepMin });
    } else if (rating === Rating.Hard) {
      nextEase = Math.max(1.3, nextEase - 0.15);
      nextIntervalDays = Math.max(
        currentInterval + 1,
        Math.round(currentInterval * options.hardMultiplier)
      );
      nextDue = now + nextIntervalDays * 86400 * 1000;
      previewLabel = formatIntervalPreview({ type: 'd', value: nextIntervalDays });
    } else if (rating === Rating.Good) {
      // Standard interval increase
      nextIntervalDays = Math.round(
        currentInterval * nextEase * options.intervalModifier
      );
      nextIntervalDays = Math.min(options.maximumInterval, Math.max(currentInterval + 1, nextIntervalDays));
      nextDue = now + nextIntervalDays * 86400 * 1000;
      previewLabel = formatIntervalPreview({ type: 'd', value: nextIntervalDays });
    } else if (rating === Rating.Easy) {
      // Easy bonus and ease increase
      nextEase = nextEase + 0.15;
      nextIntervalDays = Math.round(
        currentInterval * nextEase * options.easyBonus * options.intervalModifier
      );
      nextIntervalDays = Math.min(options.maximumInterval, Math.max(currentInterval + 2, nextIntervalDays));
      nextDue = now + nextIntervalDays * 86400 * 1000;
      previewLabel = formatIntervalPreview({ type: 'd', value: nextIntervalDays });
    }
  }

  return {
    cardState: nextState,
    due: nextDue,
    intervalDays: nextIntervalDays,
    easeFactor: nextEase,
    stability: card.stability || 2.0,
    difficulty: card.difficulty || 3.0,
    reps: nextReps,
    lapses: nextLapses,
    buttonLabel: previewLabel,
  };
}

export function previewSM2Intervals(
  card: Card,
  options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS,
  now: number = Date.now()
): RatingIntervalPreviews {
  return {
    [Rating.Again]: calculateSM2NextReview(card, Rating.Again, options, now),
    [Rating.Hard]: calculateSM2NextReview(card, Rating.Hard, options, now),
    [Rating.Good]: calculateSM2NextReview(card, Rating.Good, options, now),
    [Rating.Easy]: calculateSM2NextReview(card, Rating.Easy, options, now),
  };
}
