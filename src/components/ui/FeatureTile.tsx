import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useTheme, useDirection, ToneName } from '../../theme';
import { AppText } from './AppText';
import { IconTile } from './IconTile';
import { PressableScale } from './PressableScale';
import { IconName } from './types';

interface FeatureTileProps {
  icon: IconName;
  tone: ToneName;
  title: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Grid tile linking to a feature: coloured icon, title and one-line description. */
export const FeatureTile: React.FC<FeatureTileProps> = ({
  icon,
  tone,
  title,
  description,
  onPress,
  disabled,
  style,
}) => {
  const { colors, shape, shadow } = useTheme();
  const dir = useDirection();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        {
          flex: 1,
          minHeight: 128,
          borderRadius: shape.card,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          opacity: disabled ? 0.5 : 1,
        },
        shadow(1),
        style,
      ]}
    >
      <IconTile icon={icon} tone={tone} size={44} style={{ alignSelf: dir.alignStart }} />
      <AppText variant="title" weight="extrabold" numberOfLines={1} style={{ marginTop: 12 }}>
        {title}
      </AppText>
      {!!description && (
        <AppText variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: 2 }}>
          {description}
        </AppText>
      )}
    </PressableScale>
  );
};
