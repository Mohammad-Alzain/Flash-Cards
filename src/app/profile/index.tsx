import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, alpha } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import {
  Screen,
  Header,
  Card,
  Row,
  AppText,
  Badge,
  Button,
  ProgressBar,
  StatTile,
  SectionHeader,
  SegmentedControl,
  IconTile,
  IconName,
  isIconName,
} from '../../components/ui';
import { Mascot } from '../../components/illustrations';
import { gamificationManager } from '../../core/gamification/gamificationManager';
import { LevelInfo, QuestItem, AchievementItem, GamificationMode } from '../../core/gamification/types';
import { statsRepository, TodayStatsSummary } from '../../core/db/repositories/statsRepository';
import { useFocusData } from '../../hooks/useFocusData';

interface ProfileData {
  level: LevelInfo | null;
  stats: TodayStatsSummary | null;
  quests: QuestItem[];
  achievements: AchievementItem[];
  mode: GamificationMode;
}

export default function ProfileScreen() {
  const { colors, tone } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data, reload } = useFocusData<ProfileData>(
    async () => {
      const stats = await statsRepository.getTodaySummary();
      const [quests, achievements, mode] = await Promise.all([
        gamificationManager.getDailyQuests(),
        gamificationManager.getAchievements(),
        gamificationManager.getGamificationMode(),
      ]);
      return { stats, level: gamificationManager.getLevelInfo(stats.xpTotal), quests, achievements, mode };
    },
    { level: null, stats: null, quests: [], achievements: [], mode: 'full' },
    'profile'
  );
  const [mode, setMode] = React.useState<GamificationMode>('full');
  React.useEffect(() => setMode(data.mode), [data.mode]);

  const claim = async (quest: QuestItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await gamificationManager.claimQuest(quest.id, quest.rewardXp);
    CustomAlert.alert(t('profile.claimed_title'), t('profile.claimed_msg', { xp: quest.rewardXp }));
    await reload();
  };

  const changeMode = async (next: GamificationMode) => {
    setMode(next);
    await gamificationManager.setGamificationMode(next);
  };

  const { level, stats } = data;
  const header = <Header title={t('profile.title')} icon="person" iconTone="violet" onBack={() => router.back()} />;

  if (!level || !stats) {
    return (
      <Screen scroll={false} header={header}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const gold = tone('amber');

  return (
    <Screen decor header={header}>
      {/* Level hero */}
      <Card variant="gradient" padding={18} style={{ marginBottom: 14 }}>
        <Row gap={14}>
          <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Mascot onColor size={68} accessory="cap" pose="wave" />
          </View>
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <AppText variant="caption" weight="black" color="#FFFFFF">
                  {t('profile.level', { n: level.level })}
                </AppText>
              </View>
              <Row gap={3}>
                <Ionicons name="flash" size={14} color="#FFE08A" />
                <AppText variant="caption" weight="black" color="#FFE08A">
                  {level.currentXp} XP
                </AppText>
              </Row>
            </Row>
            <AppText variant="h2" color="#FFFFFF" style={{ marginTop: 4 }} numberOfLines={2}>
              {level.title}
            </AppText>
          </View>
        </Row>
        <Row justify="space-between" style={{ marginTop: 16, marginBottom: 6 }}>
          <AppText variant="caption" color="rgba(255,255,255,0.85)">
            {t('profile.xp_to_next', { n: level.level + 1 })}
          </AppText>
          <AppText variant="caption" weight="black" color="#FFFFFF">
            {t('profile.xp_progress', { current: level.currentXp, next: level.xpForNextLevel })}
          </AppText>
        </Row>
        <ProgressBar progress={level.progressPercent / 100} color="#FFFFFF" trackColor="rgba(255,255,255,0.22)" height={10} gradient={false} />
      </Card>

      <Row gap={8} align="stretch" style={{ marginBottom: 22 }}>
        <StatTile layout="compact" icon="flame" tone="orange" value={stats.streakCurrent} label={t('profile.current_streak')} />
        <StatTile layout="compact" icon="trophy" tone="amber" value={t('profile.days', { count: stats.streakLongest })} label={t('profile.longest_streak')} />
        <StatTile layout="compact" icon="snow" tone="sky" value={1} label={t('profile.streak_freeze')} />
      </Row>

      {/* Quests */}
      <SectionHeader title={t('profile.quests_title')} icon="flag" tone="green" />
      {data.quests.map((q) => {
        const done = q.progress >= q.target;
        return (
          <Card key={q.id} variant={done && !q.claimed ? 'tinted' : 'elevated'} tone="amber" style={{ marginBottom: 10 }}>
            <Row gap={12}>
              <IconTile icon={q.claimed ? 'checkmark-done' : done ? 'gift' : 'flag'} tone={q.claimed ? 'green' : done ? 'amber' : 'indigo'} size={40} variant={done ? 'solid' : 'soft'} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{q.title}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {q.description}
                </AppText>
              </View>
              <Badge size="sm" variant="warning" icon="flash" label={t('profile.reward', { xp: q.rewardXp })} />
            </Row>
            <ProgressBar progress={Math.min(1, q.progress / q.target)} height={7} color={done ? tone('green').fg : colors.warning} style={{ marginTop: 12 }} />
            <Row justify="space-between" style={{ marginTop: 8 }}>
              <AppText variant="caption" weight="bold" color="textMuted">
                {q.progress} / {q.target}
              </AppText>
              {done && !q.claimed && <Button title={t('profile.claim')} icon="sparkles" variant="gold" size="sm" onPress={() => claim(q)} />}
              {q.claimed && <Badge size="sm" variant="success" icon="checkmark-circle" label={t('profile.claimed')} />}
            </Row>
          </Card>
        );
      })}

      {/* Achievements */}
      <SectionHeader title={t('profile.badges_title')} icon="ribbon" tone="amber" style={{ marginTop: 12 }} />
      <Row wrap gap={10} align="stretch" style={{ marginBottom: 22 }}>
        {data.achievements.map((a) => {
          const unlocked = a.unlockedAt !== null;
          const icon: IconName = isIconName(a.icon) ? a.icon : 'ribbon';
          return (
            <Card
              key={a.id}
              variant={unlocked ? 'tinted' : 'flat'}
              tone="amber"
              padding={12}
              style={{ width: '48%', flexGrow: 1, alignItems: 'center', opacity: unlocked ? 1 : 0.65 }}
            >
              <View>
                <IconTile icon={icon} tone={unlocked ? 'amber' : 'slate'} size={52} shape="circle" variant={unlocked ? 'solid' : 'soft'} />
                {!unlocked && (
                  <View style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                  </View>
                )}
              </View>
              <AppText variant="bodySm" weight="extrabold" align="center" style={{ marginTop: 8 }}>
                {a.title}
              </AppText>
              <AppText variant="caption" size={11} color="textSecondary" align="center" style={{ marginTop: 2 }}>
                {a.description}
              </AppText>
              {unlocked && (
                <View style={{ marginTop: 6, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, backgroundColor: alpha(gold.fg, 0.15) }}>
                  <AppText variant="caption" size={10} weight="black" color={gold.fg}>
                    {t('profile.unlocked')}
                  </AppText>
                </View>
              )}
            </Card>
          );
        })}
      </Row>

      {/* Mode */}
      <SectionHeader title={t('profile.mode_title')} icon="game-controller" tone="violet" />
      <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 10 }}>
        {t('profile.mode_desc')}
      </AppText>
      <SegmentedControl<GamificationMode>
        value={mode}
        onChange={changeMode}
        options={[
          { value: 'full', label: t('profile.mode_full'), icon: 'sparkles' },
          { value: 'minimal', label: t('profile.mode_minimal'), icon: 'leaf' },
          { value: 'off', label: t('profile.mode_off'), icon: 'power' },
        ]}
      />
    </Screen>
  );
}
