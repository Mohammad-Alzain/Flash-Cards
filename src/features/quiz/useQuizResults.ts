import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { CustomAlert } from '../../components/common/CustomDialog';
import { quizRepository } from '../../core/db/repositories/quizRepository';
import { mistakesManager } from '../../core/quiz/mistakesManager';
import { cleanTextForQuiz } from '../../core/quiz/generator';

export type Verdict = 'correct' | 'partial' | 'incorrect';
export type ResultFilter = 'all' | Verdict;

export interface AnswerDetail {
  id: string;
  card_id: string;
  question_type: string;
  user_answer: string;
  correct_answer: string;
  is_correct: number;
  time_ms: number;
  ai_answer?: string | null;
  ai_verdict?: Verdict | null;
  ai_score?: number | null;
  ai_feedback?: string | null;
  ai_tip?: string | null;
  ai_confidence?: number | null;
  manual_override?: Verdict | null;
  is_marked_for_review?: number;
  fields_json?: string | null;
}

/** Score needed to count a quiz as passed. */
export const PASS_SCORE = 70;
const XP_PER_CORRECT = 15;
/** Wrong/partial answers auto-expanded when results open. */
const AUTO_EXPAND_LIMIT = 5;

/** Verdict for an answer, falling back to the boolean for non-AI questions. */
export const verdictOf = (a: AnswerDetail): Verdict =>
  a.ai_verdict === 'correct' || a.ai_verdict === 'partial' || a.ai_verdict === 'incorrect'
    ? a.ai_verdict
    : a.is_correct === 1
    ? 'correct'
    : 'incorrect';

/** Best-guess question prompt from the card's fields JSON. */
export const extractQuestionPrompt = (fieldsJson?: string | null): string => {
  if (!fieldsJson) return '';
  try {
    const parsed = JSON.parse(fieldsJson);
    if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed);
      const promptKey = keys.find((k) => /front|question|سؤال|المقدمة/i.test(k)) || keys[0];
      if (promptKey && parsed[promptKey]) return cleanTextForQuiz(String(parsed[promptKey]));
    }
  } catch {}
  return '';
};

const initialExpanded = (list: AnswerDetail[]) => {
  const ids = list
    .filter((a) => verdictOf(a) !== 'correct')
    .slice(0, AUTO_EXPAND_LIMIT)
    .map((a) => a.id);
  if (ids.length === 0) ids.push(...list.slice(0, 2).map((a) => a.id));
  return new Set(ids);
};

export const useQuizResults = (params: { score: string; xp: string; attemptId?: string }) => {
  const { t } = useTranslation();
  const { attemptId } = params;
  const [answers, setAnswers] = useState<AnswerDetail[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [score, setScore] = useState(parseInt(params.score, 10) || 0);
  const [xp, setXp] = useState(parseInt(params.xp, 10) || 0);
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!attemptId) return;
    quizRepository
      .getAttemptById(attemptId)
      .then((attempt) => {
        if (attempt?.ai_summary_json) setAiSummary(attempt.ai_summary_json);
      })
      .catch(() => {});
    quizRepository
      .getAttemptAnswers(attemptId)
      .then((res) => {
        if (res && res.length > 0) {
          const list = res as AnswerDetail[];
          setAnswers(list);
          setExpandedIds(initialExpanded(list));
        }
      })
      .catch((err) => console.error('[QuizResults] Error loading answers:', err));
  }, [attemptId]);

  const counts = useMemo(() => {
    const c = { all: answers.length, correct: 0, partial: 0, incorrect: 0 };
    answers.forEach((a) => c[verdictOf(a)]++);
    return c;
  }, [answers]);

  const filtered = useMemo(
    () => (filter === 'all' ? answers : answers.filter((a) => verdictOf(a) === filter)),
    [answers, filter]
  );

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const applyOverride = async (answer: AnswerDetail, verdict: Verdict) => {
    if (!attemptId) return false;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const partialScore = answer.ai_score || 0.5;
      const scoreToApply = verdict === 'correct' ? 1 : verdict === 'partial' ? partialScore : 0;

      await quizRepository.updateAnswerManualVerdict(answer.id, verdict, scoreToApply);
      const updated = await quizRepository.recalculateAttemptScore(attemptId);
      setScore(updated.score);
      setXp(Math.round(updated.correct * XP_PER_CORRECT));
      setAnswers((prev) =>
        prev.map((item) =>
          item.id === answer.id
            ? { ...item, manual_override: verdict, ai_verdict: verdict, ai_score: scoreToApply, is_correct: verdict === 'correct' ? 1 : 0 }
            : item
        )
      );
      return true;
    } catch (e) {
      console.error('[QuizResults] Error updating manual verdict:', e);
      CustomAlert.alert(t('common.error'), t('quiz_results.override_error'));
      return false;
    }
  };

  const saveMistakesToNotebook = async () => {
    const wrong = answers.filter((a) => verdictOf(a) !== 'correct');
    if (wrong.length === 0) {
      CustomAlert.alert(t('quiz_results.no_mistakes_title'), t('quiz_results.no_mistakes_msg'));
      return;
    }
    try {
      for (const item of wrong) await mistakesManager.recordWrongAnswer(item.card_id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      CustomAlert.alert(t('quiz_results.saved_title'), t('quiz_results.saved_msg', { count: wrong.length }));
    } catch (e) {
      console.error('[QuizResults] Error saving mistakes:', e);
    }
  };

  return {
    answers,
    aiSummary,
    score,
    xp,
    passed: score >= PASS_SCORE,
    counts,
    filter,
    setFilter,
    filtered,
    expandedIds,
    toggleExpand,
    applyOverride,
    saveMistakesToNotebook,
  };
};
