import { getDatabase } from '../connection';
import { settingsRepository } from './settingsRepository';
import { getDateStringForRollover } from '../../scheduler/dayBoundary';

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

export interface DayActivityItem {
  date: string; // YYYY-MM-DD
  dayNameEn: string;
  dayNameAr: string;
  count: number;
  isToday: boolean;
}

export interface CardMaturityBreakdown {
  newCards: number;
  learning: number;
  mature: number;
  leeches: number;
  total: number;
}

export const statsRepository = {
  async getTodaySummary(): Promise<TodayStatsSummary> {
    const db = await getDatabase();
    const rolloverStr = await settingsRepository.get('rollover_hour', '4');
    const rolloverHour = parseInt(rolloverStr, 10) || 4;
    const todayStr = getDateStringForRollover(Date.now(), rolloverHour);

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

  /**
   * Retrieves daily study counts for the last 7 days (including today).
   */
  async getWeeklyActivity(): Promise<DayActivityItem[]> {
    const db = await getDatabase();
    const result: DayActivityItem[] = [];
    const now = new Date();

    const enDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const arDays = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    const datesMap = new Map<string, number>();

    // Prepare date strings for last 7 days
    const dateStrings: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      dateStrings.push(str);
      datesMap.set(str, 0);
    }

    try {
      const minDate = dateStrings[0];
      // 1. Query daily_stats
      const statsRows = await db.getAllAsync<{ date: string; cnt: number }>(
        `SELECT date, SUM(new_done + reviews_done) as cnt 
         FROM daily_stats 
         WHERE date >= ? 
         GROUP BY date;`,
        minDate
      );
      for (const r of statsRows) {
        if (datesMap.has(r.date)) {
          datesMap.set(r.date, (datesMap.get(r.date) || 0) + Number(r.cnt || 0));
        }
      }

      // 2. Query review_logs for any sessions not yet aggregated in daily_stats
      const revRows = await db.getAllAsync<{ date: string; cnt: number }>(
        `SELECT date(reviewed_at / 1000, 'unixepoch', 'localtime') as date, count(*) as cnt
         FROM review_logs
         WHERE reviewed_at >= ?
         GROUP BY date;`,
        now.getTime() - 7 * 86400000
      );
      for (const r of revRows) {
        if (datesMap.has(r.date)) {
          // Use Math.max between review_logs and daily_stats to avoid double counting
          const curr = datesMap.get(r.date) || 0;
          datesMap.set(r.date, Math.max(curr, Number(r.cnt || 0)));
        }
      }
    } catch (e) {
      console.warn('Failed to load weekly activity:', e);
    }

    const todayStr = now.toISOString().split('T')[0];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      const dayIdx = d.getDay();

      result.push({
        date: str,
        dayNameEn: enDays[dayIdx],
        dayNameAr: arDays[dayIdx],
        count: datesMap.get(str) || 0,
        isToday: str === todayStr,
      });
    }

    return result;
  },

  /**
   * Retrieves retention rate (% of successful recalls: rating >= 2) from review_logs.
   */
  async getRetentionRate(): Promise<number> {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ total: number; success: number }>(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN rating >= 2 THEN 1 ELSE 0 END) as success
         FROM review_logs;`
      );

      const total = Number(row?.total || 0);
      const success = Number(row?.success || 0);

      if (total === 0) return 90; // Default benchmark
      return Math.round((success / total) * 100);
    } catch (e) {
      return 90;
    }
  },

  /**
   * Retrieves card maturity breakdown: New, Learning (<21 days), Mature (>=21 days), Leeches.
   */
  async getCardMaturity(): Promise<CardMaturityBreakdown> {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{
        new_cnt: number;
        learn_cnt: number;
        mature_cnt: number;
        leech_cnt: number;
        total_cnt: number;
      }>(
        `SELECT
           SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as new_cnt,
           SUM(CASE WHEN state = 1 OR (state = 2 AND interval_days < 21) THEN 1 ELSE 0 END) as learn_cnt,
           SUM(CASE WHEN state = 2 AND interval_days >= 21 THEN 1 ELSE 0 END) as mature_cnt,
           SUM(CASE WHEN lapses >= 4 THEN 1 ELSE 0 END) as leech_cnt,
           COUNT(*) as total_cnt
         FROM cards;`
      );

      return {
        newCards: Number(row?.new_cnt || 0),
        learning: Number(row?.learn_cnt || 0),
        mature: Number(row?.mature_cnt || 0),
        leeches: Number(row?.leech_cnt || 0),
        total: Number(row?.total_cnt || 0),
      };
    } catch (e) {
      return {
        newCards: 0,
        learning: 0,
        mature: 0,
        leeches: 0,
        total: 0,
      };
    }
  },
};
