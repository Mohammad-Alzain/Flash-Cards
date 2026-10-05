import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection, ToneName } from '../../../theme';
import { AppText, Row, IconTile, PressableScale, IconName } from '../../../components/ui';

interface StudyActionCardProps {
  title: string;
  subtitle: string;
  count: number;
  icon: IconName;
  tone: ToneName;
  onPress: () => void;
  disabled?: boolean;
}

/** Large tappable study entry point (Review / Learn) with a count bubble. */
export const StudyActionCard: React.FC<StudyActionCardProps> = ({
  title,
  subtitle,
  count,
  icon,
  tone,
  onPress,
  disabled,
}) => {
  const { colors, shape, shadow, tone: getTone } = useTheme();
  const dir = useDirection();
  const t = getTone(tone);
  const active = !disabled && count > 0;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        {
          flex: 1,
          minHeight: 150,
          borderRadius: shape.card,
          padding: 14,
          backgroundColor: active ? t.bg : colors.surfaceRaised,
          borderWidth: 1.5,
          borderColor: active ? t.border : colors.border,
          justifyContent: 'space-between',
          opacity: disabled ? 0.6 : 1,
        },
        active ? null : shadow(1),
      ]}
    >
      <Row justify="space-between" align="flex-start">
        <IconTile icon={icon} tone={tone} size={46} variant={active ? 'solid' : 'soft'} />
        <View
          style={{
            minWidth: 34,
            height: 28,
            paddingHorizontal: 9,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? t.fg : colors.surface,
          }}
        >
          <AppText variant="bodyStrong" weight="black" color={active ? '#FFFFFF' : 'textMuted'} align="center">
            {count}
          </AppText>
        </View>
      </Row>

      <View style={{ marginTop: 12 }}>
        <Row gap={4}>
          <AppText variant="title" weight="extrabold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </AppText>
          <Ionicons name={dir.arrowForwardIcon} size={15} color={active ? t.fg : colors.textMuted} />
        </Row>
        <AppText variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: 2 }}>
          {subtitle}
        </AppText>
      </View>
    </PressableScale>
  );
};
