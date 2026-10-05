import React from 'react';
import { StyleProp, ViewStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { PressableScale } from './PressableScale';
import { AppText } from './AppText';
import { IconName } from './types';

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  variant?: 'surface' | 'ghost' | 'primary' | 'tinted' | 'danger';
  size?: number;
  color?: string;
  disabled?: boolean;
  /** Small numeric/text dot in the corner. */
  badge?: string | number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'surface',
  size = 42,
  color,
  disabled,
  badge,
  accessibilityLabel,
  style,
}) => {
  const { colors, shadow } = useTheme();

  const palette = {
    surface: { bg: colors.surfaceRaised, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' },
    primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
    tinted: { bg: `${colors.primary}1A`, fg: colors.primary, border: 'transparent' },
    danger: { bg: `${colors.error}1A`, fg: colors.error, border: 'transparent' },
  }[variant];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeScale={0.9}
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.36),
          backgroundColor: palette.bg,
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: palette.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
        },
        variant === 'surface' ? shadow(1) : null,
        variant === 'primary' ? shadow(2, colors.primary) : null,
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color ?? palette.fg} />
      {badge !== undefined && badge !== 0 && badge !== '' && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: colors.error,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.background,
          }}
        >
          <AppText variant="caption" size={10} weight="extrabold" color="#FFFFFF" align="center">
            {badge}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
};
