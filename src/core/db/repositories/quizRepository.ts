import { getDatabase } from '../connection';
import { UserAnswerRecord } from '../../quiz/types';

export interface QuizAttemptRecord {
  id: string;
  preset_id?: string | null;
  mode: string;
  started_at: number;
  ended_at: number;
  total: number;
  correct: number;
  score: number;
  duration_ms: number;
  config_json: string;
}

export const quizRepository = {
  /**
   * Persists a completed quiz attempt, all its individual answers, and logs earned XP
   */
  async recordAttempt(
    data: {
      mode: string;
      startedAt: number;
      endedAt: number;
      total: number;
      correct: number;
      score: number;
      durationMs: number;
      configJson?: string;
    },
    answers: UserAnswerRecord[]
  ): Promise<string> {
    const db = await getDatabase();
    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const earnedXp = data.correct * 15;

    await db.withTransactionAsync(async () => {
      // 1. Insert Attempt
      await db.runAsync(
        `INSERT INTO quiz_attempts (
          id, preset_id, mode, started_at, ended_at, total, correct, score, duration_ms, config_json
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?);`,
        attemptId,
        data.mode,
        data.startedAt,
        data.endedAt,
        data.total,
        data.correct,
        data.score,
        data.durationMs,
        data.configJson || '{}'
      );

      // 2. Insert Answers
      for (const ans of answers) {
        const answerId = `ans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.runAsync(
          `INSERT INTO quiz_answers (
            id, attempt_id, card_id, question_type, user_answer, correct_answer, is_correct, time_ms, answered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          answerId,
          attemptId,
          ans.cardId,
          ans.questionType,
          ans.userAnswer || '',
          ans.correctAnswer || '',
          ans.isCorrect ? 1 : 0,
          ans.timeMs || 0,
          now
        );
      }

      // 3. Log XP if earned
      if (earnedXp > 0) {
        const xpId = `xp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.runAsync(
          `INSERT INTO xp_log (id, source, amount, created_at) VALUES (?, ?, ?, ?);`,
          xpId,
          `quiz_${data.mode}`,
          earnedXp,
          now
        );
      }
    });

    return attemptId;
  },

  /**
   * Retrieves recent attempts
   */
  async getRecentAttempts(limit = 20): Promise<QuizAttemptRecord[]> {
    const db = await getDatabase();
    return await db.getAllAsync<QuizAttemptRecord>(
      'SELECT * FROM quiz_attempts ORDER BY ended_at DESC LIMIT ?;',
      limit
    );
  },

  /**
   * Retrieves answers for a specific attempt
   */
  async getAttemptAnswers(attemptId: string) {
    const db = await getDatabase();
    return await db.getAllAsync<any>(
      'SELECT * FROM quiz_answers WHERE attempt_id = ? ORDER BY answered_at ASC;',
      attemptId
    );
  },
};
