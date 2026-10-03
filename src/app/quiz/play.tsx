import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Image,
} from 'react-native';
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

  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalDbCards, setTotalDbCards] = useState<number | null>(null);

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

  // Feedback State (Duolingo style)
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

  useEffect(() => {
    // Check total card count for empty state context
    cardRepository.getTotalCount().then(setTotalDbCards).catch(() => setTotalDbCards(0));

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
            : ['multiple_choice', 'true_false'],
      })
      .then((qs) => {
        setQuestions(qs);
        setLoading(false);
        questionStartTime.current = Date.now();
        quizStartTime.current = Date.now();
      });
  }, [mode, deckId, questionCount, params.questionField, params.answerField, params.smartFocus]);

  // Live Timer Countdown Hook
  useEffect(() => {
    if (!isTimerActive || loading || questions.length === 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch (e) {}
          Alert.alert(
            rtl ? 'انتهى الوقت!' : "Time's Up!",
            rtl ? 'انتهى الوقت المحدد للاختبار.' : 'The time limit for this quiz has expired.',
            [
              {
                text: rtl ? 'عرض النتائج' : 'View Results',
                onPress: () => finishQuiz(answersLogRef.current),
              },
            ],
            { cancelable: false }
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerActive, loading, questions.length, rtl]);

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
      // User must pick a left item first
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (e) {}
      return;
    }

    if (selectedLeft === pairId) {
      // Matched!
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
      // Mismatch
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

  const handleAnswerSubmit = async (userAns: string) => {
    if (!currentQ || isAnswerSubmitted) return;

    let isCorrect = false;
    let expected = currentQ.correctAnswer;

    if (currentQ.type === 'multiple_choice') {
      isCorrect = userAns === currentQ.correctAnswer;
    } else if (currentQ.type === 'true_false') {
      isCorrect = (userAns === 'True') === currentQ.tfIsCorrect;
      expected = currentQ.tfIsCorrect
        ? (rtl ? 'صحيح' : 'True')
        : (rtl ? 'خطأ' : 'False');
    } else if (currentQ.type === 'type_answer') {
      const checkRes = quizChecker.checkAnswer(userAns, currentQ.correctAnswer, true, true);
      isCorrect = checkRes.isCorrect;
    } else if (currentQ.type === 'matching') {
      isCorrect = true;
      expected = rtl ? 'تمت المطابقة بنجاح!' : 'All matched successfully!';
    }

    const duration = Date.now() - questionStartTime.current;

    // Haptics
    try {
      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e) {}

    // Record mistakes
    if (!isCorrect) {
      await mistakesManager.recordWrongAnswer(currentQ.cardId);
      if (mode === 'survival') {
        livesRef.current = Math.max(0, livesRef.current - 1);
        setLives(livesRef.current);
      }
    } else {
      await mistakesManager.recordCorrectAnswer(currentQ.cardId);
    }

    // Save to log ref and state
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

    // In Exam Mode: do not reveal feedback immediately, proceed directly
    if (mode === 'exam') {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((prev) => prev + 1);
        questionStartTime.current = Date.now();
      } else {
        finishQuiz(answersLogRef.current);
      }
      return;
    }

    setIsCurrentCorrect(isCorrect);
    setFeedbackExpected(expected);
    setIsAnswerSubmitted(true);
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

    // Check survival game over
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
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty State Handling with clear context & guidance
  if (!currentQ) {
    const isDbEmpty = totalDbCards === 0;
    const isMistakesMode = mode === 'mistakes';

    let emptyTitle = rtl
      ? 'لا توجد بطاقات كافية لإنشاء الاختبار'
      : 'Not enough cards to build a quiz';
    let emptyDesc = rtl
      ? 'تحتاج الرزمة إلى بطاقات تحتوي على نصوص واضحة في السؤال والجواب لإنشاء الاختبار.'
      : 'Cards need distinct front and back text fields to generate quiz questions.';

    if (isDbEmpty) {
      emptyTitle = rtl ? 'لا توجد بطاقات في مجموعتك بعد' : 'No cards found in your collection';
      emptyDesc = rtl
        ? 'يرجى استيراد رزمة من أنكي أو إضافة بطاقات يدوياً للبدء في خوض الاختبارات!'
        : 'Please import an Anki package or add cards manually to start testing!';
    } else if (isMistakesMode) {
      emptyTitle = rtl ? 'دفتر الأخطاء فارغ' : 'Mistakes Notebook is Empty';
      emptyDesc = rtl
        ? 'رائع! لم تسجل أي إجابات خاطئة بعد. العب أنماط الاختبار الأخرى لتجميع الملاحظات الصعبة.'
        : 'Awesome! No recorded mistakes yet. Play other quiz modes to build your notebook.';
    }

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: `${colors.primary}15`, marginBottom: spacing.lg },
            ]}
          >
            <Ionicons
              name={isMistakesMode ? 'checkmark-circle-outline' : 'albums-outline'}
              size={56}
              color={colors.primary}
            />
          </View>

          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.xl,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {emptyTitle}
          </Text>

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.sizes.sm,
              textAlign: 'center',
              lineHeight: 22,
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            {emptyDesc}
          </Text>

          <View style={{ width: '100%', maxWidth: 300, gap: 12 }}>
            {isDbEmpty && (
              <Button
                title={rtl ? 'استيراد رزمة (.apkg)' : 'Import Package (.apkg)'}
                variant="primary"
                size="md"
                icon={<Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />}
                onPress={() => router.push('/import')}
              />
            )}
            <Button
              title={t('common.back')}
              variant={isDbEmpty ? 'ghost' : 'primary'}
              size="md"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const progress = (currentIndex + 1) / questions.length;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Bar with Progress & Lives */}
      <View
        style={[
          styles.topBar,
          {
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.progressBarWrapper}>
          <ProgressBar progress={progress} height={8} color={colors.primary} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isTimerActive && (
            <View
              style={[
                styles.timerBadge,
                {
                  backgroundColor:
                    remainingSeconds <= 15 ? `${colors.error}20` : `${colors.primary}15`,
                  borderColor: remainingSeconds <= 15 ? colors.error : colors.primary,
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={remainingSeconds <= 15 ? colors.error : colors.primary}
              />
              <Text
                style={{
                  color: remainingSeconds <= 15 ? colors.error : colors.primary,
                  fontSize: 12,
                  fontWeight: 'bold',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatTime(remainingSeconds)}
              </Text>
            </View>
          )}

          {mode === 'survival' ? (
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
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
        {/* Question Prompt Card */}
        <Card style={[styles.questionCard, { marginBottom: spacing.xl }]}>
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
                  fontSize: currentQ.type === 'matching' ? typography.sizes.lg : typography.sizes.xl,
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
            <View style={[styles.tfBox, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
                {rtl ? 'الإجابة المعروضة:' : 'Presented Answer:'}
              </Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                "{currentQ.tfPresentedAnswer}"
              </Text>
            </View>
          )}
        </Card>

        {/* 1. Multiple Choice Options */}
        {currentQ.type === 'multiple_choice' && currentQ.options && (
          <View style={styles.optionsList}>
            {currentQ.options.map((opt, i) => (
              <Button
                key={i}
                title={opt}
                variant="ghost"
                size="lg"
                disabled={isAnswerSubmitted}
                onPress={() => handleAnswerSubmit(opt)}
                style={{
                  marginBottom: spacing.md,
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                }}
              />
            ))}
          </View>
        )}

        {/* 2. True / False Buttons */}
        {currentQ.type === 'true_false' && (
          <View style={[styles.tfRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Button
              title={rtl ? 'صحيح' : 'True'}
              icon={<Ionicons name="checkmark-outline" size={20} color="#FFFFFF" />}
              variant="primary"
              size="lg"
              disabled={isAnswerSubmitted}
              onPress={() => handleAnswerSubmit('True')}
              style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
            />
            <Button
              title={rtl ? 'خطأ' : 'False'}
              icon={<Ionicons name="close-outline" size={20} color="#FFFFFF" />}
              variant="danger"
              size="lg"
              disabled={isAnswerSubmitted}
              onPress={() => handleAnswerSubmit('False')}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* 4. Interactive Matching Game UI */}
        {currentQ.type === 'matching' && (
          <View style={styles.matchingContainer}>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              {rtl
                ? 'اضغط على مصطلح من اليمين ثم اضغط على معناه من اليسار'
                : 'Tap a term on the left, then tap its definition on the right'}
            </Text>

            <View style={[styles.matchingColumns, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              {/* Left Column (Terms) */}
              <View style={[styles.matchingCol, { marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }]}>
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
                      style={[
                        styles.matchingTile,
                        {
                          backgroundColor: bgColor,
                          borderColor,
                          opacity: isMatched ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.matchingTileText,
                          { color: textColor, textAlign: rtl ? 'right' : 'left' },
                        ]}
                        numberOfLines={3}
                      >
                        {item.text}
                      </Text>
                      {isMatched && (
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 4 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Right Column (Definitions / Meanings) */}
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
                      style={[
                        styles.matchingTile,
                        {
                          backgroundColor: bgColor,
                          borderColor,
                          opacity: isMatched ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.matchingTileText,
                          { color: textColor, textAlign: rtl ? 'right' : 'left' },
                        ]}
                        numberOfLines={3}
                      >
                        {item.text}
                      </Text>
                      {isMatched && (
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 4 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Duolingo-style Feedback Banner */}
      {isAnswerSubmitted && (
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
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 14,
                    marginTop: 4,
                    textAlign: rtl ? 'right' : 'left',
                  }}
                >
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
    marginHorizontal: 16,
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
  content: {},
  questionCard: {
    padding: 24,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
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
});
