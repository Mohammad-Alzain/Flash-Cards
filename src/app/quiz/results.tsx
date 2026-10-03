import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, ProgressRing, Badge } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { quizRepository } from '../../core/db/repositories/quizRepository';

interface AnswerDetail {
  id: string;
  card_id: string;
  question_type: string;
  user_answer: string;
  correct_answer: string;
  is_correct: number;
  time_ms: number;
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

  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [answers, setAnswers] = useState<AnswerDetail[]>([]);

  useEffect(() => {
    if (attemptId) {
      quizRepository.getAttemptAnswers(attemptId).then((res) => {
        if (res && res.length > 0) {
          setAnswers(res as AnswerDetail[]);
        }
      }).catch(() => {});
    }
  }, [attemptId]);

  const scoreNum = parseInt(score, 10) || 0;
  const correctNum = parseInt(correct, 10) || 0;
  const totalNum = parseInt(total, 10) || 0;
  const xpNum = parseInt(xp, 10) || 0;
  const isPassed = scoreNum >= 70;

  const modeNameMap: Record<string, string> = {
    random: rtl ? 'اختبار عشوائي' : 'Random Quiz',
    exam: rtl ? 'نمط الامتحان' : 'Exam Mode',
    survival: rtl ? 'نمط البقاء' : 'Survival Mode',
    matching: rtl ? 'لعبة المطابقة' : 'Matching Game',
    match: rtl ? 'لعبة المطابقة' : 'Matching Game',
    mistakes: rtl ? 'دفتر الأخطاء' : 'Mistakes Review',
  };

  const displayModeName = modeNameMap[mode.toLowerCase()] || mode.toUpperCase();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={rtl ? 'نتائج الاختبار' : 'Quiz Results'}
        onBack={() => router.replace('/(tabs)/quiz')}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.xl }]}>
        <View style={styles.centerCol}>
          <View style={{ marginBottom: 12 }}>
            <Ionicons
              name={scoreNum >= 90 ? 'trophy' : isPassed ? 'ribbon' : 'fitness'}
              size={52}
              color={scoreNum >= 90 ? colors.gold : isPassed ? colors.primary : colors.accent}
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

          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
                fontSize: typography.sizes.sm,
                textAlign: 'center',
                marginTop: 4,
                marginBottom: spacing.xl,
              },
            ]}
          >
            {rtl ? `النمط: ${displayModeName}` : `Mode: ${displayModeName}`}
          </Text>

          {/* Circular Score Ring */}
          <ProgressRing
            progress={scoreNum / 100}
            size={120}
            strokeWidth={12}
            color={isPassed ? colors.primary : colors.warning}
            label={`${scoreNum}%`}
          />
        </View>

        {/* Stats Grid */}
        <View
          style={[
            styles.gridRow,
            { flexDirection: rtl ? 'row-reverse' : 'row', marginVertical: spacing.xl },
          ]}
        >
          <Card style={[styles.statBox, { flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {rtl ? 'الإجابات الصحيحة' : 'Correct Answers'}
            </Text>
            <Text style={{ color: colors.primary, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
              {correctNum} / {totalNum}
            </Text>
          </Card>

          <Card style={[styles.statBox, { flex: 1 }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {rtl ? 'نقاط الخبرة (XP)' : 'XP Earned'}
            </Text>
            <Text style={{ color: colors.gold, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
              +{xpNum} XP
            </Text>
          </Card>
        </View>

        {/* Question Breakdown List (if available) */}
        {answers.length > 0 && (
          <View style={{ width: '100%', marginBottom: spacing.xl }}>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.bold,
                textAlign: rtl ? 'right' : 'left',
                marginBottom: spacing.sm,
              }}
            >
              {rtl ? 'تفاصيل الإجابات:' : 'Answers Breakdown:'}
            </Text>

            {answers.map((ans, idx) => {
              const isCorrect = ans.is_correct === 1;
              return (
                <Card
                  key={ans.id || idx}
                  style={[
                    styles.answerCard,
                    {
                      borderColor: isCorrect ? colors.primary : colors.error,
                      backgroundColor: colors.surfaceRaised,
                      marginBottom: spacing.xs,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: rtl ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                      {rtl ? `السؤال ${idx + 1}` : `Question ${idx + 1}`}
                    </Text>
                    <Ionicons
                      name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={isCorrect ? colors.primary : colors.error}
                    />
                  </View>

                  <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 2 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {rtl ? 'إجابتك: ' : 'Your answer: '}
                    </Text>
                    <Text
                      style={{
                        color: isCorrect ? colors.primary : colors.error,
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}
                    >
                      {ans.user_answer || (rtl ? '(فارغ)' : '(empty)')}
                    </Text>
                  </View>

                  {!isCorrect && ans.correct_answer ? (
                    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 2 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {rtl ? 'الإجابة الصحيحة: ' : 'Correct answer: '}
                      </Text>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>
                        {ans.correct_answer}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.btnColumn}>
          {correctNum < totalNum && (
            <Button
              title={rtl ? 'مراجعة الأخطاء' : 'Practice Mistakes'}
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => router.replace('/quiz/play?mode=mistakes')}
              style={{ marginBottom: spacing.md }}
            />
          )}

          <Button
            title={rtl ? 'إعادة المحاولة' : 'Try Again'}
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.replace(`/quiz/play?mode=${mode}`)}
            style={{ marginBottom: spacing.md }}
          />

          <Button
            title={rtl ? 'العودة لشاشة الاختبارات' : 'Back to Quizzes'}
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => router.replace('/(tabs)/quiz')}
          />
        </View>
      </ScrollView>
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
  subtitle: {},
  gridRow: {
    width: '100%',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  answerCard: {
    borderLeftWidth: 4,
    borderRadius: 8,
  },
  btnColumn: {
    width: '100%',
  },
});
