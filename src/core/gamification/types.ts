export type GamificationMode = 'full' | 'minimal' | 'off';

export interface LevelInfo {
  level: number;
  title: string;
  currentXp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
}

export interface QuestItem {
  id: string;
  key: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardXp: number;
  claimed: boolean;
}

export interface AchievementItem {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: number | null;
}
