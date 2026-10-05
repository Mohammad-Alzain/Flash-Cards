import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export const isIconName = (value: unknown): value is IconName =>
  typeof value === 'string' && value in Ionicons.glyphMap;
