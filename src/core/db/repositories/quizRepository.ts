import { getDatabase, withDatabaseLock, withDatabaseRead } from '../connection';
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
  ai_summary_json?: string | null;
  in_progress_state_json?: string | null;
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
      aiSummaryJson?: string;
    },
    answers: UserAnswerRecord[]
  ): Promise<string> {
    return await withDatabaseLock(async (db) => {
      const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = Date.now();
      const earnedXp = Math.round(data.correct * 15);

      await db.withTransactionAsync(async () => {
        // 1. Insert Attempt
        await db.runAsync(
          `INSERT INTO quiz_attempts (
            id, preset_id, mode, started_at, ended_at, total, correct, score, duration_ms, config_json, ai_summary_json
          ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          attemptId,
          data.mode,
          data.startedAt,
          data.endedAt,
          data.total,
          data.correct,
          data.score,
          data.durationMs,
          data.configJson || '{}',
          data.aiSummaryJson || null
        );

        // 2. Insert Answers
        for (const ans of answers) {
          const answerId = `ans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await db.runAsync(
            `INSERT INTO quiz_answers (
              id, attempt_id, card_id, question_type, user_answer, correct_answer, is_correct, time_ms, answered_at,
              ai_answer, ai_verdict, ai_score, ai_feedback, ai_tip, ai_confidence, manual_override, is_marked_for_review
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            answerId,
            attemptId,
            ans.cardId,
            ans.questionType,
            ans.userAnswer || '',
            ans.correctAnswer || '',
            ans.isCorrect ? 1 : 0,
            ans.timeMs || 0,
            now,
            ans.ai_answer || null,
            ans.ai_verdict || null,
            ans.ai_score !== undefined ? ans.ai_score : null,
            ans.ai_feedback || null,
            ans.ai_tip || null,
            ans.ai_confidence !== undefined ? ans.ai_confidence : null,
            ans.manual_override || null,
            ans.is_marked_for_review ? 1 : 0
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
    });
  },

  /**
   * Retrieves recent attempts
   */
  async getRecentAttempts(limit = 20): Promise<QuizAttemptRecord[]> {
    return await withDatabaseRead(async (db) => {
      return await db.getAllAsync<QuizAttemptRecord>(
        'SELECT * FROM quiz_attempts ORDER BY ended_at DESC LIMIT ?;',
        limit
      );
    });
  },

  /**
   * Retrieves attempt metadata by ID
   */
  async getAttemptById(attemptId: string): Promise<QuizAttemptRecord | null> {
    return await withDatabaseRead(async (db) => {
      const row = await db.getFirstAsync<QuizAttemptRecord>(
        'SELECT * FROM quiz_attempts WHERE id = ?;',
        attemptId
      );
      return row || null;
    });
  },

  /**
   * Retrieves answers for a specific attempt with card note fields
   */
  async getAttemptAnswers(attemptId: string) {
    return await withDatabaseRead(async (db) => {
      return await db.getAllAsync<any>(
        `SELECT qa.*, n.fields_json
         FROM quiz_answers qa
         LEFT JOIN cards c ON c.id = qa.card_id
         LEFT JOIN notes n ON n.id = c.note_id
         WHERE qa.attempt_id = ?
         ORDER BY qa.answered_at ASC;`,
        attemptId
      );
    });
  },

  /**
   * Allows user to manually override AI's verdict on an answer
   */
  async updateAnswerManualVerdict(
    answerId: string,
    verdict: 'correct' | 'partial' | 'incorrect',
    score: number
  ): Promise<void> {
    return await withDatabaseLock(async (db) => {
      await db.runAsync(
        `UPDATE quiz_answers
         SET manual_override = ?, ai_verdict = ?, ai_score = ?, is_correct = ?
         WHERE id = ?;`,
        verdict,
        verdict,
        score,
        verdict === 'correct' ? 1 : 0,
        answerId
      );
    });
  },

  /**
   * Recalculates total score and correct count for an attempt after overrides
   */
  async recalculateAttemptScore(attemptId: string): Promise<{ score: number; correct: number }> {
    return await withDatabaseLock(async (db) => {
      const answers = await db.getAllAsync<{ is_correct: number; ai_score: number | null }>(
        'SELECT is_correct, ai_score FROM quiz_answers WHERE attempt_id = ?;',
        attemptId
      );
      if (answers.length === 0) return { score: 0, correct: 0 };
      let totalEarned = 0;
      let correctCount = 0;
      for (const a of answers) {
        if (a.ai_score !== null && a.ai_score !== undefined) {
          totalEarned += a.ai_score;
          if (a.ai_score >= 0.7) correctCount++;
        } else {
          totalEarned += a.is_correct ? 1.0 : 0.0;
          if (a.is_correct) correctCount++;
        }
      }
      const score = Math.round((totalEarned / answers.length) * 100);
      await db.runAsync(
        'UPDATE quiz_attempts SET score = ?, correct = ? WHERE id = ?;',
        score,
        correctCount,
        attemptId
      );
      return { score, correct: correctCount };
    });
  },

  /**
   * Autosaves quiz progress in real time
   */
  async saveInProgressQuiz(mode: string, stateJson: string): Promise<void> {
    return await withDatabaseLock(async (db) => {
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        `quiz_in_progress_${mode}`,
        stateJson
      );
    });
  },

  /**
   * Retrieves any saved in-progress quiz for a mode
   */
  async getInProgressQuiz(mode: string): Promise<string | null> {
    return await withDatabaseRead(async (db) => {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?;',
        `quiz_in_progress_${mode}`
      );
      return row?.value || null;
    });
  },

  /**
   * Clears saved in-progress quiz upon completion or abort
   */
  async clearInProgressQuiz(mode: string): Promise<void> {
    return await withDatabaseLock(async (db) => {
      await db.runAsync('DELETE FROM settings WHERE key = ?;', `quiz_in_progress_${mode}`);
    });
  },
};
