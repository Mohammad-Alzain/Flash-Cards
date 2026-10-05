import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, ProgressRing, Badge } from '../../components/ui';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Ionicons } from '@expo/vector-icons';
import { quizRepository } from '../../core/db/repositories/quizRepository';
import { mistakesManager } from '../../core/quiz/mistakesManager';
import { cleanTextForQuiz } from '../../core/quiz/generator';

interface AnswerDetail {
  id: string;
  card_id: string;
  question_type: string;
  user_answer: string;
  correct_answer: string;
  is_correct: number;
  time_ms: number;
  ai_answer?: string | null;
  ai_verdict?: 'correct' | 'partial' | 'incorrect' | null;
  ai_score?: number | null;
  ai_feedback?: string | null;
  ai_tip?: string | null;
  ai_confidence?: number | null;
  manual_override?: 'correct' | 'partial' | 'incorrect' | null;
  is_marked_for_review?: number;
  fields_json?: string | null;
}

type FilterType = 'all' | 'incorrect' | 'partial' | 'correct';

function extractQuestionPrompt(fieldsJson?: string | null): string {
  if (!fieldsJson) return '';
  try {
    const parsed = JSON.parse(fieldsJson);
    if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed);
      const promptKey =
        keys.find((k) => /front|question|سؤال|المقدمة/i.test(k)) || keys[0];
      if (promptKey && parsed[promptKey]) {
        return cleanTextForQuiz(String(parsed[promptKey]));
      }
    }
  } catch {}
  return '';
}

