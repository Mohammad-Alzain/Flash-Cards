import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Card, Button, Badge } from '../../components/ui';
import { mistakesManager } from '../../core/quiz/mistakesManager';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { quizGenerator } from '../../core/quiz/generator';

export default function QuizScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const rtl = isRTL();

  const [mistakesCount, setMistakesCount] = useState(0);
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(params.deckId || null);

  useEffect(() => {
    if (params.deckId) {
      setSelectedDeckId(params.deckId);
    }
  }, [params.deckId]);

  // Dynamic Question & Answer field selection (Point 2)
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [selectedQuestionField, setSelectedQuestionField] = useState<string>('auto');
  const [selectedAnswerField, setSelectedAnswerField] = useState<string>('auto');

  // Question count selection (5, 10, 20, 50, 0 = All cards)
  const [selectedCount, setSelectedCount] = useState<number>(10);

  // Smart training focus (all, mistakes, due, new, hardest)
  const [selectedSmartFocus, setSelectedSmartFocus] = useState<'all' | 'mistakes' | 'due' | 'new' | 'hardest'>('all');

  // Time limit selection (0 = no limit, 60 = 1m, 120 = 2m, 300 = 5m)
  const [selectedTimeLimit, setSelectedTimeLimit] = useState<number>(0);

  useFocusEffect(
    useCallback(() => {
      mistakesManager.getMistakesCount().then(setMistakesCount);
      deckRepository.getAllWithCounts().then(setDecks);
    }, [])
  );

  // Load available fields whenever selected deck changes
  useEffect(() => {
    quizGenerator
      .getAvailableFields(selectedDeckId || undefined)
      .then((fields) => {
        setAvailableFields(fields);
        // Reset field selections if they don't exist in new deck
        if (selectedQuestionField !== 'auto' && !fields.includes(selectedQuestionField)) {
          setSelectedQuestionField('auto');
        }
        if (selectedAnswerField !== 'auto' && !fields.includes(selectedAnswerField)) {
          setSelectedAnswerField('auto');
        }
      })
      .catch(() => setAvailableFields([]));
  }, [selectedDeckId]);

  const totalCardsInAllDecks = decks.reduce((acc, d) => acc + (d.card_count || 0), 0);
  const selectedDeck = selectedDeckId ? decks.find((d) => d.id === selectedDeckId) : null;
  const currentCardCount = selectedDeck
    ? (selectedDeck.total_card_count ?? selectedDeck.card_count)
    : totalCardsInAllDecks;

  const quizModes: {
    id: string;
    title: string;
    desc: string;
    icon: keyof typeof Ionicons.glyphMap;
    variant: 'primary' | 'secondary' | 'danger' | 'gold';
    iconColor: string;
  }[] = [
    {
      id: 'written_ai',
      title: rtl ? 'اختبار كتابي بالذكاء الاصطناعي' : 'AI Written Quiz',
      desc: rtl
        ? 'اكتب إجاباتك بحرية مع تصحيح ذكي وتقييم دقيق في نهاية الاختبار'
        : 'Write freeform answers evaluated with comprehensive AI grading',
      icon: 'sparkles',
      variant: 'primary',
      iconColor: colors.primary,
    },
    {
      id: 'mixed',
      title: rtl ? 'اختبار مختلط (كتابي واختياري)' : 'Mixed Mode (Written & MC)',
      desc: rtl
        ? 'مزيج متنوع يجمع بين أسئلة الاختيار والأسئلة الكتابية'
        : 'Varied mix of multiple choice and written questions',
      icon: 'layers',
      variant: 'secondary',
      iconColor: colors.accent,
    },
    {
      id: 'random',
      title: t('quiz.random_title'),
      desc: rtl ? 'اختبار تفاعلي سريع (اختيار من متعدد وصح أو خطأ)' : t('quiz.random_desc'),
      icon: 'shuffle',
      variant: 'primary',
      iconColor: colors.primary,
    },
    {
      id: 'exam',
      title: t('quiz.exam_title'),
      desc: rtl ? 'نمط الامتحان المؤقت دون إظهار الإجابات أثناء الاختبار' : t('quiz.exam_desc'),
      icon: 'school',
      variant: 'secondary',
      iconColor: colors.accent,
    },
    {
      id: 'survival',
      title: t('quiz.survival_title'),
      desc: rtl ? 'نمط البقاء: لديك 3 أرواح وينتهي الاختبار فوراً عند نفاذها' : t('quiz.survival_desc'),
      icon: 'heart',
      variant: 'danger',
      iconColor: colors.error,
    },
    {
      id: 'matching',
      title: t('quiz.match_title'),
      desc: rtl ? 'لعبة توصيل ومطابقة الكلمات مع معانيها' : t('quiz.match_desc'),
      icon: 'flash',
      variant: 'gold',
      iconColor: colors.goldPressed,
    },
    {
      id: 'mistakes',
      title: rtl ? 'تصفية الأخطاء السابقة' : 'Mistakes Drill',
      desc: rtl ? `تدريب مركز ومكثف على ${mistakesCount} كلمة أخطأت بها سابقاً` : 'Targeted drill on past mistakes',
      icon: 'alert-circle',
      variant: 'danger',
      iconColor: colors.error,
    },
  ];

  const handleStartMode = (modeId: string) => {
    let query = `?mode=${modeId}`;
    if (selectedDeckId) query += `&deckId=${selectedDeckId}`;
    if (selectedQuestionField !== 'auto') {
      query += `&questionField=${encodeURIComponent(selectedQuestionField)}`;
    }
    if (selectedAnswerField !== 'auto') {
      query += `&answerField=${encodeURIComponent(selectedAnswerField)}`;
    }
    if (selectedTimeLimit > 0 || modeId === 'exam') {
      const limit = selectedTimeLimit > 0 ? selectedTimeLimit : 120; // 2 min default for exam
      query += `&timeLimitSec=${limit}`;
    }
    const finalCount = selectedCount > 0 ? selectedCount : currentCardCount;
    query += `&count=${finalCount}`;
    if (selectedSmartFocus !== 'all') {
      query += `&smartFocus=${selectedSmartFocus}`;
    }
    router.push(`/quiz/play${query}` as any);
  };

  // Helper: truncate deck name to max 12 chars
  const truncateName = (name: string, max = 12) =>
    name.length > max ? name.slice(0, max) + '…' : name;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>

      {/* ── Hero Header ── */}
      <View
        style={[
          styles.hero,
          {
            backgroundColor: colors.primary,
            marginHorizontal: spacing.lg,
            marginTop: spacing.sm,
            borderRadius: 22,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.22,
            shadowRadius: 12,
            elevation: 5,
          },
        ]}
      >
        <View style={[styles.heroInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'الاختبار' : t('quiz.title')}
            </Text>
            <Text style={[styles.heroSubtitle, { textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'اختر نمط الاختبار وابدأ' : t('quiz.subtitle')}
            </Text>
          </View>
          <Ionicons name="sparkles" size={48} color="rgba(255,255,255,0.9)" />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>

        {/* ── Deck Selector ── */}
        {decks.length > 0 && (
          <View style={{ marginBottom: spacing.md }}>
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: '700',
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {rtl ? 'الكتاب أو الرزمة المستهدفة:' : 'Target Deck for Quiz:'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {rtl ? `${currentCardCount} بطاقة` : `${currentCardCount} cards`}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                gap: 8,
                paddingVertical: 4,
              }}
            >
              {/* All Decks Chip */}
              <Pressable
                onPress={() => setSelectedDeckId(null)}
                style={[
                  styles.deckChip,
                  {
                    backgroundColor: selectedDeckId === null ? colors.primary : 'transparent',
                    borderColor: selectedDeckId === null ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.deckChipText,
                    {
                      color: selectedDeckId === null ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: selectedDeckId === null ? '700' : '500',
                    },
                  ]}
                >
                  {rtl ? `جميع الرزم (${totalCardsInAllDecks})` : `All Decks (${totalCardsInAllDecks})`}
                </Text>
              </Pressable>

              {/* Individual Decks */}
              {decks.map((deck) => {
                const isSelected = selectedDeckId === deck.id;
                const count = deck.total_card_count ?? deck.card_count;
                return (
                  <Pressable
                    key={deck.id}
                    onPress={() => setSelectedDeckId(deck.id)}
                    style={[
                      styles.deckChip,
                      {
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.deckChipText,
                        {
                          color: isSelected ? '#FFFFFF' : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {truncateName(deck.name)} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Field Configuration Card ── */}
        {availableFields.length > 0 && (
          <View
            style={[
              styles.glassCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                marginBottom: spacing.lg,
              },
            ]}
          >
            {/* Card Header Row */}
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <View
                style={[
                  styles.cardIconCircle,
                  {
                    backgroundColor: `${colors.primary}15`,
                    marginRight: rtl ? 0 : 8,
                    marginLeft: rtl ? 8 : 0,
                  },
                ]}
              >
                <Ionicons name="options-outline" size={17} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: '700',
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {rtl ? 'تخصيص حقول السؤال والجواب' : 'Customize Question & Answer Fields'}
              </Text>
            </View>

            {/* Question Field Picker */}
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <Ionicons
                name="help-circle"
                size={14}
                color={colors.primary}
                style={{ marginRight: rtl ? 0 : 4, marginLeft: rtl ? 4 : 0 }}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  fontWeight: '700',
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {rtl ? 'حقل السؤال:' : 'Question Field:'}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                gap: 6,
                marginBottom: 14,
              }}
            >
              <Pressable
                onPress={() => setSelectedQuestionField('auto')}
                style={[
                  styles.fieldChip,
                  {
                    backgroundColor:
                      selectedQuestionField === 'auto' ? colors.primary : 'transparent',
                    borderColor:
                      selectedQuestionField === 'auto' ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selectedQuestionField === 'auto' ? '#FFFFFF' : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: selectedQuestionField === 'auto' ? '700' : '500',
                  }}
                >
                  {rtl ? 'تلقائي (الوجه الأولي)' : 'Auto (Front)'}
                </Text>
              </Pressable>

              {availableFields.map((fName) => {
                const isSel = selectedQuestionField === fName;
                return (
                  <Pressable
                    key={`q_${fName}`}
                    onPress={() => setSelectedQuestionField(fName)}
                    style={[
                      styles.fieldChip,
                      {
                        backgroundColor: isSel ? colors.primary : 'transparent',
                        borderColor: isSel ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isSel ? '#FFFFFF' : colors.textSecondary,
                        fontSize: 12,
                        fontWeight: isSel ? '700' : '500',
                      }}
                    >
                      {fName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Answer Field Picker */}
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.accent}
                style={{ marginRight: rtl ? 0 : 4, marginLeft: rtl ? 4 : 0 }}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  fontWeight: '700',
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {rtl ? 'حقل الجواب المطلوب:' : 'Target Answer Field:'}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                gap: 6,
                marginBottom: 14,
              }}
            >
              <Pressable
                onPress={() => setSelectedAnswerField('auto')}
                style={[
                  styles.fieldChip,
                  {
                    backgroundColor:
                      selectedAnswerField === 'auto' ? colors.accent : 'transparent',
                    borderColor:
                      selectedAnswerField === 'auto' ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selectedAnswerField === 'auto' ? '#FFFFFF' : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: selectedAnswerField === 'auto' ? '700' : '500',
                  }}
                >
                  {rtl ? 'تلقائي (الظهر / المعنى)' : 'Auto (Back)'}
                </Text>
              </Pressable>

              {availableFields.map((fName) => {
                const isSel = selectedAnswerField === fName;
                return (
                  <Pressable
                    key={`a_${fName}`}
                    onPress={() => setSelectedAnswerField(fName)}
                    style={[
                      styles.fieldChip,
                      {
                        backgroundColor: isSel ? colors.accent : 'transparent',
                        borderColor: isSel ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isSel ? '#FFFFFF' : colors.textSecondary,
                        fontSize: 12,
                        fontWeight: isSel ? '700' : '500',
                      }}
                    >
                      {fName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Time Limit Picker */}
            <View
              style={{
                flexDirection: rtl ? 'row-reverse' : 'row',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <Ionicons
                name="timer-outline"
                size={14}
                color={colors.textSecondary}
                style={{ marginRight: rtl ? 0 : 4, marginLeft: rtl ? 4 : 0 }}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  fontWeight: '700',
                  textAlign: rtl ? 'right' : 'left',
                }}
              >
                {rtl ? 'مؤقت الاختبار (اختياري):' : 'Timer Limit (Optional):'}
              </Text>
            </View>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 6 }}>
              {[
                { sec: 0, labelAr: 'بدون مؤقت', labelEn: 'No Timer' },
                { sec: 60, labelAr: '1 دقيقة', labelEn: '1 Min' },
                { sec: 120, labelAr: '2 دقيقة', labelEn: '2 Min' },
                { sec: 300, labelAr: '5 دقائق', labelEn: '5 Min' },
              ].map((item) => {
                const isSel = selectedTimeLimit === item.sec;
                return (
                  <Pressable
                    key={`time_${item.sec}`}
                    onPress={() => setSelectedTimeLimit(item.sec)}
                    style={[
                      styles.fieldChip,
                      {
                        backgroundColor: isSel ? colors.accent : 'transparent',
                        borderColor: isSel ? colors.accent : colors.border,
                        flex: 1,
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: isSel ? '#FFFFFF' : colors.textSecondary,
                        fontSize: 11,
                        fontWeight: isSel ? '700' : '500',
                      }}
                    >
                      {rtl ? item.labelAr : item.labelEn}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Smart Training Focus & Question Count Card ── */}
        <View
          style={[
            styles.glassCard,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              marginBottom: spacing.lg,
            },
          ]}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: rtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <View
              style={[
                styles.cardIconCircle,
                {
                  backgroundColor: `${colors.primary}15`,
                  marginRight: rtl ? 0 : 8,
                  marginLeft: rtl ? 8 : 0,
                },
              ]}
            >
              <Ionicons name="sparkles" size={17} color={colors.primary} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 14,
                fontWeight: '700',
                textAlign: rtl ? 'right' : 'left',
              }}
            >
              {rtl ? 'تخصيص عدد الأسئلة والتدريب الذكي' : 'Quiz Size & Smart Training Focus'}
            </Text>
          </View>

          {/* Question Count Selector */}
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: '700',
              textAlign: rtl ? 'right' : 'left',
              marginBottom: 6,
            }}
          >
            {rtl ? 'عدد أسئلة الاختبار:' : 'Question Count:'}
          </Text>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 6, marginBottom: 14 }}>
            {[
              { count: 5, labelAr: '5 أسئلة', labelEn: '5 Qs' },
              { count: 10, labelAr: '10 أسئلة', labelEn: '10 Qs' },
              { count: 20, labelAr: '20 سؤالاً', labelEn: '20 Qs' },
              { count: 50, labelAr: '50 سؤالاً', labelEn: '50 Qs' },
              { count: 0, labelAr: 'كامل الرزمة', labelEn: 'All' },
            ].map((c) => {
              const isSel = selectedCount === c.count;
              return (
                <Pressable
                  key={`cnt_${c.count}`}
                  onPress={() => setSelectedCount(c.count)}
                  style={[
                    styles.fieldChip,
                    {
                      backgroundColor: isSel ? colors.primary : 'transparent',
                      borderColor: isSel ? colors.primary : colors.border,
                      flex: 1,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isSel ? '#FFFFFF' : colors.textSecondary,
                      fontSize: 11,
                      fontWeight: isSel ? '700' : '500',
                    }}
                  >
                    {rtl ? c.labelAr : c.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Smart Focus Filters */}
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: '700',
              textAlign: rtl ? 'right' : 'left',
              marginBottom: 6,
            }}
          >
            {rtl ? 'نوع التركيز والتدريب الذكي:' : 'Smart Focus Mode:'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: rtl ? 'row-reverse' : 'row',
              gap: 6,
            }}
          >
            {[
              { id: 'all', labelAr: '🌟 شامل ومنوع', labelEn: '🌟 All Mix' },
              { id: 'mistakes', labelAr: '⚡ تصفية الأخطاء', labelEn: '⚡ Mistakes' },
              { id: 'hardest', labelAr: '🔥 الأصعب حفظاً', labelEn: '🔥 Hardest' },
              { id: 'due', labelAr: '🕒 مستحقة اليوم', labelEn: '🕒 Due Today' },
              { id: 'new', labelAr: '🆕 كلمات جديدة', labelEn: '🆕 New Cards' },
            ].map((f) => {
              const isSel = selectedSmartFocus === f.id;
              return (
                <Pressable
                  key={`focus_${f.id}`}
                  onPress={() => setSelectedSmartFocus(f.id as any)}
                  style={[
                    styles.fieldChip,
                    {
                      backgroundColor: isSel ? colors.primary : 'transparent',
                      borderColor: isSel ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isSel ? '#FFFFFF' : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: isSel ? '700' : '500',
                    }}
                  >
                    {rtl ? f.labelAr : f.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Warning Banner if total cards is 0 ── */}
        {totalCardsInAllDecks === 0 && (
          <View
            style={[
              styles.warningCard,
              {
                borderColor: colors.error,
                backgroundColor: `${colors.error}0D`,
                marginBottom: spacing.lg,
              },
            ]}
          >
            <View style={[styles.warningRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View
                style={[
                  styles.cardIconCircle,
                  {
                    backgroundColor: `${colors.error}18`,
                    marginRight: rtl ? 0 : 12,
                    marginLeft: rtl ? 12 : 0,
                  },
                ]}
              >
                <Ionicons name="information-circle" size={22} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>
                  {rtl ? 'لا توجد بطاقات في مجموعتك بعد' : 'No cards found in your collection yet'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: rtl ? 'right' : 'left', marginTop: 3 }}>
                  {rtl
                    ? 'يرجى استيراد رزمة (.apkg) أو إنشاء بطاقات جديدة لبدء خوض الاختبارات.'
                    : 'Import an Anki deck or add notes to begin testing yourself.'}
                </Text>
                <Pressable
                  onPress={() => router.push('/import')}
                  style={[
                    styles.warningActionBtn,
                    { backgroundColor: `${colors.error}18`, borderColor: colors.error },
                  ]}
                >
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>
                    {rtl ? 'استيراد رزمة الآن' : 'Import Deck Now'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ── Mistakes Notebook Card ── */}
        {mistakesCount > 0 && (
          <Pressable
            style={[
              styles.mistakesCard,
              {
                borderColor: '#F59E0B',
                backgroundColor: `#F59E0B18`,
                marginBottom: spacing.lg,
              },
            ]}
            onPress={() =>
              router.push(
                (`/quiz/play?mode=mistakes${selectedDeckId ? `&deckId=${selectedDeckId}` : ''}`) as any
              )
            }
          >
            <View style={[styles.mistakesRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View
                style={[
                  styles.mistakesIconBox,
                  {
                    backgroundColor: '#F59E0B20',
                    marginRight: rtl ? 0 : 12,
                    marginLeft: rtl ? 12 : 0,
                  },
                ]}
              >
                <Ionicons name="book" size={24} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>
                  {rtl ? 'دفتر الأخطاء' : 'Mistakes Notebook'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: rtl ? 'right' : 'left', marginTop: 2 }}>
                  {rtl
                    ? `${mistakesCount} بطاقة تحتاج لمراجعة إضافية`
                    : `${mistakesCount} challenging cards waiting for review`}
                </Text>
              </View>
              <Badge count={mistakesCount} variant="warning" size="md" />
            </View>
          </Pressable>
        )}

        {/* ── Modes Section Heading ── */}
        <Text
          style={[
            styles.sectionHeading,
            {
              color: colors.text,
              fontSize: typography.sizes.md,
              fontWeight: typography.weights.bold,
              textAlign: rtl ? 'right' : 'left',
              marginBottom: spacing.md,
            },
          ]}
        >
          {t('quiz.modes_title')}
        </Text>

        {/* ── Mode Cards ── */}
        {quizModes.map((mode) => (
          <View
            key={mode.id}
            style={[
              styles.modeCard,
              {
                backgroundColor: `${mode.iconColor}12`,
                borderLeftWidth: rtl ? 0 : 4,
                borderRightWidth: rtl ? 4 : 0,
                borderLeftColor: rtl ? undefined : mode.iconColor,
                borderRightColor: rtl ? mode.iconColor : undefined,
                borderColor: `${mode.iconColor}30`,
                marginBottom: spacing.md,
              },
            ]}
          >
            <View
              style={[
                styles.modeRow,
                { flexDirection: rtl ? 'row-reverse' : 'row' },
              ]}
            >
              {/* Mode Icon Circle */}
              <View
                style={[
                  styles.modeIconContainer,
                  {
                    backgroundColor: `${mode.iconColor}20`,
                    marginRight: rtl ? 0 : 14,
                    marginLeft: rtl ? 14 : 0,
                  },
                ]}
              >
                <Ionicons name={mode.icon} size={26} color={mode.iconColor} />
              </View>

              {/* Title + Desc */}
              <View style={styles.modeTextCol}>
                <Text
                  style={[
                    styles.modeTitle,
                    {
                      color: colors.text,
                      fontSize: 17,
                      fontWeight: '700',
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {mode.title}
                </Text>
                <Text
                  style={[
                    styles.modeDesc,
                    {
                      color: colors.textSecondary,
                      fontSize: 12,
                      textAlign: rtl ? 'right' : 'left',
                      marginTop: 3,
                      lineHeight: 17,
                    },
                  ]}
                >
                  {mode.desc}
                </Text>
              </View>

              {/* Inline Start Button */}
              <Pressable
                onPress={() => handleStartMode(mode.id)}
                style={[
                  styles.modeStartBtn,
                  {
                    backgroundColor: mode.iconColor,
                    marginLeft: rtl ? 0 : 10,
                    marginRight: rtl ? 10 : 0,
                  },
                ]}
              >
                <Text style={styles.modeStartBtnText}>
                  {rtl ? 'ابدأ' : 'Start'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  /* ── Hero ── */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
  },
  heroInner: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '500',
  },
  /* ── Content ── */
  content: {},
  /* ── Deck Chips ── */
  deckChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckChipText: {
    fontSize: 13,
  },
  /* ── Field / Time Chips ── */
  fieldChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  /* ── Glass card (field config) ── */
  glassCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* ── Warning card ── */
  warningCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
  },
  warningRow: {
    alignItems: 'flex-start',
  },
  warningActionBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  /* ── Mistakes Card ── */
  mistakesCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
  },
  mistakesRow: {
    alignItems: 'center',
  },
  mistakesIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* ── Section Heading ── */
  sectionHeading: {},
  /* ── Mode Cards ── */
  modeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modeRow: {
    alignItems: 'center',
  },
  modeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTextCol: {
    flex: 1,
  },
  modeTitle: {},
  modeDesc: {},
  modeStartBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeStartBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
