import { getDatabase } from '../connection';
import { settingsRepository } from './settingsRepository';

export interface TodayStatsSummary {
  newDone: number;
  reviewsDone: number;
  totalDone: number;
  dailyGoal: number;
  timeMs: number;
  streakCurrent: number;
  streakLongest: number;
  xpTotal: number;
}

export const statsRepository = {
  async getTodaySummary(): Promise<TodayStatsSummary> {
    const db = await getDatabase();
    const todayStr = new Date().toISOString().split('T')[0];

    const row = await db.getFirstAsync<any>(
      `SELECT 
         SUM(new_done) as new_done,
         SUM(reviews_done) as reviews_done,
         SUM(time_ms) as time_ms
       FROM daily_stats
       WHERE date = ?;`,
      todayStr
    );

    const goalStr = await settingsRepository.get('daily_goal', '20');
    const xpStr = await settingsRepository.get('xp_total', '120');
    const streakCurrentStr = await settingsRepository.get('streak_current', '3');
    const streakLongestStr = await settingsRepository.get('streak_longest', '7');

    const newDone = Number(row?.new_done || 0);
    const reviewsDone = Number(row?.reviews_done || 0);

    return {
      newDone,
      reviewsDone,
      totalDone: newDone + reviewsDone,
      dailyGoal: Number(goalStr) || 20,
      timeMs: Number(row?.time_ms || 0),
      streakCurrent: Number(streakCurrentStr) || 1,
      streakLongest: Number(streakLongestStr) || 1,
      xpTotal: Number(xpStr) || 0,
    };
  },
};
