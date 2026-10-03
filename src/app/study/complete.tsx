import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, Text, StyleSheet, } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Card, Button, XPCounter } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';

export default function StudyCompleteScreen() {
  const { count = '0', xp = '0', mode = 'review', deckId } = useLocalSearchParams<{
    count?: string;
    xp?: string;
    mode?: string;
    deckId?: string;
  }>();
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const cardsCount = parseInt(count, 10) || 0;
  const xpEarned = parseInt(xp, 10) || 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.container, { padding: spacing.xl }]}>
        <Ionicons name="trophy" size={72} color={colors.gold} style={{ alignSelf: 'center', marginBottom: 16 }} />

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
          {t('study.session_complete')}
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textSecondary,
              fontSize: typography.sizes.md,
              textAlign: 'center',
              marginTop: spacing.xs,
              marginBottom: spacing.xl,
            },
          ]}
        >
          {rtl
            ? 'عمل رائع ومثمر! تم تثبيت هذه الكلمات بنجاح في ذاكرتك.'
            : 'Great effort! Every session reinforces your long-term memory.'}
        </Text>

        {/* Stats Grid */}
        <View style={[styles.gridRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginBottom: spacing.lg }]}>
          <Card style={[styles.statBox, { flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }]}>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>
              {mode === 'learn'
                ? (rtl ? 'كلمات تمت دراستها' : 'Cards Learned')
                : t('study.cards_reviewed')}
            </Text>
            <Text
              style={{
                color: mode === 'learn' ? colors.secondary : colors.primary,
                fontSize: typography.sizes.xxl,
                fontWeight: 'bold',
                marginTop: 4,
              }}
            >
              {cardsCount}
            </Text>
          </Card>

          <Card style={[styles.statBox, { flex: 1 }]}>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>
              {t('study.xp_earned')}
            </Text>
            <Text
              style={{
                color: colors.gold,
                fontSize: typography.sizes.xxl,
                fontWeight: 'bold',
                marginTop: 4,
              }}
            >
              +{xpEarned} XP
            </Text>
          </Card>
        </View>

        {/* Navigation & Action Buttons */}
        <View style={styles.btnColumn}>
          {/* Action 1: Quiz on the learned cards */}
          <Button
            title={rtl ? 'اختبر نفسك فيما درسته الآن' : 'Quiz on What You Learned'}
            variant="accent"
            size="lg"
            fullWidth
            icon={<Ionicons name="sparkles" size={20} color="#FFFFFF" />}
            onPress={() => {
              const query = `?mode=practice&count=${Math.max(5, Math.min(20, cardsCount))}${deckId ? `&deckId=${deckId}` : ''}`;
              router.replace(`/quiz/play${query}` as any);
            }}
            style={{ marginBottom: spacing.md }}
          />

          {/* Action 2: Review cards */}
          <Button
            title={rtl ? 'مراجعة الكلمات' : 'Review Learned Cards'}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Ionicons name="repeat" size={20} color="#FFFFFF" />}
            onPress={() => {
              router.replace(deckId ? `/study/review?deckId=${deckId}` : ('/(tabs)/decks' as any));
            }}
            style={{ marginBottom: spacing.md }}
          />

          {/* Action 3: Back to Home */}
          <Button
            title={t('study.back_home')}
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrateEmoji: {
    fontSize: 70,
    marginBottom: 16,
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
  btnColumn: {
    width: '100%',
    marginTop: 16,
  },
});
