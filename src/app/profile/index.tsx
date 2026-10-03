import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';
import {
  Header,
  Card,
  Button,
  Badge,
  ProgressBar,
  StreakFlame,
  XPCounter,
  Chip,
} from '../../components/ui';
import {
  gamificationManager,
} from '../../core/gamification/gamificationManager';
import {
  LevelInfo,
  QuestItem,
  AchievementItem,
  GamificationMode,
} from '../../core/gamification/types';
import { statsRepository, TodayStatsSummary } from '../../core/db/repositories/statsRepository';

export default function ProfileScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [stats, setStats] = useState<TodayStatsSummary | null>(null);
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [gameMode, setGameMode] = useState<GamificationMode>('full');

  const loadData = useCallback(async () => {
    try {
      const s = await statsRepository.getTodaySummary();
      setStats(s);
      const lvl = gamificationManager.getLevelInfo(s.xpTotal);
      setLevelInfo(lvl);

      const [qList, aList, gMode] = await Promise.all([
        gamificationManager.getDailyQuests(),
        gamificationManager.getAchievements(),
        gamificationManager.getGamificationMode(),
      ]);

      setQuests(qList);
      setAchievements(aList);
      setGameMode(gMode);
    } catch (e) {
      console.error('Failed to load profile data:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleClaimQuest = async (quest: QuestItem) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    await gamificationManager.claimQuest(quest.id, quest.rewardXp);
    CustomAlert.alert('Reward Claimed!', `+${quest.rewardXp} XP added to your total!`);
    await loadData();
  };

  const handleModeChange = async (mode: GamificationMode) => {
    setGameMode(mode);
    await gamificationManager.setGamificationMode(mode);
  };

  if (!levelInfo || !stats) return null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header title="Profile & Quests" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* 1. Level & User Card */}
        <Card style={[styles.userCard, { marginBottom: spacing.lg, borderColor: colors.primary }]}>
          <View style={[styles.avatarRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Ionicons name="school" size={32} color={colors.primary} />
            </View>

            <View style={[styles.avatarTextCol, { marginRight: rtl ? 16 : 0, marginLeft: rtl ? 0 : 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Badge count={`Level ${levelInfo.level}`} variant="due" size="sm" style={{ marginRight: 6 }} />
                <XPCounter xp={levelInfo.currentXp} />
              </View>

              <Text
                style={[
                  styles.titleText,
                  {
                    color: colors.text,
                    fontSize: typography.sizes.lg,
                    fontWeight: typography.weights.bold,
                    textAlign: rtl ? 'right' : 'left',
                    marginTop: 4,
                  },
                ]}
              >
                {levelInfo.title}
              </Text>
            </View>
          </View>

          {/* Level Progress */}
          <View style={{ marginTop: spacing.md }}>
            <View style={[styles.levelProgressRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                XP to Level {levelInfo.level + 1}
              </Text>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: 'bold' }}>
                {levelInfo.currentXp} / {levelInfo.xpForNextLevel} XP
              </Text>
            </View>

            <ProgressBar
              progress={levelInfo.progressPercent / 100}
              height={10}
              color={colors.primary}
              style={{ marginTop: 6 }}
            />
          </View>
        </Card>

        {/* 2. Streak & Records */}
        <Card style={[styles.streakCard, { marginBottom: spacing.lg }]}>
          <View style={[styles.streakRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={styles.streakBox}>
              <StreakFlame streak={stats.streakCurrent} />
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                Current Streak
              </Text>
            </View>

            <View style={styles.streakBox}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.gold }}>
                {stats.streakLongest} Days
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                Longest Streak
              </Text>
            </View>

            <View style={styles.streakBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="snow-outline" size={20} color={colors.accent} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>1</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                Streak Freeze
              </Text>
            </View>
          </View>
        </Card>

        {/* 3. Daily Quests Section */}
        <Card style={[styles.questsCard, { marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Ionicons name="flag-outline" size={20} color={colors.primary} style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }} />
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
            >
              Daily Quests
            </Text>
          </View>

          {quests.map((q) => {
            const isCompleted = q.progress >= q.target;
            const ratio = Math.min(1, q.progress / q.target);

            return (
              <View
                key={q.id}
                style={[
                  styles.questItem,
                  {
                    borderBottomColor: colors.border,
                    paddingVertical: 10,
                  },
                ]}
              >
                <View style={[styles.questHeaderRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 14, textAlign: rtl ? 'right' : 'left' }}>
                      {q.title}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: rtl ? 'right' : 'left', marginTop: 2 }}>
                      {q.description}
                    </Text>
                  </View>

                  <Badge count={`+${q.rewardXp} XP`} variant="accent" size="sm" />
                </View>

                <View style={{ marginTop: 8 }}>
                  <ProgressBar
                    progress={ratio}
                    height={6}
                    color={isCompleted ? colors.primary : colors.warning}
                  />
                  <View style={[styles.questFooterRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 4 }]}>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {q.progress} / {q.target}
                    </Text>

                    {isCompleted && !q.claimed && (
                      <Button
                        title="Claim Reward"
                        icon={<Ionicons name="sparkles" size={14} color="#FFFFFF" />}
                        variant="gold"
                        size="sm"
                        onPress={() => handleClaimQuest(q)}
                      />
                    )}

                    {q.claimed && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>
                          Claimed
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </Card>

        {/* 4. Badges & Achievements Grid */}
        <Card style={[styles.achievementsCard, { marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Ionicons name="ribbon-outline" size={20} color={colors.gold} style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }} />
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
            >
              Badges & Achievements
            </Text>
          </View>

          <View style={styles.badgesGrid}>
            {achievements.map((ach) => {
              const isUnlocked = ach.unlockedAt !== null;

              return (
                <View
                  key={ach.id}
                  style={[
                    styles.badgeCell,
                    {
                      backgroundColor: isUnlocked ? colors.surfaceRaised : colors.surface,
                      borderColor: isUnlocked ? colors.gold : colors.border,
                      opacity: isUnlocked ? 1 : 0.6,
                    },
                  ]}
                >
                  <Ionicons
                    name={(ach.icon || 'ribbon-outline') as any}
                    size={32}
                    color={isUnlocked ? colors.gold : colors.textMuted}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 13,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      marginTop: 4,
                    }}
                  >
                    {ach.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 10,
                      textAlign: 'center',
                      marginTop: 2,
                    }}
                  >
                    {ach.description}
                  </Text>

                  {isUnlocked && (
                    <Text style={{ color: colors.gold, fontSize: 9, fontWeight: 'bold', marginTop: 4 }}>
                      UNLOCKED
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </Card>

        {/* 5. Master Gamification Mode Switch */}
        <Card style={[styles.modeCard, { marginBottom: spacing.xl }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Ionicons name="game-controller-outline" size={20} color={colors.primary} style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }} />
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
            >
              Gamification Mode
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12, textAlign: rtl ? 'right' : 'left' }}>
            Choose whether to display playful XP and quests, or switch to minimal Anki-style study.
          </Text>

          <View style={[styles.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Chip
              label="Playful (Full)"
              selected={gameMode === 'full'}
              onPress={() => handleModeChange('full')}
            />
            <Chip
              label="Minimal (Anki-style)"
              selected={gameMode === 'minimal'}
              onPress={() => handleModeChange('minimal')}
            />
            <Chip
              label="Off"
              selected={gameMode === 'off'}
              onPress={() => handleModeChange('off')}
            />
          </View>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  userCard: {
    padding: 20,
    borderWidth: 2,
  },
  avatarRow: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextCol: {
    flex: 1,
  },
  titleText: {},
  levelProgressRow: {
    justifyContent: 'space-between',
  },
  streakCard: {
    padding: 16,
  },
  streakRow: {
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  streakBox: {
    alignItems: 'center',
  },
  questsCard: {},
  sectionTitle: {},
  questItem: {
    borderBottomWidth: 1,
  },
  questHeaderRow: {
    alignItems: 'center',
  },
  questFooterRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  achievementsCard: {},
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeCell: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: 10,
  },
  modeCard: {},
  chipsRow: {},
});
