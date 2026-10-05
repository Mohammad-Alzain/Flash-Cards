import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { PressableScale } from './PressableScale';
import { GradientFill } from './GradientFill';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconName, isIconName } from './types';

interface FABProps {
  onPress: () => void;
  icon?: React.ReactNode | IconName;
  /** Optional label → extended FAB. */
  label?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const FAB: React.FC<FABProps> = ({ onPress, icon, label, accessibilityLabel, style }) => {
  const { heroGradient, shadow } = useTheme();
  const glyph = !icon ? (
    <Ionicons name="add" size={30} color="#FFFFFF" />
  ) : isIconName(icon) ? (
    <Ionicons name={icon} size={26} color="#FFFFFF" />
  ) : (
    icon
  );

  return (
    <PressableScale
      onPress={onPress}
      haptic
      activeScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        {
          height: 60,
          minWidth: 60,
          borderRadius: 22,
          paddingHorizontal: label ? 20 : 0,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        shadow(3, heroGradient[0]),
        style,
      ]}
    >
      <GradientFill colors={heroGradient} radius={22} />
      <Row gap={8}>
        {glyph}
        {!!label && (
          <AppText variant="bodyStrong" weight="extrabold" color="#FFFFFF">
            {label}
          </AppText>
        )}
      </Row>
    </PressableScale>
  );
};
