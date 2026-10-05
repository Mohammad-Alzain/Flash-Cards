import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { CustomAlert } from '../../components/common/CustomDialog';
import { quizGenerator } from '../../core/quiz/generator';
import { quizChecker } from '../../core/quiz/checker';
import { mistakesManager } from '../../core/quiz/mistakesManager';
import { quizRepository } from '../../core/db/repositories/quizRepository';
import { quizGrader, UncheckedWrittenQuestion } from '../../core/ai/quizGrader';
import { QuizQuestion, QuizMode, UserAnswerRecord } from '../../core/quiz/types';

/** Exam mode runs against this clock when no explicit limit is passed. */
const EXAM_DEFAULT_LIMIT_SEC = 120;
const SURVIVAL_LIVES = 3;
/** XP per fully-correct answer. */
const XP_PER_POINT = 15;
/** How long a wrong matching pair stays highlighted. */
const MISMATCH_FLASH_MS = 700;

const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

const shuffle = <T,>(items: T[]) => [...items].sort(() => 0.5 - Math.random());

export const formatClock = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export type QuizSession = ReturnType<typeof useQuizSession>;

/**
 * Quiz play state machine.
 * - "Silent" modes (written_ai / mixed / exam) collect answers, autosave, and grade at the end.
 * - Instant modes (survival / practice / random…) give feedback after every answer.
 */
