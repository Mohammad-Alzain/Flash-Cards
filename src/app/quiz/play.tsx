import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import {
  Header,
  Card,
  Button,
  ProgressBar,
  Badge,
} from '../../components/ui';
import { quizGenerator } from '../../core/quiz/generator';
import { quizChecker } from '../../core/quiz/checker';
import { mistakesManager } from '../../core/quiz/mistakesManager';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { quizRepository } from '../../core/db/repositories/quizRepository';
import { quizGrader, UncheckedWrittenQuestion } from '../../core/ai/quizGrader';
import {
  QuizQuestion,
  QuizMode,
  UserAnswerRecord,
} from '../../core/quiz/types';

export default function QuizPlayScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    deckId?: string;
    count?: string;
    questionField?: string;
    answerField?: string;
    timeLimitSec?: string;
    smartFocus?: 'all' | 'mistakes' | 'due' | 'new' | 'hardest';
  }>();
  const rawMode = params.mode || 'random';
  const mode: QuizMode = rawMode === 'match' ? 'matching' : (rawMode as QuizMode);
  const questionCount = parseInt(params.count || '10', 10);
  const deckId = params.deckId;

  const isSilentMode = mode === 'written_ai' || mode === 'mixed' || mode === 'exam';

  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalDbCards, setTotalDbCards] = useState<number | null>(null);

  // Written & Silent Quiz State
  const [userWrittenAnswers, setUserWrittenAnswers] = useState<Record<string, string>>({});
  const [userChoiceAnswers, setUserChoiceAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});

  // AI Grading Modal State
  const [isGrading, setIsGrading] = useState(false);
  const [gradingStatus, setGradingStatus] = useState('');
  const [isCancellingGrading, setIsCancellingGrading] = useState(false);

  // Survival Mode Lives
  const [lives, setLives] = useState(3);
  const livesRef = useRef(3);

  // Timer Configuration & State
  const initialTimeLimit = params.timeLimitSec
    ? parseInt(params.timeLimitSec, 10)
    : mode === 'exam'
    ? 120
    : 0;
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialTimeLimit);
  const isTimerActive = initialTimeLimit > 0;

  // Matching Game States
  const [shuffledLeft, setShuffledLeft] = useState<{ id: string; text: string }[]>([]);
  const [shuffledRight, setShuffledRight] = useState<{ id: string; text: string }[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [mismatchedPair, setMismatchedPair] = useState<{ left: string; right: string } | null>(null);

  // Instant Feedback State (for non-silent modes like random/survival)
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isCurrentCorrect, setIsCurrentCorrect] = useState(false);
  const [feedbackExpected, setFeedbackExpected] = useState('');

  // Results tracking
  const [answersLog, setAnswersLog] = useState<UserAnswerRecord[]>([]);
  const answersLogRef = useRef<UserAnswerRecord[]>([]);
  const questionStartTime = useRef<number>(Date.now());
  const quizStartTime = useRef<number>(Date.now());
  const mismatchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (mismatchTimeoutRef.current) {
        clearTimeout(mismatchTimeoutRef.current);
      }
    };
  }, []);

  // 1. Initial Load & In-progress Autosave Restore
  useEffect(() => {
    cardRepository.getTotalCount().then(setTotalDbCards).catch(() => setTotalDbCards(0));

    const initQuiz = async () => {
      // Check for saved in-progress quiz
      if (isSilentMode) {
        try {
          const savedProgress = await quizRepository.getInProgressQuiz(mode);
          if (savedProgress) {
            const parsed = JSON.parse(savedProgress);
            if (parsed.questions && parsed.questions.length > 0) {
              CustomAlert.alert(
                rtl ? 'استئناف الاختبار' : 'Resume Quiz',
                rtl
                  ? 'لديك اختبار سابق غير مكتمل، هل تود متابعته من حيث توقفت؟'
                  : 'You have an unfinished quiz, resume where you left off?',
                [
                  {
                    text: rtl ? 'بدء اختبار جديد' : 'Start Fresh',
                    style: 'destructive',
                    onPress: async () => {
                      await quizRepository.clearInProgressQuiz(mode);
                      loadFreshQuestions();
                    },
                  },
                  {
                    text: rtl ? 'استئناف الاختبار' : 'Resume',
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
                ]
              );
              return;
            }
          }
        } catch (e) {
          console.warn('[QuizPlay] Could not check in-progress quiz:', e);
        }
      }

      loadFreshQuestions();
    };

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

    initQuiz();
  }, [mode, deckId, questionCount, params.questionField, params.answerField, params.smartFocus]);

  // 2. Autosave in-progress state for written and silent quizzes
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
  }, [currentIndex, userWrittenAnswers, userChoiceAnswers, markedForReview, isSilentMode, loading]);

  // 3. Live Timer Countdown Hook
  useEffect(() => {
    if (!isTimerActive || loading || questions.length === 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch (e) {}
          CustomAlert.alert(
            rtl ? 'انتهى الوقت!' : "Time's Up!",
            rtl ? 'انتهى الوقت المحدد للاختبار.' : 'The time limit for this quiz has expired.',
            [
              {
                text: t('common.done'),
                onPress: () => {
                  if (isSilentMode) {
                    handleFinishSilentQuiz();
                  } else {
                    finishQuiz(answersLogRef.current);
                  }
                },
              },
            ]
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, loading, questions.length, rtl, isSilentMode]);

  const currentQ = questions[currentIndex];

  // Set up matching pairs when question is of type 'matching'
  useEffect(() => {
    if (currentQ && currentQ.type === 'matching' && currentQ.pairs) {
      const left = currentQ.pairs.map((p) => ({ id: p.id, text: p.left }));
      const right = currentQ.pairs.map((p) => ({ id: p.id, text: p.right }));
      setShuffledLeft([...left].sort(() => 0.5 - Math.random()));
      setShuffledRight([...right].sort(() => 0.5 - Math.random()));
      setSelectedLeft(null);
      setMatchedIds(new Set());
      setMismatchedPair(null);
    }
  }, [currentQ]);

  const handleMatchingLeftPress = (pairId: string) => {
    if (matchedIds.has(pairId) || isAnswerSubmitted) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setSelectedLeft(pairId);
    setMismatchedPair(null);
  };

  const handleMatchingRightPress = (pairId: string) => {
    if (matchedIds.has(pairId) || isAnswerSubmitted) return;
    if (!selectedLeft) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (e) {}
      return;
    }

    if (selectedLeft === pairId) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
      const nextMatched = new Set(matchedIds);
      nextMatched.add(pairId);
      setMatchedIds(nextMatched);
      setSelectedLeft(null);
      setMismatchedPair(null);

      if (nextMatched.size === (currentQ.pairs?.length || 0)) {
        handleAnswerSubmit(rtl ? 'تمت المطابقة بنجاح' : 'All matched');
      }
    } else {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (e) {}
      setMismatchedPair({ left: selectedLeft, right: pairId });
      if (mismatchTimeoutRef.current) {
        clearTimeout(mismatchTimeoutRef.current);
      }
      mismatchTimeoutRef.current = setTimeout(() => {
        setMismatchedPair(null);
        setSelectedLeft(null);
      }, 700);
    }
  };

  // Immediate evaluation submit handler (for random/survival/instant modes)
  const handleAnswerSubmit = async (userAns: string) => {
    if (!currentQ || isAnswerSubmitted) return;

    let isCorrect = false;
    let expected = currentQ.correctAnswer;

    if (currentQ.type === 'multiple_choice') {
      isCorrect = userAns === currentQ.correctAnswer;
    } else if (currentQ.type === 'true_false') {
      isCorrect = (userAns === 'True') === currentQ.tfIsCorrect;
      expected = currentQ.tfIsCorrect ? (rtl ? 'صحيح' : 'True') : (rtl ? 'خطأ' : 'False');
    } else if (currentQ.type === 'type_answer') {
      const checkRes = quizChecker.checkAnswer(userAns, currentQ.correctAnswer, true, true);
      isCorrect = checkRes.isCorrect;
    } else if (currentQ.type === 'matching') {
      isCorrect = true;
      expected = rtl ? 'تمت المطابقة بنجاح!' : 'All matched successfully!';
    }

    const duration = Date.now() - questionStartTime.current;

    try {
      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e) {}

    if (!isCorrect) {
      await mistakesManager.recordWrongAnswer(currentQ.cardId);
      if (mode === 'survival') {
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
      }
    } else {
      await mistakesManager.recordCorrectAnswer(currentQ.cardId);
    }

    const record: UserAnswerRecord = {
      questionId: currentQ.id,
      cardId: currentQ.cardId,
      questionType: currentQ.type,
      userAnswer: userAns,
      correctAnswer: expected,
      isCorrect,
      timeMs: duration,
    };
    answersLogRef.current.push(record);
    setAnswersLog((prev) => [...prev, record]);

    setIsCurrentCorrect(isCorrect);
    setFeedbackExpected(expected);
    setIsAnswerSubmitted(true);
  };

  // User input handlers for Written / Silent Quiz
  const handleSaveWrittenAnswer = (text: string) => {
    if (!currentQ) return;
    setUserWrittenAnswers((prev) => ({
      ...prev,
      [currentQ.id]: text,
    }));
  };

  const handleSelectChoiceAnswer = (choice: string) => {
    if (!currentQ) return;
    setUserChoiceAnswers((prev) => ({
      ...prev,
      [currentQ.id]: choice,
    }));
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  const handleToggleReviewLater = () => {
    if (!currentQ) return;
    const nextVal = !markedForReview[currentQ.id];
    setMarkedForReview((prev) => ({
      ...prev,
      [currentQ.id]: nextVal,
    }));
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
  };

  const handleNavPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      questionStartTime.current = Date.now();
    }
  };

  const handleNavNextOrSkip = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      questionStartTime.current = Date.now();
    } else {
      // Last question reached
      handleFinishSilentQuiz();
    }
  };

  // Final submission and AI Grading flow for Written and Mixed quizzes
  const handleFinishSilentQuiz = async () => {
    if (questions.length === 0) return;

    // Check if there are unanswered questions
    const unansweredCount = questions.filter((q) => {
      if (q.type === 'type_answer') {
        return !(userWrittenAnswers[q.id] || '').trim();
      }
      return !userChoiceAnswers[q.id];
    }).length;

    if (unansweredCount > 0) {
      CustomAlert.alert(
        rtl ? 'تأكيد التسليم' : 'Confirm Submission',
        rtl
          ? `لديك ${unansweredCount} أسئلة لم تقم بالإجابة عليها بعد. هل ترغب في إنهاء الاختبار وتصحيحه الآن؟`
          : `You have ${unansweredCount} unanswered questions. Finish and grade now?`,
        [
          { text: rtl ? 'العودة للاختبار' : 'Back to Quiz', style: 'cancel' },
          {
            text: rtl ? 'نعم، تسليم وتصحيح' : 'Grade Now',
            onPress: () => processQuizGrading(),
          },
        ]
      );
    } else {
      processQuizGrading();
    }
  };

  const processQuizGrading = async () => {
    setIsGrading(true);
    setGradingStatus(rtl ? 'جاري تحضير وتدقيق الإجابات...' : 'Preparing answers for evaluation...');

    try {
      // Separate questions by type
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
          // multiple_choice or true_false
          const userAns = userChoiceAnswers[q.id] || '';
          let isCorrect = false;
          if (q.type === 'multiple_choice') {
            isCorrect = userAns === q.correctAnswer;
          } else if (q.type === 'true_false') {
            isCorrect = (userAns === 'True') === q.tfIsCorrect;
          }

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

      // Grade written questions with AI
      let gradedWritten: UserAnswerRecord[] = [];
      let overallAnalysis = '';

      if (writtenQuestions.length > 0) {
        const aiBatch = await quizGrader.gradeBatchWithAI(writtenQuestions, (status) => {
          setGradingStatus(status);
        });

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

      // Combine all records in original question sequence
      const combinedMap = new Map<string, UserAnswerRecord>();
      choiceRecords.forEach((c) => combinedMap.set(c.questionId, c));
      gradedWritten.forEach((w) => combinedMap.set(w.questionId, w));

      const finalLog = questions.map((q) => combinedMap.get(q.id)!);

      // Compute total weighted score
      let totalEarnedScore = 0;
      let correctCount = 0;

      for (const record of finalLog) {
        if (record.ai_score !== undefined) {
          totalEarnedScore += record.ai_score;
          if (record.ai_verdict === 'correct') correctCount++;
        } else {
          totalEarnedScore += record.isCorrect ? 1.0 : 0.0;
          if (record.isCorrect) correctCount++;
        }

        // Record wrong answers into mistakes bank
        if (record.ai_verdict === 'incorrect' || (!record.ai_verdict && !record.isCorrect)) {
          await mistakesManager.recordWrongAnswer(record.cardId);
        } else if (record.ai_verdict === 'correct' || (!record.ai_verdict && record.isCorrect)) {
          await mistakesManager.recordCorrectAnswer(record.cardId);
        }
      }

      const total = finalLog.length;
      const scorePercent = total > 0 ? Math.round((totalEarnedScore / total) * 100) : 0;
      const xp = Math.round(totalEarnedScore * 15);
      const durationMs = Date.now() - quizStartTime.current;

      // Save to database
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

      // Clear in-progress autosave
      await quizRepository.clearInProgressQuiz(mode);

      setIsGrading(false);
      router.replace(
        `/quiz/results?score=${scorePercent}&correct=${correctCount}&total=${total}&xp=${xp}&mode=${mode}&attemptId=${attemptId}`
      );
    } catch (e: any) {
      console.error('[QuizPlay] Error during grading:', e);
      setIsGrading(false);
      CustomAlert.alert(t('common.error'), 'حدث خطأ أثناء تصحيح الاختبار. تم حفظ إجاباتك محلياً.');
    }
  };

  const finishQuiz = async (finalLog?: UserAnswerRecord[]) => {
    const log = finalLog || answersLogRef.current;
    const correct = log.filter((a) => a.isCorrect).length;
    const total = log.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const xp = correct * 15;
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

    router.replace(
      `/quiz/results?score=${score}&correct=${correct}&total=${total}&xp=${xp}&mode=${mode}&attemptId=${attemptId}`
    );
  };

  const handleContinueNext = () => {
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

  const formatTime = (totalSeconds: number): string => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <Header title={t('quiz.title')} onBack={() => router.back()} />
        <View style={styles.center}>
          <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}18`, marginBottom: 16 }]}>
            <Ionicons name="sparkles" size={48} color={colors.primary} />
          </View>
          <Text style={{ color: colors.text, fontSize: typography.sizes.lg, fontWeight: 'bold', textAlign: 'center' }}>
            {rtl ? 'لا توجد بطاقات كافية لبدء الاختبار' : 'No Cards Available for Quiz'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 300, lineHeight: 20 }}>
            {rtl
              ? 'تأكد من اختيار رزمة تحتوي على بطاقات ومفردات، أو أضف بطاقات جديدة إلى مجموعتك.'
              : 'Add some flashcards to this deck or choose another deck to start training.'}
          </Text>
          <Button
            title={rtl ? 'العودة لصفحة الاختبارات' : 'Back to Quizzes'}
            variant="primary"
            size="md"
            onPress={() => router.back()}
            style={{ marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isCurrentMarked = currentQ ? Boolean(markedForReview[currentQ.id]) : false;
  const currentWrittenText = currentQ ? userWrittenAnswers[currentQ.id] || '' : '';
  const currentSelectedChoice = currentQ ? userChoiceAnswers[currentQ.id] : undefined;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* ── Top Bar ── */}
      <View
        style={[
          styles.topBar,
          {
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            flexDirection: rtl ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Pressable
          onPress={() => {
            CustomAlert.alert(
              rtl ? 'إنهاء الاختبار' : 'Exit Quiz',
              rtl ? 'هل أنت متأكد من رغبتك في الخروج؟ سيتم حفظ تقدمك الحالي.' : 'Exit quiz? Your progress is saved.',
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: rtl ? 'خروج' : 'Exit', style: 'destructive', onPress: () => router.back() },
              ]
            );
          }}
          hitSlop={8}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>

        {/* Progress Bar & Index */}
        <View style={styles.progressBarWrapper}>
          <ProgressBar progress={(currentIndex + 1) / questions.length} height={8} />
        </View>

        {/* Status Indicators */}
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
          {isTimerActive && (
            <View style={[styles.timerBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons
                name="time-outline"
                size={14}
                color={remainingSeconds < 30 ? colors.error : colors.textSecondary}
              />
              <Text
                style={{
                  color: remainingSeconds < 30 ? colors.error : colors.text,
                  fontSize: 12,
                  fontWeight: 'bold',
                }}
              >
                {formatTime(remainingSeconds)}
              </Text>
            </View>
          )}

          {isSilentMode && (
            <Pressable
              onPress={handleToggleReviewLater}
              hitSlop={6}
              style={[
                styles.bookmarkBtn,
                {
                  backgroundColor: isCurrentMarked ? `${colors.primary}22` : colors.surface,
                  borderColor: isCurrentMarked ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={isCurrentMarked ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={isCurrentMarked ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          )}

          {mode === 'survival' ? (
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 4, alignItems: 'center' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < lives ? 'heart' : 'heart-outline'}
                  size={20}
                  color={i < lives ? colors.error : colors.textMuted}
                />
              ))}
            </View>
          ) : (
            <Badge
              count={`${currentIndex + 1} / ${questions.length}`}
              variant="neutral"
              size="sm"
            />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Question Type Header Badge */}
        <View style={[styles.qTypeBadgeRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <View
            style={[
              styles.qTypePill,
              {
                backgroundColor:
                  currentQ.type === 'type_answer'
                    ? `${colors.primary}18`
                    : currentQ.type === 'matching'
                    ? `${colors.gold}18`
                    : `${colors.accent}18`,
                borderColor:
                  currentQ.type === 'type_answer'
                    ? colors.primary
                    : currentQ.type === 'matching'
                    ? colors.gold
                    : colors.accent,
                flexDirection: rtl ? 'row-reverse' : 'row',
                gap: 6,
              },
            ]}
          >
            <Ionicons
              name={
                currentQ.type === 'type_answer'
                  ? 'create-outline'
                  : currentQ.type === 'matching'
                  ? 'flash-outline'
                  : 'list-outline'
              }
              size={14}
              color={
                currentQ.type === 'type_answer'
                  ? colors.primary
                  : currentQ.type === 'matching'
                  ? colors.gold
                  : colors.accent
              }
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color:
                  currentQ.type === 'type_answer'
                    ? colors.primary
                    : currentQ.type === 'matching'
                    ? colors.gold
                    : colors.accent,
              }}
            >
              {currentQ.type === 'type_answer'
                ? rtl ? 'سؤال كتابي (تصحيح ذكي)' : 'Written Question (AI Graded)'
                : currentQ.type === 'matching'
                ? rtl ? 'لعبة مطابقة' : 'Matching Game'
                : rtl ? 'اختيار من متعدد' : 'Multiple Choice'}
            </Text>
          </View>
        </View>

        {/* Question Prompt Card */}
        <Card style={[styles.questionCard, { marginBottom: spacing.lg, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          {Boolean(currentQ.promptImage) && (
            <Image
              source={{ uri: currentQ.promptImage }}
              style={styles.promptImage}
              resizeMode="contain"
            />
          )}

          {currentQ.prompt ? (
            <Text
              style={[
                styles.promptText,
                {
                  color: colors.text,
                  fontSize: currentQ.type === 'matching' ? typography.sizes.md : typography.sizes.xl,
                  fontWeight: typography.weights.bold,
                  textAlign: 'center',
                  lineHeight: 28,
                  marginTop: currentQ.promptImage ? 12 : 0,
                },
              ]}
            >
              {currentQ.type === 'matching'
                ? (rtl ? 'طابق كل مصطلح مع معناه المقابل' : currentQ.prompt)
                : currentQ.prompt}
            </Text>
          ) : null}

          {currentQ.type === 'true_false' && currentQ.tfPresentedAnswer && (
            <View style={[styles.tfBox, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
                {rtl ? 'الإجابة المعروضة:' : 'Presented Answer:'}
              </Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                "{currentQ.tfPresentedAnswer}"
              </Text>
            </View>
          )}
        </Card>

        {/* ── Mode 1: Written Answer Field (type_answer) ── */}
        {currentQ.type === 'type_answer' && (
          <View style={styles.writtenContainer}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'اكتب إجابتك بحرية:' : 'Write your answer:'}
            </Text>
            <View
              style={[
                styles.writtenInputBox,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: currentWrittenText ? colors.primary : colors.border,
                },
              ]}
            >
              <TextInput
                style={[
                  styles.writtenInput,
                  {
                    color: colors.text,
                    textAlign: rtl ? 'right' : 'left',
                  },
                ]}
                placeholder={rtl ? 'اكتب إجابتك هنا بدقة...' : 'Type your answer here...'}
                placeholderTextColor={colors.textMuted}
                value={currentWrittenText}
                onChangeText={handleSaveWrittenAnswer}
                multiline
                numberOfLines={4}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <Text style={[styles.hintSub, { color: colors.textMuted, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl
                ? '💡 لا تقلق بشأن الصياغة الدقيقة؛ سيقوم الذكاء الاصطناعي بفهم المرادفات والأفكار المكتوبة.'
                : '💡 Express freely; AI will understand synonyms, phrasing, and partial insights.'}
            </Text>
          </View>
        )}

        {/* ── Mode 2: Multiple Choice Options ── */}
        {currentQ.type === 'multiple_choice' && currentQ.options && (
          <View style={styles.optionsList}>
            {currentQ.options.map((opt, i) => {
              const isSelected = isSilentMode
                ? currentSelectedChoice === opt
                : false;

              return (
                <Button
                  key={i}
                  title={opt}
                  variant={isSelected ? 'primary' : 'ghost'}
                  size="lg"
                  disabled={!isSilentMode && isAnswerSubmitted}
                  onPress={() => {
                    if (isSilentMode) {
                      handleSelectChoiceAnswer(opt);
                    } else {
                      handleAnswerSubmit(opt);
                    }
                  }}
                  style={{
                    marginBottom: spacing.md,
                    backgroundColor: isSelected ? colors.primary : colors.surfaceRaised,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }}
                />
              );
            })}
          </View>
        )}

        {/* ── Mode 3: True / False Buttons ── */}
        {currentQ.type === 'true_false' && (
          <View style={[styles.tfRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 10 }]}>
            <Button
              title={rtl ? 'صحيح' : 'True'}
              icon={<Ionicons name="checkmark-outline" size={20} color="#FFFFFF" />}
              variant={isSilentMode && currentSelectedChoice === 'True' ? 'primary' : 'ghost'}
              size="lg"
              disabled={!isSilentMode && isAnswerSubmitted}
              onPress={() => {
                if (isSilentMode) {
                  handleSelectChoiceAnswer('True');
                } else {
                  handleAnswerSubmit('True');
                }
              }}
              style={{ flex: 1 }}
            />
            <Button
              title={rtl ? 'خطأ' : 'False'}
              icon={<Ionicons name="close-outline" size={20} color="#FFFFFF" />}
              variant={isSilentMode && currentSelectedChoice === 'False' ? 'danger' : 'ghost'}
              size="lg"
              disabled={!isSilentMode && isAnswerSubmitted}
              onPress={() => {
                if (isSilentMode) {
                  handleSelectChoiceAnswer('False');
                } else {
                  handleAnswerSubmit('False');
                }
              }}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* ── Mode 4: Interactive Matching Game UI ── */}
        {currentQ.type === 'matching' && (
          <View style={styles.matchingContainer}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
              {rtl ? 'اضغط على مصطلح من اليمين ثم معناه المقابل' : 'Tap term on left, then matching definition on right'}
            </Text>

            <View style={[styles.matchingColumns, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 10 }]}>
              {/* Left Column */}
              <View style={styles.matchingCol}>
                {shuffledLeft.map((item) => {
                  const isMatched = matchedIds.has(item.id);
                  const isSelected = selectedLeft === item.id;
                  const isMismatch = mismatchedPair?.left === item.id;

                  let bgColor = colors.surfaceRaised;
                  let borderColor = colors.border;
                  let textColor = colors.text;

                  if (isMatched) {
                    bgColor = `${colors.primary}20`;
                    borderColor = colors.primary;
                    textColor = colors.primary;
                  } else if (isMismatch) {
                    bgColor = `${colors.error}20`;
                    borderColor = colors.error;
                  } else if (isSelected) {
                    bgColor = `${colors.accent}25`;
                    borderColor = colors.accent;
                  }

                  return (
                    <Pressable
                      key={item.id}
                      disabled={isMatched || isAnswerSubmitted}
                      onPress={() => handleMatchingLeftPress(item.id)}
                      style={[styles.matchingTile, { backgroundColor: bgColor, borderColor, opacity: isMatched ? 0.6 : 1 }]}
                    >
                      <Text style={[styles.matchingTileText, { color: textColor, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={3}>
                        {item.text}
                      </Text>
                      {isMatched && <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 4 }} />}
                    </Pressable>
                  );
                })}
              </View>

              {/* Right Column */}
              <View style={styles.matchingCol}>
                {shuffledRight.map((item) => {
                  const isMatched = matchedIds.has(item.id);
                  const isMismatch = mismatchedPair?.right === item.id;

                  let bgColor = colors.surfaceRaised;
                  let borderColor = colors.border;
                  let textColor = colors.text;

                  if (isMatched) {
                    bgColor = `${colors.primary}20`;
                    borderColor = colors.primary;
                    textColor = colors.primary;
                  } else if (isMismatch) {
                    bgColor = `${colors.error}20`;
                    borderColor = colors.error;
                  }

                  return (
                    <Pressable
                      key={item.id}
                      disabled={isMatched || isAnswerSubmitted}
                      onPress={() => handleMatchingRightPress(item.id)}
                      style={[styles.matchingTile, { backgroundColor: bgColor, borderColor, opacity: isMatched ? 0.6 : 1 }]}
                    >
                      <Text style={[styles.matchingTileText, { color: textColor, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={3}>
                        {item.text}
                      </Text>
                      {isMatched && <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 4 }} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── Bottom Navigation Controls for Silent / Written Quiz ── */}
      {isSilentMode && (
        <View
          style={[
            styles.silentNavFooter,
            {
              backgroundColor: colors.surfaceRaised,
              borderTopColor: colors.border,
              flexDirection: rtl ? 'row-reverse' : 'row',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          {/* Previous Button */}
          <Button
            title={rtl ? 'السابق' : 'Prev'}
            icon={<Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={18} color={currentIndex === 0 ? colors.textMuted : colors.text} />}
            variant="ghost"
            size="md"
            disabled={currentIndex === 0}
            onPress={handleNavPrev}
            style={{ minWidth: 84 }}
          />

          {/* Skip / Review indicator */}
          <Pressable
            onPress={handleNavNextOrSkip}
            hitSlop={8}
            style={styles.skipBtn}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
              {rtl ? 'تخطي' : 'Skip'}
            </Text>
          </Pressable>

          {/* Next or Finish Button */}
          {currentIndex + 1 < questions.length ? (
            <Button
              title={rtl ? 'التالي' : 'Next'}
              icon={<Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color="#FFFFFF" />}
              iconPosition="right"
              variant="primary"
              size="md"
              onPress={handleNavNextOrSkip}
              style={{ minWidth: 100 }}
            />
          ) : (
            <Button
              title={
                mode === 'written_ai' || mode === 'mixed'
                  ? rtl ? 'إنهاء وتصحيح' : 'Finish & Grade'
                  : rtl ? 'إنهاء الاختبار' : 'Finish Quiz'
              }
              variant="primary"
              size="md"
              onPress={handleFinishSilentQuiz}
              style={{ minWidth: 130 }}
            />
          )}
        </View>
      )}

      {/* ── Instant Duolingo-style Feedback Banner (for non-silent modes) ── */}
      {!isSilentMode && isAnswerSubmitted && (
        <View
          style={[
            styles.feedbackBanner,
            {
              backgroundColor: isCurrentCorrect ? colors.primaryLight : colors.errorLight,
              borderTopColor: isCurrentCorrect ? colors.primary : colors.error,
              padding: spacing.lg,
            },
          ]}
        >
          <View style={[styles.feedbackRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Ionicons
              name={isCurrentCorrect ? 'checkmark-circle' : 'close-circle'}
              size={32}
              color={isCurrentCorrect ? colors.primary : colors.error}
              style={{ marginHorizontal: 8 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: isCurrentCorrect ? colors.primaryPressed : colors.errorPressed,
                  fontSize: 18,
                  fontWeight: 'bold',
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {isCurrentCorrect
                  ? (rtl ? 'إجابة صحيحة! أحسنت!' : 'Correct! Excellent job!')
                  : mode === 'survival' && lives <= 0
                  ? (rtl ? 'انتهت جميع الأرواح! نهاية المحاولة' : 'Out of lives! Game Over')
                  : (rtl ? 'إجابة غير صحيحة' : 'Incorrect')}
              </Text>
              {!isCurrentCorrect && (
                <Text style={{ color: colors.text, fontSize: 14, marginTop: 4, textAlign: rtl ? 'right' : 'left' }}>
                  {rtl ? 'الإجابة الصحيحة: ' : 'Correct answer: '}
                  <Text style={{ fontWeight: 'bold' }}>{feedbackExpected}</Text>
                </Text>
              )}
            </View>
          </View>

          <Button
            title={
              mode === 'survival' && lives <= 0
                ? (rtl ? 'انتهت الأرواح - عرض النتيجة' : 'Out of Lives - View Results')
                : t('common.continue')
            }
            variant={isCurrentCorrect ? 'primary' : 'danger'}
            size="lg"
            fullWidth
            onPress={handleContinueNext}
            style={{ marginTop: spacing.md }}
          />
        </View>
      )}

      {/* ── AI Grading Progress Modal ── */}
      <Modal visible={isGrading} transparent animationType="fade">
        <View style={styles.gradingModalOverlay}>
          <Card style={[styles.gradingModalCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.gradingModalTitle, { color: colors.text }]}>
              {rtl ? 'جاري تصحيح إجاباتك بالذكاء الاصطناعي ✨' : 'Grading your answers with AI ✨'}
            </Text>
            <Text style={[styles.gradingModalSub, { color: colors.textSecondary }]}>
              {gradingStatus || (rtl ? 'جاري التدقيق والمقارنة الأكاديمية...' : 'Evaluating answers accurately...')}
            </Text>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 8,
  },
  progressBarWrapper: {
    flex: 1,
    marginHorizontal: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  bookmarkBtn: {
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  content: {},
  qTypeBadgeRow: {
    marginBottom: 10,
  },
  qTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  questionCard: {
    padding: 20,
    minHeight: 110,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
  },
  promptImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  promptText: {},
  tfBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  optionsList: {},
  tfRow: {},
  writtenContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  writtenInputBox: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    minHeight: 110,
  },
  writtenInput: {
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  hintSub: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  matchingContainer: {
    width: '100%',
  },
  matchingColumns: {
    width: '100%',
  },
  matchingCol: {
    flex: 1,
    gap: 8,
  },
  matchingTile: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchingTileText: {
    fontSize: 14,
    fontWeight: '600',
  },
  silentNavFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  feedbackBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 3,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  feedbackRow: {
    alignItems: 'center',
  },
  gradingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  gradingModalCard: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  gradingModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  gradingModalSub: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
});
