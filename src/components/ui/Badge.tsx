import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, alpha } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconName } from './types';

export type BadgeVariant =
  | 'new'
  | 'learn'
  | 'due'
  | 'neutral'
  | 'accent'
  | 'warning'
  | 'error'
  | 'primary'
  | 'success';

interface BadgeProps {
  count?: number | string;
  label?: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: IconName;
  /** Filled (solid) instead of tinted. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Small pill with a count and/or label, colour-coded by card state. */
export const Badge: React.FC<BadgeProps> = ({
  count,
  label,
  variant = 'neutral',
  size = 'md',
  icon,
  solid = false,
  style,
}) => {
  const { colors, tone } = useTheme();

  const hue: Record<BadgeVariant, string> = {
    new: colors.newCards,
    learn: colors.learningCards,
    due: colors.dueCards,
    neutral: colors.textSecondary,
    accent: colors.accent,
    warning: colors.warning,
    error: colors.error,
    primary: colors.primary,
    success: tone('green').fg,
  };
  const c = hue[variant];
  const small = size === 'sm';
  const text = label ? `${count !== undefined ? `${count} ` : ''}${label}` : String(count ?? '');

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          borderRadius: 999,
          paddingHorizontal: small ? 8 : 11,
          paddingVertical: small ? 2 : 4,
          backgroundColor: solid ? c : variant === 'neutral' ? colors.surface : alpha(c, 0.13),
        },
        style,
      ]}
    >
      <Row gap={4}>
        {icon && <Ionicons name={icon} size={small ? 11 : 13} color={solid ? '#FFFFFF' : c} />}
        <AppText
          variant="caption"
          weight="extrabold"
          size={small ? 11 : 12}
          color={solid ? '#FFFFFF' : c}
          align="center"
        >
          {text}
        </AppText>
      </Row>
    </View>
  );
};