export const useQuizSession = () => {
  const params = useLocalSearchParams<{
    mode?: string;
    deckId?: string;
    count?: string;
    questionField?: string;
    answerField?: string;
    timeLimitSec?: string;
    smartFocus?: 'all' | 'mistakes' | 'due' | 'new' | 'hardest';
  }>();
  const rawMode = params.mode || 'written_ai';
  const mode: QuizMode = rawMode === 'match' ? 'matching' : (rawMode as QuizMode);
  const questionCount = parseInt(params.count || '10', 10);
  const deckId = params.deckId;
  const isSilentMode = mode === 'written_ai' || mode === 'mixed' || mode === 'exam';

  const { t } = useTranslation();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Silent-mode answers
  const [userWrittenAnswers, setUserWrittenAnswers] = useState<Record<string, string>>({});
  const [userChoiceAnswers, setUserChoiceAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});

  // AI grading
  const [isGrading, setIsGrading] = useState(false);
  const [gradingStatus, setGradingStatus] = useState('');

  // Survival
  const [lives, setLives] = useState(SURVIVAL_LIVES);
  const livesRef = useRef(SURVIVAL_LIVES);

  // Timer
  const initialTimeLimit = params.timeLimitSec
    ? parseInt(params.timeLimitSec, 10)
    : mode === 'exam'
    ? EXAM_DEFAULT_LIMIT_SEC
    : 0;
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialTimeLimit);
  const isTimerActive = initialTimeLimit > 0;

  // Matching game
  const [shuffledLeft, setShuffledLeft] = useState<{ id: string; text: string }[]>([]);
  const [shuffledRight, setShuffledRight] = useState<{ id: string; text: string }[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [mismatchedPair, setMismatchedPair] = useState<{ left: string; right: string } | null>(null);

  // Instant feedback
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCurrentCorrect, setIsCurrentCorrect] = useState(false);
  const [feedbackExpected, setFeedbackExpected] = useState('');

  const answersLogRef = useRef<UserAnswerRecord[]>([]);
  const questionStartTime = useRef<number>(Date.now());
  const quizStartTime = useRef<number>(Date.now());
  const mismatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (mismatchTimeoutRef.current) clearTimeout(mismatchTimeoutRef.current);
    },
    []
  );

  // 1. Initial load (offering to resume an autosaved silent quiz)
  useEffect(() => {
    const loadFreshQuestions = () => {
      quizGenerator
        .generateQuestions({
          mode,
          deckId,
          questionCount,
          questionField: params.questionField,
          answerField: params.answerField,
          smartFocus: params.smartFocus,
          timeLimitSec: isTimerActive ? initialTimeLimit : undefined,
          allowedTypes:
            mode === 'matching'
              ? ['matching']
              : mode === 'written_ai'
              ? ['type_answer']
              : mode === 'mixed'
              ? ['multiple_choice', 'type_answer']
              : ['multiple_choice', 'true_false'],
        })
        .then((qs) => {
          setQuestions(qs);
          setLoading(false);
          questionStartTime.current = Date.now();
          quizStartTime.current = Date.now();
        });
    };

    (async () => {
      if (isSilentMode) {
        try {
          const savedProgress = await quizRepository.getInProgressQuiz(mode);
          if (savedProgress) {
            const parsed = JSON.parse(savedProgress);
            if (parsed.questions && parsed.questions.length > 0) {
              CustomAlert.alert(t('quiz_play.resume_title'), t('quiz_play.resume_msg'), [
                {
                  text: t('quiz_play.start_fresh'),
                  style: 'destructive',
                  onPress: async () => {
                    await quizRepository.clearInProgressQuiz(mode);
                    loadFreshQuestions();
                  },
                },
                {
                  text: t('quiz_play.resume'),
                  onPress: () => {
                    setQuestions(parsed.questions);
                    setCurrentIndex(parsed.currentIndex || 0);
                    setUserWrittenAnswers(parsed.userWrittenAnswers || {});
                    setUserChoiceAnswers(parsed.userChoiceAnswers || {});
                    setMarkedForReview(parsed.markedForReview || {});
                    if (parsed.startTime) quizStartTime.current = parsed.startTime;
                    setLoading(false);
                  },
                },
              ]);
              return;
            }
          }
        } catch (e) {
          console.warn('[QuizPlay] Could not check in-progress quiz:', e);
        }
      }
      loadFreshQuestions();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, deckId, questionCount, params.questionField, params.answerField, params.smartFocus]);

  // 2. Autosave silent quizzes
  useEffect(() => {
    if (!isSilentMode || loading || questions.length === 0) return;
    const stateToSave = {
      questions,
      currentIndex,
      userWrittenAnswers,
      userChoiceAnswers,
      markedForReview,
      startTime: quizStartTime.current,
    };
    quizRepository.saveInProgressQuiz(mode, JSON.stringify(stateToSave)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, userWrittenAnswers, userChoiceAnswers, markedForReview, isSilentMode, loading]);

  const currentQ = questions[currentIndex];

  // Matching board setup per question
  useEffect(() => {
    if (currentQ && currentQ.type === 'matching' && currentQ.pairs) {
      setShuffledLeft(shuffle(currentQ.pairs.map((p) => ({ id: p.id, text: p.left }))));
      setShuffledRight(shuffle(currentQ.pairs.map((p) => ({ id: p.id, text: p.right }))));
      setSelectedLeft(null);
      setMatchedIds(new Set());
      setMismatchedPair(null);
    }
  }, [currentQ]);

  const finishQuiz = async (finalLog?: UserAnswerRecord[]) => {
    const log = finalLog || answersLogRef.current;
    const correct = log.filter((a) => a.isCorrect).length;
    const total = log.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const xp = correct * XP_PER_POINT;
    const durationMs = Date.now() - quizStartTime.current;

    let attemptId = '';
    try {
      attemptId = await quizRepository.recordAttempt(
        {
          mode,
          startedAt: quizStartTime.current,
          endedAt: Date.now(),
          total,
          correct,
          score,
          durationMs,
          configJson: JSON.stringify({ mode, deckId, questionCount }),
        },
        log
      );
    } catch (e) {
      console.error('Failed to record attempt in quizRepository:', e);
    }

    router.replace(`/quiz/results?score=${score}&correct=${correct}&total=${total}&xp=${xp}&mode=${mode}&attemptId=${attemptId}`);
  };

  const processQuizGrading = async () => {
    setIsGrading(true);
    setGradingStatus(t('quiz_play.preparing'));

    try {
      const writtenQuestions: UncheckedWrittenQuestion[] = [];
      const choiceRecords: UserAnswerRecord[] = [];

      for (const q of questions) {
        if (q.type === 'type_answer') {
          writtenQuestions.push({
            questionId: q.id,
            cardId: q.cardId,
            prompt: q.prompt,
            expectedAnswer: q.correctAnswer,
            userAnswer: (userWrittenAnswers[q.id] || '').trim(),
          });
        } else {
          const userAns = userChoiceAnswers[q.id] || '';
          let isCorrect = false;
          if (q.type === 'multiple_choice') isCorrect = userAns === q.correctAnswer;
          else if (q.type === 'true_false') isCorrect = (userAns === 'True') === q.tfIsCorrect;

          choiceRecords.push({
            questionId: q.id,
            cardId: q.cardId,
            questionType: q.type,
            userAnswer: userAns,
            correctAnswer: q.correctAnswer,
            isCorrect,
            timeMs: 0,
            is_marked_for_review: Boolean(markedForReview[q.id]),
          });
        }
      }

      let gradedWritten: UserAnswerRecord[] = [];
      let overallAnalysis = '';
      if (writtenQuestions.length > 0) {
        const aiBatch = await quizGrader.gradeBatchWithAI(writtenQuestions, (status) => setGradingStatus(status));
        overallAnalysis = aiBatch.overall_analysis || '';
        gradedWritten = aiBatch.results.map((r) => ({
          questionId: r.questionId,
          cardId: r.cardId,
          questionType: 'type_answer' as const,
          userAnswer: r.userAnswer,
          correctAnswer: r.expectedAnswer,
          isCorrect: r.verdict === 'correct',
          timeMs: 0,
          ai_answer: r.ai_answer,
          ai_verdict: r.verdict,
          ai_score: r.score,
          ai_feedback: r.feedback,
          ai_tip: r.tip,
          ai_confidence: r.confidence,
          is_marked_for_review: Boolean(markedForReview[r.questionId]),
        }));
      }

      // Re-assemble in original question order.
      const combined = new Map<string, UserAnswerRecord>();
      choiceRecords.forEach((c) => combined.set(c.questionId, c));
      gradedWritten.forEach((w) => combined.set(w.questionId, w));
      const finalLog = questions.map((q) => combined.get(q.id)!);

      let totalEarnedScore = 0;
      let correctCount = 0;
      for (const record of finalLog) {
        if (record.ai_score !== undefined) {
          totalEarnedScore += record.ai_score;
          if (record.ai_verdict === 'correct') correctCount++;
        } else {
          totalEarnedScore += record.isCorrect ? 1 : 0;
          if (record.isCorrect) correctCount++;
        }
        // Feed the mistakes bank.
        if (record.ai_verdict === 'incorrect' || (!record.ai_verdict && !record.isCorrect)) {
          await mistakesManager.recordWrongAnswer(record.cardId);
        } else if (record.ai_verdict === 'correct' || (!record.ai_verdict && record.isCorrect)) {
          await mistakesManager.recordCorrectAnswer(record.cardId);
        }
      }

      const total = finalLog.length;
      const scorePercent = total > 0 ? Math.round((totalEarnedScore / total) * 100) : 0;
      const xp = Math.round(totalEarnedScore * XP_PER_POINT);
      const durationMs = Date.now() - quizStartTime.current;

      const attemptId = await quizRepository.recordAttempt(
        {
          mode,
          startedAt: quizStartTime.current,
          endedAt: Date.now(),
          total,
          correct: correctCount,
          score: scorePercent,
          durationMs,
          configJson: JSON.stringify({ mode, deckId, questionCount }),
          aiSummaryJson: overallAnalysis || undefined,
        },
        finalLog
      );
      await quizRepository.clearInProgressQuiz(mode);

      setIsGrading(false);
      router.replace(
        `/quiz/results?score=${scorePercent}&correct=${correctCount}&total=${total}&xp=${xp}&mode=${mode}&attemptId=${attemptId}`
      );
    } catch (e) {
      console.error('[QuizPlay] Error during grading:', e);
      setIsGrading(false);
      CustomAlert.alert(t('common.error'), t('quiz_play.grading_error'));
    }
  };

  const handleFinishSilentQuiz = async () => {
    if (questions.length === 0) return;
    const unansweredCount = questions.filter((q) =>
      q.type === 'type_answer' ? !(userWrittenAnswers[q.id] || '').trim() : !userChoiceAnswers[q.id]
    ).length;

    if (unansweredCount > 0) {
      CustomAlert.alert(t('quiz_play.confirm_submit_title'), t('quiz_play.confirm_submit_msg', { count: unansweredCount }), [
        { text: t('quiz_play.back_to_quiz'), style: 'cancel' },
        { text: t('quiz_play.grade_now'), onPress: () => processQuizGrading() },
      ]);
    } else {
      processQuizGrading();
    }
  };

  // The timer outlives many renders; always call the *latest* finish handlers so
  // grading uses the answers entered so far (not the ones captured at start).
  const finishOnTimeoutRef = useRef<() => void>(() => {});
  finishOnTimeoutRef.current = () => {
    if (isSilentMode) handleFinishSilentQuiz();
    else finishQuiz(answersLogRef.current);
  };

  // 3. Countdown
  useEffect(() => {
    if (!isTimerActive || loading || questions.length === 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          haptic.warning();
          CustomAlert.alert(t('quiz_play.times_up_title'), t('quiz_play.times_up_msg'), [
            { text: t('common.done'), onPress: () => finishOnTimeoutRef.current() },
          ]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimerActive, loading, questions.length, isSilentMode]);

  // Instant-mode evaluation
  const handleAnswerSubmit = async (userAns: string) => {
    if (!currentQ || isAnswerSubmitted) return;

    let isCorrect = false;
    let expected = currentQ.correctAnswer;
    if (currentQ.type === 'multiple_choice') {
      isCorrect = userAns === currentQ.correctAnswer;
    } else if (currentQ.type === 'true_false') {
      isCorrect = (userAns === 'True') === currentQ.tfIsCorrect;
      expected = currentQ.tfIsCorrect ? t('quiz_play.true') : t('quiz_play.false');
    } else if (currentQ.type === 'type_answer') {
      isCorrect = quizChecker.checkAnswer(userAns, currentQ.correctAnswer, true, true).isCorrect;
    } else if (currentQ.type === 'matching') {
      isCorrect = true;
      expected = t('quiz_play.all_matched_long');
    }

    const duration = Date.now() - questionStartTime.current;
    if (isCorrect) haptic.success();
    else haptic.error();

    if (!isCorrect) {
      await mistakesManager.recordWrongAnswer(currentQ.cardId);
      if (mode === 'survival') {
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
      }
    } else {
      await mistakesManager.recordCorrectAnswer(currentQ.cardId);
    }

    answersLogRef.current.push({
      questionId: currentQ.id,
      cardId: currentQ.cardId,
      questionType: currentQ.type,
      userAnswer: userAns,
      correctAnswer: expected,
      isCorrect,
      timeMs: duration,
    });

    setIsCurrentCorrect(isCorrect);
    setFeedbackExpected(expected);
    setIsAnswerSubmitted(true);
  };

  const handleMatchingLeftPress = (pairId: string) => {
    if (matchedIds.has(pairId) || isAnswerSubmitted) return;
    haptic.light();
    setSelectedLeft(pairId);
    setMismatchedPair(null);
  };

  const handleMatchingRightPress = (pairId: string) => {
    if (matchedIds.has(pairId) || isAnswerSubmitted) return;
    if (!selectedLeft) {
      haptic.warning();
      return;
    }
    if (selectedLeft === pairId) {
      haptic.success();
      const nextMatched = new Set(matchedIds);
      nextMatched.add(pairId);
      setMatchedIds(nextMatched);
      setSelectedLeft(null);
      setMismatchedPair(null);
      if (nextMatched.size === (currentQ.pairs?.length || 0)) {
        handleAnswerSubmit(t('quiz_play.all_matched'));
      }
    } else {
      haptic.error();
      setMismatchedPair({ left: selectedLeft, right: pairId });
      if (mismatchTimeoutRef.current) clearTimeout(mismatchTimeoutRef.current);
      mismatchTimeoutRef.current = setTimeout(() => {
        setMismatchedPair(null);
        setSelectedLeft(null);
      }, MISMATCH_FLASH_MS);
    }
  };

  const setWrittenAnswer = (text: string) => {
    if (!currentQ) return;
    setUserWrittenAnswers((prev) => ({ ...prev, [currentQ.id]: text }));
  };

  const selectChoice = (choice: string) => {
    if (!currentQ) return;
    setUserChoiceAnswers((prev) => ({ ...prev, [currentQ.id]: choice }));
    haptic.light();
  };

  /** Silent modes store the choice; instant modes evaluate immediately. */
  const answerChoice = (choice: string) => (isSilentMode ? selectChoice(choice) : handleAnswerSubmit(choice));

  const toggleReviewLater = () => {
    if (!currentQ) return;
    const next = !markedForReview[currentQ.id];
    setMarkedForReview((prev) => ({ ...prev, [currentQ.id]: next }));
    haptic.medium();
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      questionStartTime.current = Date.now();
    }
  };

  const goNextOrFinish = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      questionStartTime.current = Date.now();
    } else {
      handleFinishSilentQuiz();
    }
  };

  const continueAfterFeedback = () => {
    setIsAnswerSubmitted(false);
    if (mode === 'survival' && livesRef.current <= 0) {
      finishQuiz(answersLogRef.current);
      return;
    }
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      questionStartTime.current = Date.now();
    } else {
      finishQuiz(answersLogRef.current);
    }
  };

  const confirmExit = () =>
    CustomAlert.alert(t('quiz_play.exit_title'), t('quiz_play.exit_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('quiz_play.exit'), style: 'destructive', onPress: () => router.back() },
    ]);

  return {
    mode,
    isSilentMode,
    loading,
    questions,
    currentIndex,
    currentQ,
    lives,
    maxLives: SURVIVAL_LIVES,
    isTimerActive,
    remainingSeconds,
    isGrading,
    gradingStatus,
    // answers
    writtenAnswer: currentQ ? userWrittenAnswers[currentQ.id] || '' : '',
    selectedChoice: currentQ ? userChoiceAnswers[currentQ.id] : undefined,
    isMarked: currentQ ? Boolean(markedForReview[currentQ.id]) : false,
    setWrittenAnswer,
    answerChoice,
    toggleReviewLater,
    // matching
    shuffledLeft,
    shuffledRight,
    selectedLeft,
    matchedIds,
    mismatchedPair,
    handleMatchingLeftPress,
    handleMatchingRightPress,
    // feedback
    isAnswerSubmitted,
    isCurrentCorrect,
    feedbackExpected,
    // navigation
    goPrev,
    goNextOrFinish,
    finishSilent: handleFinishSilentQuiz,
    continueAfterFeedback,
    confirmExit,
  };
};
