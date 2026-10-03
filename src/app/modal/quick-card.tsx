import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Card, Button } from '../../components/ui';
import { queueBuilder, StudyCardItem } from '../../core/scheduler/queueBuilder';
import { Rating } from '../../core/scheduler/types';
import { cleanTextForQuiz } from '../../core/quiz/generator';

export default function QuickCardModal() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const rtl = isRTL();

  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<StudyCardItem | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Try getting a due review card first, fallback to new learning card
        const queue = await queueBuilder.buildReviewQueue(undefined, undefined, 'due');
        if (queue.length > 0) {
          setCard(queue[0]);
        } else {
          const newQueue = await queueBuilder.buildLearnQueue(undefined, 1);
          if (newQueue.length > 0) {
            setCard(newQueue[0]);
          }
        }
      } catch (e) {
        console.warn('Failed to load quick card:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAnswer = async (rating: Rating) => {
    if (!card || answered) return;
    setAnswered(true);

    try {
      Haptics.notificationAsync(
        rating === Rating.Good
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    } catch {}

    await queueBuilder.answerCard(card, rating, 4000);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerBox}>
          <Ionicons name="checkmark-done-circle" size={64} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>
            {rtl ? 'رائع! لا توجد بطاقات مستحقة الآن' : 'Awesome! No due cards right now'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {rtl ? 'لقد أكملت جميع مراجعاتك لهذا الوقت' : 'All your reviews are up to date.'}
          </Text>
          <Button
            title={rtl ? 'متابعة إلى الرئيسية' : 'Continue to Home'}
            onPress={() => router.back()}
            style={{ marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const prompt = cleanTextForQuiz(
    card.note_fields?.Front || Object.values(card.note_fields || {})[0] || 'سؤال'
  );
  const answer = cleanTextForQuiz(
    card.note_fields?.Back || Object.values(card.note_fields || {})[1] || 'الجواب'
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="flash" size={18} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {rtl ? 'سؤال فتح الهاتف السريع' : 'Quick Unlock Card'}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
            {rtl ? 'تخطي الآن ✕' : 'Skip ✕'}
          </Text>
        </Pressable>
      </View>

      {/* Card Body */}
      <View style={styles.content}>
        <Pressable
          onPress={() => setIsFlipped(!isFlipped)}
          style={({ pressed }) => [
            styles.cardWrapper,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              opacity: pressed ? 0.95 : 1,
            },
          ]}
        >
          <View style={styles.tagBadge}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
              {card.deck_name || 'بطاقة المراجعة'}
            </Text>
          </View>

          <Text style={[styles.sideLabel, { color: colors.textSecondary }]}>
            {isFlipped
              ? rtl
                ? 'الوجه الخلفي (المعنى)'
                : 'Back (Answer)'
              : rtl
              ? 'الوجه الأمامي (الكلمة / السؤال)'
              : 'Front (Question)'}
          </Text>

          <Text style={[styles.promptText, { color: colors.text }]}>
            {prompt}
          </Text>

          {isFlipped ? (
            <View style={[styles.answerBox, { borderColor: colors.border }]}>
              <Text style={[styles.answerText, { color: colors.primary }]}>
                {answer}
              </Text>
            </View>
          ) : (
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              {rtl ? '👆 اضغط على البطاقة لإظهار الجواب' : '👆 Tap to reveal answer'}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Action Footer */}
      <View style={[styles.footer, { paddingHorizontal: spacing.lg }]}>
        {!isFlipped ? (
          <Button
            title={rtl ? 'إظهار الجواب' : 'Show Answer'}
            onPress={() => setIsFlipped(true)}
            size="lg"
            fullWidth
          />
        ) : (
          <View style={[styles.buttonRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {/* Don't Know / Again */}
            <Pressable
              onPress={() => handleAnswer(Rating.Again)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: `${colors.error}18`,
                  borderColor: colors.error,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <Text style={[styles.btnText, { color: colors.error }]}>
                {rtl ? 'لا أعرفها' : "Don't Know"}
              </Text>
            </Pressable>

            {/* Know / Good */}
            <Pressable
              onPress={() => handleAnswer(Rating.Good)}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                {rtl ? 'أعرفها' : 'I Know It'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  cardWrapper: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  tagBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(150,150,150,0.12)',
  },
  sideLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  promptText: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 10,
  },
  answerBox: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    width: '100%',
    alignItems: 'center',
  },
  answerText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 12,
    marginTop: 20,
  },
  footer: {
    paddingBottom: 24,
    paddingTop: 12,
  },
  buttonRow: {
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
