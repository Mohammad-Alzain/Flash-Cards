import { getDatabase } from '../db/connection';
import { settingsRepository } from '../db/repositories/settingsRepository';
import { statsRepository } from '../db/repositories/statsRepository';
import { LevelInfo, QuestItem, AchievementItem, GamificationMode } from './types';
import { getDateStringForRollover } from '../scheduler/dayBoundary';

export const gamificationManager = {
  /**
   * Computes user level and progress from total XP
   */
  getLevelInfo(totalXp: number): LevelInfo {
    const xp = Math.max(0, totalXp);

    // Levels formula: Level 1: 0-150, Level 2: 151-350, Level 3: 351-650, etc.
    let level = 1;
    let xpRequiredForLevel = 0;
    let nextThreshold = 150;

    while (xp >= nextThreshold) {
      level++;
      xpRequiredForLevel = nextThreshold;
      nextThreshold += level * 150;
    }

    const titles: Record<number, string> = {
      1: 'مبتدئ (Novice)',
      2: 'مستكشف (Explorer)',
      3: 'متعلم مثابر (Diligent Learner)',
      4: 'باحث متميز (Scholar)',
      5: 'حكيم المعرفة (Sage)',
      6: 'خبير الذاكرة (Memory Master)',
    };

    const title = titles[level] || `المستوى ${level} (Grandmaster)`;
    const progressInCurrentLevel = xp - xpRequiredForLevel;
    const levelSpan = nextThreshold - xpRequiredForLevel;
    const progressPercent = Math.min(100, Math.round((progressInCurrentLevel / levelSpan) * 100));

    return {
      level,
      title,
      currentXp: xp,
      xpForCurrentLevel: xpRequiredForLevel,
      xpForNextLevel: nextThreshold,
      progressPercent,
    };
  },

  /**
   * Generates or fetches daily quests for today
   */
  async getDailyQuests(): Promise<QuestItem[]> {
    const db = await getDatabase();
    const todayStr = getDateStringForRollover();
    const todayStats = await statsRepository.getTodaySummary();

    const existingRows = await db.getAllAsync<any>(
      'SELECT * FROM quests WHERE date = ?;',
      todayStr
    );

    const defaultQuestDefinitions = [
      {
        key: 'quest_review_15',
        title: 'Review 15 Cards',
        description: 'Complete at least 15 reviews today',
        target: 15,
        progress: Math.min(15, todayStats.reviewsDone),
        rewardXp: 40,
      },
      {
        key: 'quest_learn_5',
        title: 'Learn 5 New Words',
        description: 'Expand your vocabulary with 5 new cards',
        target: 5,
        progress: Math.min(5, todayStats.newDone),
        rewardXp: 50,
      },
      {
        key: 'quest_streak_active',
        title: 'Maintain Streak',
        description: 'Study at least 1 card today',
        target: 1,
        progress: Math.min(1, todayStats.totalDone),
        rewardXp: 30,
      },
    ];

    if (existingRows.length === 0) {
      // Seed today's quests
      for (const q of defaultQuestDefinitions) {
        const qId = `quest_${todayStr}_${q.key}`;
        await db.runAsync(
          `INSERT INTO quests (id, date, key, progress, target, claimed)
           VALUES (?, ?, ?, ?, ?, 0);`,
          qId,
          todayStr,
          q.key,
          q.progress,
          q.target
        );
      }
    } else {
      // Update progress from today's stats
      for (const q of defaultQuestDefinitions) {
        await db.runAsync(
          'UPDATE quests SET progress = ? WHERE date = ? AND key = ? AND claimed = 0;',
          q.progress,
          todayStr,
          q.key
        );
      }
    }

    const currentRows = await db.getAllAsync<any>(
      'SELECT * FROM quests WHERE date = ?;',
      todayStr
    );

    return currentRows.map((r) => {
      const def = defaultQuestDefinitions.find((d) => d.key === r.key);
      return {
        id: r.id,
        key: r.key,
        title: def?.title || 'Daily Quest',
        description: def?.description || '',
        progress: r.progress,
        target: r.target,
        rewardXp: def?.rewardXp || 30,
        claimed: r.claimed === 1,
      };
    });
  },

  /**
   * Claims quest reward
   */
  async claimQuest(questId: string, rewardXp: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE quests SET claimed = 1 WHERE id = ?;', questId);

    // Award XP
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO xp_log (id, source, amount, created_at)
       VALUES (?, 'quest_reward', ?, ?);`,
      `xp_${now}`,
      rewardXp,
      now
    );
    await db.runAsync(
      `UPDATE settings SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT) WHERE key = 'xp_total';`,
      rewardXp
    );
  },

  /**
   * Fetches achievements list with unlock status
   */
  async getAchievements(): Promise<AchievementItem[]> {
    const db = await getDatabase();
    const unlockedRows = await db.getAllAsync<{ key: string; unlocked_at: number }>(
      'SELECT key, unlocked_at FROM achievements;'
    );
    const unlockedMap = new Map<string, number>();
    unlockedRows.forEach((r) => unlockedMap.set(r.key, r.unlocked_at));

    const allDefinitions = [
      {
        id: 'ach_first_review',
        key: 'first_review',
        title: 'First Step',
        description: 'Complete your first flashcard review',
        icon: 'leaf-outline',
      },
      {
        id: 'ach_streak_3',
        key: 'streak_3',
        title: 'Ignition',
        description: 'Reach a 3-day study streak',
        icon: 'flame-outline',
      },
      {
        id: 'ach_streak_7',
        key: 'streak_7',
        title: 'Week Warrior',
        description: 'Maintain a 7-day study streak',
        icon: 'shield-checkmark-outline',
      },
      {
        id: 'ach_cards_100',
        key: 'cards_100',
        title: 'Century Club',
        description: 'Review over 100 cards total',
        icon: 'ribbon-outline',
      },
      {
        id: 'ach_quiz_perfect',
        key: 'quiz_perfect',
        title: 'Quiz Champion',
        description: 'Score 100% on any practice quiz',
        icon: 'trophy-outline',
      },
      {
        id: 'ach_import_pro',
        key: 'import_pro',
        title: 'Deck Collector',
        description: 'Import your first external Anki or Excel deck',
        icon: 'file-tray-full-outline',
      },
    ];

    return allDefinitions.map((d) => ({
      ...d,
      unlockedAt: unlockedMap.get(d.key) || null,
    }));
  },

  /**
   * Unlocks an achievement
   */
  async unlockAchievement(key: string): Promise<boolean> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM achievements WHERE key = ?;',
      key
    );
    if (existing) return false;

    await db.runAsync(
      'INSERT INTO achievements (id, key, unlocked_at) VALUES (?, ?, ?);',
      `ach_${Date.now()}_${key}`,
      key,
      Date.now()
    );
    return true;
  },

  /**
   * Sets master gamification mode
   */
  async setGamificationMode(mode: GamificationMode): Promise<void> {
    await settingsRepository.set('gamification_mode', mode);
  },

  async getGamificationMode(): Promise<GamificationMode> {
    const mode = await settingsRepository.get('gamification_mode', 'full');
    return mode as GamificationMode;
  },
};
