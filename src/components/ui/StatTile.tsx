import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme, useDirection, ToneName } from '../../theme';
import { AppText } from './AppText';
import { IconTile } from './IconTile';
import { IconName } from './types';

interface StatTileProps {
  icon: IconName;
  tone?: ToneName;
  value: string | number;
  label: string;
  /** `compact` = small centred pill-style tile used in rows of 3–4. */
  layout?: 'stacked' | 'compact';
  style?: StyleProp<ViewStyle>;
}

export const StatTile: React.FC<StatTileProps> = ({
  icon,
  tone = 'indigo',
  value,
  label,
  layout = 'stacked',
  style,
}) => {
  const { colors, shape, shadow } = useTheme();
  const dir = useDirection();
  const compact = layout === 'compact';

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.surfaceRaised,
          borderRadius: compact ? 18 : shape.card,
          borderWidth: 1,
          borderColor: colors.border,
          padding: compact ? 10 : 14,
          alignItems: compact ? 'center' : undefined,
          gap: compact ? 4 : 10,
        },
        shadow(1),
        style,
      ]}
    >
      <IconTile icon={icon} tone={tone} size={compact ? 34 : 38} style={compact ? undefined : { alignSelf: dir.alignStart }} />
      <View style={{ alignItems: compact ? 'center' : undefined }}>
        <AppText variant="number" size={compact ? 18 : 22} align={compact ? 'center' : 'auto'} numberOfLines={1}>
          {value}
        </AppText>
        <AppText variant="caption" color="textSecondary" align={compact ? 'center' : 'auto'} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </View>
  );
};
