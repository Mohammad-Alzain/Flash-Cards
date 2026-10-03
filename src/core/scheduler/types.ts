import { Card, CardState } from '../types/models';

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface SchedulerOptions {
  algorithm: 'sm2' | 'fsrs';
  desiredRetention: number; // default 0.9 (for FSRS)
  learningSteps: number[]; // in minutes, e.g. [1, 10]
  relearningSteps: number[]; // in minutes, e.g. [10]
  graduatingInterval: number; // in days, e.g. 1
  easyInterval: number; // in days, e.g. 4
  startingEase: number; // e.g. 2.5
  easyBonus: number; // e.g. 1.3
  hardMultiplier: number; // e.g. 1.2
  intervalModifier: number; // e.g. 1.0
  maximumInterval: number; // in days, e.g. 36500
  rolloverHour: number; // 0-23, default 4 (4:00 AM)
}

export const DEFAULT_SCHEDULER_OPTIONS: SchedulerOptions = {
  algorithm: 'sm2',
  desiredRetention: 0.9,
  learningSteps: [1, 10], // 1 minute, 10 minutes
  relearningSteps: [10], // 10 minutes
  graduatingInterval: 1, // 1 day
  easyInterval: 4, // 4 days
  startingEase: 2.5,
  easyBonus: 1.3,
  hardMultiplier: 1.2,
  intervalModifier: 1.0,
  maximumInterval: 36500,
  rolloverHour: 4,
};

export interface SchedulingResult {
  cardState: CardState;
  due: number; // ms timestamp
  intervalDays: number;
  easeFactor: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  buttonLabel: string; // e.g. "1m", "10m", "1d", "4d"
}

export type RatingIntervalPreviews = Record<Rating, SchedulingResult>;
