import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, alpha } from '../../theme';
import { PressableScale } from './PressableScale';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconName } from './types';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Accent colour for the selected state (defaults to primary). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Selectable pill used for filters and option pickers. */
export const Chip: React.FC<ChipProps> = ({ label, selected = false, onPress, icon, color, style }) => {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  const fg = selected ? accent : colors.textSecondary;

  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      haptic
      activeScale={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        {
          alignSelf: 'flex-start',
          borderRadius: 999,
          borderWidth: 1.5,
          paddingHorizontal: 14,
          paddingVertical: 7,
          backgroundColor: selected ? alpha(accent, 0.12) : colors.surfaceRaised,
          borderColor: selected ? accent : colors.border,
        },
        style,
      ]}
    >
      <Row gap={6}>
        {icon && <Ionicons name={icon} size={15} color={fg} />}
        {selected && !icon && <Ionicons name="checkmark" size={14} color={fg} />}
        <AppText variant="bodySm" weight={selected ? 'extrabold' : 'semibold'} color={fg}>
          {label}
        </AppText>
      </Row>
    </PressableScale>
  );
};
