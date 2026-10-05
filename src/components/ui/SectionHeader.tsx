import React from 'react';
import { StyleProp, ViewStyle, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection, ToneName } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconTile } from './IconTile';
import { IconName } from './types';

interface SectionHeaderProps {
  title: string;
  icon?: IconName;
  tone?: ToneName;
  actionLabel?: string;
  onAction?: () => void;
  /** Right-side custom node (count badge etc.). */
  trailing?: React.ReactNode;
  /** Small caps style for grouped settings lists. */
  subtle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  tone = 'indigo',
  actionLabel,
  onAction,
  trailing,
  subtle = false,
  style,
}) => {
  const { colors } = useTheme();
  const dir = useDirection();

  return (
    <Row gap={10} style={[{ marginBottom: 10, paddingHorizontal: 2 }, style]}>
      {icon && !subtle && <IconTile icon={icon} tone={tone} size={30} />}
      <AppText
        variant={subtle ? 'overline' : 'h3'}
        color={subtle ? 'textMuted' : 'text'}
        style={{ flex: 1 }}
        numberOfLines={1}
      >
        {title}
      </AppText>
      {trailing}
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Row gap={2}>
            <AppText variant="bodySm" weight="extrabold" color="primary">
              {actionLabel}
            </AppText>
            <Ionicons name={dir.forwardIcon} size={14} color={colors.primary} />
          </Row>
        </Pressable>
      )}
    </Row>
  );
};
