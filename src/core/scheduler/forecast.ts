import { getDatabase } from '../db/connection';
import { getDayEndTimestamp, getDateStringForRollover } from './dayBoundary';

export interface DayForecast {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // Mon, Tue, etc.
  dueCount: number;
}

export interface ExamPaceResult {
  daysLeft: number;
  totalNewCards: number;
  recommendedNewPerDay: number;
  estimatedReviewLoadPerDay: number;
  finishDateStr: string;
}

export const forecastService = {
  /**
   * Computes expected due cards for the next N days
   */
  async getDueForecast(daysCount = 14, deckId?: string): Promise<DayForecast[]> {
    const db = await getDatabase();
    const now = Date.now();
    const result: DayForecast[] = [];

    // Query cards due on or before each day boundary
    for (let d = 0; d < daysCount; d++) {
      const targetTime = now + d * 86400 * 1000;
      const dayEnd = getDayEndTimestamp(targetTime, 4);
      const dayStart = dayEnd - 86400 * 1000;

      let sql = `
        SELECT COUNT(*) as due_count
        FROM cards
        WHERE suspended = 0
          AND state = 2
          AND due > ? AND due <= ?
      `;
      const params: any[] = [d === 0 ? 0 : dayStart, dayEnd];

      if (deckId) {
        sql += ' AND deck_id = ?';
        params.push(deckId);
      }

      const row = await db.getFirstAsync<{ due_count: number }>(sql, ...params);
      const dateObj = new Date(targetTime);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      result.push({
        dateStr: getDateStringForRollover(targetTime, 4),
        dayLabel: dayNames[dateObj.getDay()] || '',
        dueCount: Number(row?.due_count || 0),
      });
    }

    return result;
  },

  /**
   * Computes study quota for target exam date
   */
  calculateExamPace(totalNewCards: number, daysLeft: number): ExamPaceResult {
    const safeDaysLeft = Math.max(1, daysLeft);
    // Buffer: keep 3-5 days before exam for reviews only
    const learningDays = Math.max(1, safeDaysLeft - Math.min(5, Math.floor(safeDaysLeft * 0.2)));
    const recommendedNewPerDay = Math.ceil(totalNewCards / learningDays);

    // Approximate review load: ~3x new cards per day
    const estimatedReviewLoad = Math.round(recommendedNewPerDay * 3.5);

    const finishDate = new Date(Date.now() + learningDays * 86400 * 1000);
    const finishDateStr = finishDate.toISOString().split('T')[0];

    return {
      daysLeft: safeDaysLeft,
      totalNewCards,
      recommendedNewPerDay,
      estimatedReviewLoadPerDay: estimatedReviewLoad,
      finishDateStr,
    };
  },
};