export default function QuizResultsScreen() {
  const {
    score = '0',
    correct = '0',
    total = '0',
    xp = '0',
    mode = 'random',
    attemptId,
  } = useLocalSearchParams<{
    score?: string;
    correct?: string;
    total?: string;
    xp?: string;
    mode?: string;
    attemptId?: string;
  }>();

  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [answers, setAnswers] = useState<AnswerDetail[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [currentScore, setCurrentScore] = useState<number>(parseInt(score, 10) || 0);
  const [currentCorrect, setCurrentCorrect] = useState<number>(parseInt(correct, 10) || 0);
  const [currentXp, setCurrentXp] = useState<number>(parseInt(xp, 10) || 0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Manual Override Modal state
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [selectedAnswerForOverride, setSelectedAnswerForOverride] = useState<AnswerDetail | null>(null);
  const [overrideVerdict, setOverrideVerdict] = useState<'correct' | 'partial' | 'incorrect'>('correct');
  const [overridePartialScore, setOverridePartialScore] = useState<number>(0.5);

  useEffect(() => {
    if (attemptId) {
      // 1. Fetch Attempt record (for aiSummary and metadata)
      quizRepository.getAttemptById(attemptId).then((attempt) => {
        if (attempt?.ai_summary_json) {
          setAiSummary(attempt.ai_summary_json);
        }
      }).catch(() => {});

      // 2. Fetch Answers
      quizRepository
        .getAttemptAnswers(attemptId)
        .then((res) => {
          if (res && res.length > 0) {
            const list = res as AnswerDetail[];
            setAnswers(list);

            // Expand wrong/partial questions by default, or first two
            const initialExpanded = new Set<string>();
            let expandedCount = 0;
            list.forEach((ans) => {
              const isNotFullCorrect =
                ans.ai_verdict === 'incorrect' ||
                ans.ai_verdict === 'partial' ||
                ans.is_correct === 0;
              if (isNotFullCorrect && expandedCount < 5) {
                initialExpanded.add(ans.id);
                expandedCount++;
              }
            });
            if (initialExpanded.size === 0 && list.length > 0) {
              initialExpanded.add(list[0].id);
              if (list[1]) initialExpanded.add(list[1].id);
            }
            setExpandedIds(initialExpanded);
          }
        })
        .catch((err) => console.error('[QuizResults] Error loading answers:', err));
    }
  }, [attemptId]);

  const totalNum = parseInt(total, 10) || answers.length || 0;
  const isPassed = currentScore >= 70;

  // Counts for filters
  const counts = useMemo(() => {
    let corr = 0;
    let part = 0;
    let incorr = 0;

    answers.forEach((a) => {
      const verdict = a.ai_verdict;
      if (verdict === 'correct') {
        corr++;
      } else if (verdict === 'partial') {
        part++;
      } else if (verdict === 'incorrect') {
        incorr++;
      } else {
        if (a.is_correct === 1) corr++;
        else incorr++;
      }
    });

    return { all: answers.length, correct: corr, partial: part, incorrect: incorr };
  }, [answers]);

  const filteredAnswers = useMemo(() => {
    return answers.filter((a) => {
      const v = a.ai_verdict;
      if (filter === 'all') return true;
      if (filter === 'correct') return v === 'correct' || (v === null && a.is_correct === 1);
      if (filter === 'partial') return v === 'partial';
      if (filter === 'incorrect') return v === 'incorrect' || (v === null && a.is_correct === 0);
      return true;
    });
  }, [answers, filter]);

  const modeNameMap: Record<string, string> = {
    random: rtl ? 'اختبار عشوائي' : 'Random Quiz',
    exam: rtl ? 'نمط الامتحان' : 'Exam Mode',
    survival: rtl ? 'نمط البقاء' : 'Survival Mode',
    matching: rtl ? 'لعبة المطابقة' : 'Matching Game',
    match: rtl ? 'لعبة المطابقة' : 'Matching Game',
    mistakes: rtl ? 'دفتر الأخطاء' : 'Mistakes Review',
    written_ai: rtl ? 'اختبار كتابي بالذكاء الاصطناعي' : 'AI Graded Written Quiz',
    mixed: rtl ? 'اختبار مختلط' : 'Mixed Quiz',
  };

  const displayModeName = modeNameMap[mode.toLowerCase()] || mode.toUpperCase();

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Open override modal
  const handleOpenOverride = (ans: AnswerDetail) => {
    setSelectedAnswerForOverride(ans);
    setOverrideVerdict(ans.ai_verdict || (ans.is_correct === 1 ? 'correct' : 'incorrect'));
    setOverridePartialScore(ans.ai_score || 0.5);
    setOverrideModalVisible(true);
  };

  // Confirm manual override
  const handleConfirmOverride = async () => {
    if (!selectedAnswerForOverride || !attemptId) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      let scoreToApply = 0;
      if (overrideVerdict === 'correct') scoreToApply = 1.0;
      else if (overrideVerdict === 'partial') scoreToApply = overridePartialScore;
      else scoreToApply = 0.0;

      // 1. Update SQLite answer record
      await quizRepository.updateAnswerManualVerdict(
        selectedAnswerForOverride.id,
        overrideVerdict,
        scoreToApply
      );

      // 2. Recalculate Attempt overall score
      const updated = await quizRepository.recalculateAttemptScore(attemptId);
      setCurrentScore(updated.score);
      setCurrentCorrect(updated.correct);
      setCurrentXp(Math.round(updated.correct * 15));

      // 3. Update local answers state
      setAnswers((prev) =>
        prev.map((item) =>
          item.id === selectedAnswerForOverride.id
            ? {
                ...item,
                manual_override: overrideVerdict,
                ai_verdict: overrideVerdict,
                ai_score: scoreToApply,
                is_correct: overrideVerdict === 'correct' ? 1 : 0,
              }
            : item
        )
      );

      setOverrideModalVisible(false);
      setSelectedAnswerForOverride(null);
    } catch (e) {
      console.error('[QuizResults] Error updating manual verdict:', e);
      CustomAlert.alert(
        rtl ? 'خطأ' : 'Error',
        rtl ? 'تعذر حفظ التعديل يدوياً.' : 'Failed to update manual verdict.'
      );
    }
  };

  // Bulk add mistakes to notebook
  const handleAddMistakesToBank = async () => {
    const wrongCards = answers.filter(
      (a) => a.ai_verdict === 'incorrect' || a.ai_verdict === 'partial' || a.is_correct === 0
    );

    if (wrongCards.length === 0) {
      CustomAlert.alert(
        rtl ? 'ممتاز!' : 'Awesome!',
        rtl ? 'لا توجد أخطاء في هذا الاختبار لإضافتها!' : 'No mistakes to add from this quiz!'
      );
      return;
    }

    try {
      for (const item of wrongCards) {
        await mistakesManager.recordWrongAnswer(item.card_id);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      CustomAlert.alert(
        rtl ? 'تم الحفظ في دفتر الأخطاء' : 'Saved to Mistakes Notebook',
        rtl
          ? `تم تسجيل ${wrongCards.length} بطاقة في دفتر الأخطاء لمراجعتها والتركيز عليها لاحقاً.`
          : `Added ${wrongCards.length} cards to your Mistakes Notebook for focused practice.`
      );
    } catch (e) {
      console.error('[QuizResults] Error saving mistakes:', e);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <Header
        title={rtl ? 'نتائج الاختبار' : 'Quiz Results'}
        onBack={() => router.replace('/(tabs)/quiz')}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Top Trophy / Badge & Score Header */}
        <View style={styles.centerCol}>
          <View style={{ marginBottom: spacing.sm }}>
            <Ionicons
              name={currentScore >= 90 ? 'trophy' : isPassed ? 'ribbon' : 'fitness'}
              size={54}
              color={currentScore >= 90 ? colors.gold : isPassed ? colors.primary : colors.accent}
            />
          </View>

          <Text
            style={[
              styles.heading,
              {
                color: colors.text,
                fontSize: typography.sizes.xxl,
                fontWeight: typography.weights.extrabold,
                textAlign: 'center',
              },
            ]}
          >
            {isPassed
              ? (rtl ? 'عمل رائع ومتميز!' : 'Great Job!')
              : (rtl ? 'واصل التدريب والمحاولة!' : 'Keep Practicing!')}
          </Text>

          <View style={[styles.modeBadge, { backgroundColor: colors.surfaceRaised, borderRadius: radius.full }]}>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
              }}
            >
              {displayModeName}
            </Text>
          </View>

          {/* Circular Score Ring */}
          <View style={{ marginVertical: spacing.md }}>
            <ProgressRing
              progress={currentScore / 100}
              size={126}
              strokeWidth={12}
              color={isPassed ? colors.primary : colors.warning}
              label={`${currentScore}%`}
            />
          </View>
        </View>

        {/* 4 Stats Grid Cards */}
        <View
          style={[
            styles.statsGrid,
            { flexDirection: rtl ? 'row-reverse' : 'row', gap: spacing.sm, marginVertical: spacing.md },
          ]}
        >
          <Card style={[styles.statBox, { flex: 1, backgroundColor: colors.surface }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
              {rtl ? 'صحيحة' : 'Correct'}
            </Text>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold', marginTop: 2 }}>
              {counts.correct}
            </Text>
          </Card>

          <Card style={[styles.statBox, { flex: 1, backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
              {rtl ? 'جزئية' : 'Partial'}
            </Text>
            <Text style={{ color: colors.warning, fontSize: 18, fontWeight: 'bold', marginTop: 2 }}>
              {counts.partial}
            </Text>
          </Card>

          <Card style={[styles.statBox, { flex: 1, backgroundColor: colors.surface }]}>
            <Ionicons name="close-circle" size={20} color={colors.error} />
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
              {rtl ? 'خاطئة' : 'Incorrect'}
            </Text>
            <Text style={{ color: colors.error, fontSize: 18, fontWeight: 'bold', marginTop: 2 }}>
              {counts.incorrect}
            </Text>
          </Card>

          <Card style={[styles.statBox, { flex: 1, backgroundColor: colors.surface }]}>
            <Ionicons name="flash" size={20} color={colors.gold} />
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
              {rtl ? 'نقاط XP' : 'XP'}
            </Text>
            <Text style={{ color: colors.gold, fontSize: 18, fontWeight: 'bold', marginTop: 2 }}>
              +{currentXp}
            </Text>
          </Card>
        </View>

        {/* AI Diagnostic Summary Card (If available) */}
        {aiSummary ? (
          <Card
            style={[
              styles.aiSummaryCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.accent,
                borderWidth: 1.5,
                borderRadius: radius.lg,
                padding: spacing.md,
                marginBottom: spacing.lg,
                width: '100%',
              },
            ]}
          >
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: spacing.xs,
                marginBottom: spacing.xs,
              }}
            >
              <Ionicons name="sparkles" size={20} color={colors.accent} />
              <Text
                style={{
                  color: colors.accent,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.bold,
                }}
              >
                {rtl ? 'التحليل التشخيصي العام من الذكاء الاصطناعي' : 'AI Diagnostic Performance Analysis'}
              </Text>
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.sm,
                lineHeight: 22,
                textAlign: rtl ? 'right' : 'left',
              }}
            >
              {aiSummary}
            </Text>
          </Card>
        ) : null}

        {/* Filters Header & Segmented Chips */}
        <View style={{ width: '100%', marginBottom: spacing.md }}>
          <View
            style={{
              flexDirection: rtl ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.xs,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.bold,
              }}
            >
              {rtl ? 'تفاصيل ومقارنة الإجابات' : 'Answers & Comparisons'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: typography.sizes.xs }}>
              {rtl ? `${filteredAnswers.length} من ${answers.length}` : `${filteredAnswers.length} of ${answers.length}`}
            </Text>
          </View>

          {/* Filter Chips Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: rtl ? 'row-reverse' : 'row',
              gap: 8,
              paddingVertical: 4,
            }}
          >
            <Pressable
              onPress={() => setFilter('all')}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === 'all' ? colors.primary : colors.surface,
                  borderColor: filter === 'all' ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: filter === 'all' ? '#FFF' : colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontWeight: filter === 'all' ? 'bold' : 'normal',
                }}
              >
                {rtl ? `الكل (${counts.all})` : `All (${counts.all})`}
              </Text>
            </Pressable>

            {counts.incorrect > 0 && (
              <Pressable
                onPress={() => setFilter('incorrect')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filter === 'incorrect' ? colors.error : colors.surface,
                    borderColor: filter === 'incorrect' ? colors.error : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: filter === 'incorrect' ? '#FFF' : colors.error,
                    fontSize: typography.sizes.xs,
                    fontWeight: filter === 'incorrect' ? 'bold' : 'normal',
                  }}
                >
                  {rtl ? `الخاطئة (${counts.incorrect})` : `Incorrect (${counts.incorrect})`}
                </Text>
              </Pressable>
            )}

            {counts.partial > 0 && (
              <Pressable
                onPress={() => setFilter('partial')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filter === 'partial' ? colors.warning : colors.surface,
                    borderColor: filter === 'partial' ? colors.warning : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: filter === 'partial' ? '#000' : colors.warning,
                    fontSize: typography.sizes.xs,
                    fontWeight: filter === 'partial' ? 'bold' : 'normal',
                  }}
                >
                  {rtl ? `الجزئية (${counts.partial})` : `Partial (${counts.partial})`}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => setFilter('correct')}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === 'correct' ? colors.primary : colors.surface,
                  borderColor: filter === 'correct' ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: filter === 'correct' ? '#FFF' : colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  fontWeight: filter === 'correct' ? 'bold' : 'normal',
                }}
              >
                {rtl ? `الصحيحة (${counts.correct})` : `Correct (${counts.correct})`}
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Answers List with 3-Way Comparison */}
        <View style={{ width: '100%', marginBottom: spacing.xl }}>
          {filteredAnswers.map((ans, idx) => {
            const isExpanded = expandedIds.has(ans.id);
            const promptText = extractQuestionPrompt(ans.fields_json);

            // Determine verdict styling
            const verdict = ans.ai_verdict;
            const isFullCorrect = verdict === 'correct' || (verdict === null && ans.is_correct === 1);
            const isPartial = verdict === 'partial';
            const isWrong = verdict === 'incorrect' || (verdict === null && ans.is_correct === 0);

            const accentColor = isFullCorrect
              ? colors.primary
              : isPartial
              ? colors.warning
              : colors.error;

            const verdictLabel = isFullCorrect
              ? (rtl ? 'صحيحة' : 'Correct')
              : isPartial
              ? (rtl ? `جزئية (${Math.round((ans.ai_score || 0.5) * 100)}%)` : `Partial (${Math.round((ans.ai_score || 0.5) * 100)}%)`)
              : (rtl ? 'غير صحيحة' : 'Incorrect');

            return (
              <Card
                key={ans.id || idx}
                style={[
                  styles.answerCard,
                  {
                    borderColor: accentColor,
                    borderLeftWidth: rtl ? 0 : 4,
                    borderRightWidth: rtl ? 4 : 0,
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: radius.md,
                    marginBottom: spacing.md,
                    padding: spacing.md,
                  },
                ]}
              >
                {/* Header Row: Question #, Type Badge, Review Star, Verdict Badge, Expand Arrow */}
                <Pressable
                  onPress={() => toggleExpand(ans.id)}
                  style={{
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      flexDirection: rtl ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: typography.sizes.sm,
                        fontWeight: typography.weights.bold,
                      }}
                    >
                      {rtl ? `السؤال ${idx + 1}` : `Q${idx + 1}`}
                    </Text>

                    {ans.is_marked_for_review === 1 && (
                      <Ionicons name="bookmark" size={16} color={colors.warning} />
                    )}

                    {ans.question_type === 'type_answer' && (
                      <Badge
                        label={rtl ? 'كتابي' : 'Written'}
                        variant="accent"
                        size="sm"
                      />
                    )}

                    {ans.manual_override && (
                      <Badge
                        label={rtl ? 'معدل يدوياً' : 'Overridden'}
                        variant="warning"
                        size="sm"
                      />
                    )}
                  </View>

                  <View
                    style={{
                      flexDirection: rtl ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}40`,
                        borderWidth: 1,
                        borderRadius: radius.full,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          color: accentColor,
                          fontSize: typography.sizes.xs,
                          fontWeight: typography.weights.bold,
                        }}
                      >
                        {verdictLabel}
                      </Text>
                    </View>

                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                </Pressable>

                {/* Prompt preview if available */}
                {promptText ? (
                  <View style={{ marginTop: spacing.xs, marginBottom: spacing.xs }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: typography.sizes.md,
                        fontWeight: typography.weights.semibold,
                        textAlign: rtl ? 'right' : 'left',
                      }}
                    >
                      {promptText}
                    </Text>
                  </View>
                ) : null}

                {/* Expanded Details: 3-Way Comparison */}
                {isExpanded && (
                  <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                    {/* 1. إجابتي (User Answer) */}
                    <View
                      style={[
                        styles.comparisonBox,
                        {
                          backgroundColor: colors.surface,
                          borderColor: accentColor,
                          borderWidth: 1,
                          borderRadius: radius.sm,
                          padding: spacing.sm,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: rtl ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <Ionicons name="person-outline" size={16} color={accentColor} />
                        <Text
                          style={{
                            color: accentColor,
                            fontSize: typography.sizes.xs,
                            fontWeight: typography.weights.bold,
                          }}
                        >
                          {rtl ? 'إجابتي:' : 'My Answer:'}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: typography.sizes.sm,
                          fontWeight: typography.weights.medium,
                          textAlign: rtl ? 'right' : 'left',
                        }}
                      >
                        {ans.user_answer ? ans.user_answer : (rtl ? '(فارغ / لم يُجب)' : '(Empty / Skipped)')}
                      </Text>
                    </View>

                    {/* 2. الإجابة المرجعية للبطاقة (Card Answer) */}
                    <View
                      style={[
                        styles.comparisonBox,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderRadius: radius.sm,
                          padding: spacing.sm,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: rtl ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <Ionicons name="card-outline" size={16} color={colors.primary} />
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: typography.sizes.xs,
                            fontWeight: typography.weights.bold,
                          }}
                        >
                          {rtl ? 'إجابة البطاقة الحقيقية:' : 'Card Real Answer:'}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: typography.sizes.sm,
                          fontWeight: typography.weights.medium,
                          textAlign: rtl ? 'right' : 'left',
                        }}
                      >
                        {cleanTextForQuiz(ans.correct_answer)}
                      </Text>
                    </View>

                    {/* 3. تقييم الذكاء الاصطناعي (AI Evaluation) */}
                    {(ans.ai_answer || ans.ai_feedback) && (
                      <View
                        style={[
                          styles.aiFeedbackBox,
                          {
                            backgroundColor: colors.surfaceRaised,
                            borderColor: colors.accent,
                            borderWidth: 1.5,
                            borderRadius: radius.sm,
                            padding: spacing.sm,
                          },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: rtl ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: spacing.xs,
                          }}
                        >
                          <Ionicons name="sparkles" size={16} color={colors.accent} />
                          <Text
                            style={{
                              color: colors.accent,
                              fontSize: typography.sizes.xs,
                              fontWeight: typography.weights.bold,
                            }}
                          >
                            {rtl ? 'تقييم الذكاء الاصطناعي:' : 'AI Evaluation:'}
                          </Text>
                          {ans.ai_confidence !== undefined && ans.ai_confidence !== null && (
                            <Text
                              style={{
                                color: colors.textMuted,
                                fontSize: 10,
                                marginStart: 'auto',
                              }}
                            >
                              {rtl ? `ثقة: ${Math.round(ans.ai_confidence * 100)}%` : `Conf: ${Math.round(ans.ai_confidence * 100)}%`}
                            </Text>
                          )}
                        </View>

                        {/* AI Independent Answer */}
                        {ans.ai_answer ? (
                          <View style={{ marginBottom: spacing.xs }}>
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 11,
                                fontWeight: typography.weights.semibold,
                                textAlign: rtl ? 'right' : 'left',
                              }}
                            >
                              {rtl ? 'إجابة النموذج المستقلة:' : "AI's Independent Answer:"}
                            </Text>
                            <Text
                              style={{
                                color: colors.text,
                                fontSize: typography.sizes.xs,
                                fontStyle: 'italic',
                                textAlign: rtl ? 'right' : 'left',
                                marginTop: 2,
                              }}
                            >
                              {ans.ai_answer}
                            </Text>
                          </View>
                        ) : null}

                        {/* AI Feedback / Explanation */}
                        {ans.ai_feedback ? (
                          <View style={{ marginBottom: spacing.xs }}>
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 11,
                                fontWeight: typography.weights.semibold,
                                textAlign: rtl ? 'right' : 'left',
                              }}
                            >
                              {rtl ? 'الشرح والتحليل:' : 'Feedback & Reasoning:'}
                            </Text>
                            <Text
                              style={{
                                color: colors.text,
                                fontSize: typography.sizes.xs,
                                lineHeight: 18,
                                textAlign: rtl ? 'right' : 'left',
                                marginTop: 2,
                              }}
                            >
                              {ans.ai_feedback}
                            </Text>
                          </View>
                        ) : null}

                        {/* AI Tip / Mnemonic */}
                        {ans.ai_tip ? (
                          <View
                            style={{
                              backgroundColor: colors.surface,
                              borderRadius: radius.sm,
                              padding: spacing.xs,
                              marginTop: 2,
                              flexDirection: rtl ? 'row-reverse' : 'row',
                              alignItems: 'flex-start',
                              gap: 6,
                            }}
                          >
                            <Ionicons name="bulb-outline" size={16} color={colors.gold} />
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: typography.sizes.xs,
                                flex: 1,
                                textAlign: rtl ? 'right' : 'left',
                              }}
                            >
                              {ans.ai_tip}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    )}

                    {/* Manual Override Action Button */}
                    <View
                      style={{
                        flexDirection: rtl ? 'row-reverse' : 'row',
                        justifyContent: 'flex-end',
                        marginTop: spacing.xs,
                      }}
                    >
                      <Pressable
                        onPress={() => handleOpenOverride(ans)}
                        style={({ pressed }) => [
                          styles.overrideBtn,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Ionicons name="options-outline" size={15} color={colors.primary} />
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: typography.sizes.xs,
                            fontWeight: typography.weights.bold,
                          }}
                        >
                          {rtl ? 'تعديل الحكم يدوياً' : 'Override Verdict'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
        </View>

        {/* Action Buttons Section */}
        <View style={styles.actionsContainer}>
          {counts.incorrect > 0 ? (
            <Card
              style={[
                styles.mistakesActionCard,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: `${colors.warning}40`,
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: spacing.sm,
                }}
              >
                <Ionicons name="bookmark" size={18} color={colors.warning} />
                <Text
                  style={{
                    color: colors.text,
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.bold,
                  }}
                >
                  {rtl
                    ? `لديك ${counts.incorrect} إجابة خاطئة تحتاج لمتابعة`
                    : `You have ${counts.incorrect} mistakes to review`}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  gap: spacing.sm,
                }}
              >
                <Button
                  title={rtl ? 'تصفية الأخطاء' : 'Filter Mistakes'}
                  variant="secondary"
                  size="md"
                  onPress={() => setFilter('incorrect')}
                  style={{ flex: 1 }}
                />
                <Button
                  title={rtl ? 'حفظ بالدفتر' : 'Save to Notebook'}
                  variant="ghost"
                  size="md"
                  onPress={handleAddMistakesToBank}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ) : (
            <View
              style={[
                styles.perfectBanner,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: `${colors.primary}30`,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: spacing.sm,
                  marginBottom: spacing.md,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                },
              ]}
            >
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.bold,
                }}
              >
                {rtl ? 'أداء متميز وخالٍ من الأخطاء' : 'Perfect score with no mistakes'}
              </Text>
            </View>
          )}

          {/* Main Navigation Actions: Side by Side */}
          <View
            style={[
              styles.navActionsRow,
              {
                flexDirection: rtl ? 'row-reverse' : 'row',
                gap: spacing.sm,
              },
            ]}
          >
            <Button
              title={rtl ? 'إعادة الاختبار' : 'Try Again'}
              variant="primary"
              size="lg"
              onPress={() => router.replace(`/quiz/play?mode=${mode}`)}
              style={{ flex: 1 }}
            />

            <Button
              title={rtl ? 'قائمة الاختبارات' : 'All Quizzes'}
              variant="secondary"
              size="lg"
              onPress={() => router.replace('/(tabs)/quiz')}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Manual Override Modal Dialog */}
      <Modal
        visible={overrideModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOverrideModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.sm,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                }}
              >
                {rtl ? 'تعديل حكم الإجابة يدوياً' : 'Manual Override'}
              </Text>
              <Pressable onPress={() => setOverrideModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.sm,
                textAlign: rtl ? 'right' : 'left',
                marginBottom: spacing.md,
              }}
            >
              {rtl
                ? 'إذا رأيت أن تصحيح الذكاء الاصطناعي ظلم إجابتك أو تساهل معها، اختر الحكم المناسب وسيتم تحديث نتيجتك فوراً:'
                : 'If you feel the AI grading was too strict or too lenient, adjust the verdict here:'}
            </Text>

            {/* Verdict Selection Options */}
            <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
              {/* Option 1: Correct */}
              <TouchableOpacity
                onPress={() => setOverrideVerdict('correct')}
                style={[
                  styles.verdictOption,
                  {
                    borderColor: overrideVerdict === 'correct' ? colors.primary : colors.border,
                    backgroundColor:
                      overrideVerdict === 'correct' ? colors.primaryLight : colors.surfaceRaised,
                    flexDirection: rtl ? 'row-reverse' : 'row',
                  },
                ]}
              >
                <Ionicons
                  name={overrideVerdict === 'correct' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={colors.primary}
                />
                <View style={{ flex: 1, marginHorizontal: spacing.xs }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: typography.weights.bold,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {rtl ? 'صحيحة تماماً (درجة كاملة 100%)' : 'Fully Correct (100% Score)'}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {rtl ? 'تُحسب كإجابة صحيحة وتمنحك النقاط كاملة.' : 'Full points awarded.'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Partial */}
              <TouchableOpacity
                onPress={() => setOverrideVerdict('partial')}
                style={[
                  styles.verdictOption,
                  {
                    borderColor: overrideVerdict === 'partial' ? colors.warning : colors.border,
                    backgroundColor:
                      overrideVerdict === 'partial' ? 'rgba(245, 158, 11, 0.15)' : colors.surfaceRaised,
                    flexDirection: rtl ? 'row-reverse' : 'row',
                  },
                ]}
              >
                <Ionicons
                  name={overrideVerdict === 'partial' ? 'alert-circle' : 'ellipse-outline'}
                  size={22}
                  color={colors.warning}
                />
                <View style={{ flex: 1, marginHorizontal: spacing.xs }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: typography.weights.bold,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {rtl ? 'صحيحة جزئياً (نصف الدرجة 50%)' : 'Partially Correct (50% Score)'}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {rtl ? 'الإجابة قريبة أو ينقصها تفصيل.' : 'Close answer, minor detail missing.'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: Incorrect */}
              <TouchableOpacity
                onPress={() => setOverrideVerdict('incorrect')}
                style={[
                  styles.verdictOption,
                  {
                    borderColor: overrideVerdict === 'incorrect' ? colors.error : colors.border,
                    backgroundColor:
                      overrideVerdict === 'incorrect' ? 'rgba(239, 68, 68, 0.15)' : colors.surfaceRaised,
                    flexDirection: rtl ? 'row-reverse' : 'row',
                  },
                ]}
              >
                <Ionicons
                  name={overrideVerdict === 'incorrect' ? 'close-circle' : 'ellipse-outline'}
                  size={22}
                  color={colors.error}
                />
                <View style={{ flex: 1, marginHorizontal: spacing.xs }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: typography.weights.bold,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {rtl ? 'غير صحيحة (0%)' : 'Incorrect (0% Score)'}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {rtl ? 'تحتاج إلى مراجعة وتدريب إضافي.' : 'Zero points awarded.'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Modal Actions */}
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                gap: spacing.sm,
              }}
            >
              <Button
                title={rtl ? 'حفظ التعديل' : 'Save Override'}
                variant="primary"
                size="md"
                onPress={handleConfirmOverride}
                style={{ flex: 1 }}
              />
              <Button
                title={rtl ? 'إلغاء' : 'Cancel'}
                variant="ghost"
                size="md"
                onPress={() => setOverrideModalVisible(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
  },
  centerCol: {
    alignItems: 'center',
  },
  heading: {},
  modeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 6,
    marginBottom: 8,
  },
  statsGrid: {
    width: '100%',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  aiSummaryCard: {},
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  answerCard: {
    borderLeftWidth: 4,
  },
  comparisonBox: {},
  aiFeedbackBox: {},
  overrideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionsContainer: {
    width: '100%',
    marginTop: 4,
  },
  mistakesActionCard: {},
  perfectBanner: {},
  navActionsRow: {
    width: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  verdictOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
});
