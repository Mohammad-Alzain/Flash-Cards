import React from 'react';
import { View, StyleProp, ViewStyle, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection, ToneName, alpha } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconTile } from './IconTile';
import { PressableScale } from './PressableScale';
import { IconName } from './types';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  tone?: ToneName;
  /** Custom leading node instead of an icon tile. */
  leading?: React.ReactNode;
  onPress?: () => void;
  /** Trailing value text (e.g. current setting). */
  value?: string;
  /** Switch trailing control. */
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Settings-style row: icon tile · title/subtitle · value/switch/chevron. */
export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  icon,
  tone = 'indigo',
  leading,
  onPress,
  value,
  switchValue,
  onSwitchChange,
  trailing,
  showChevron,
  destructive,
  disabled,
  style,
}) => {
  const { colors } = useTheme();
  const dir = useDirection();
  const hasSwitch = switchValue !== undefined && !!onSwitchChange;
  const chevron = showChevron ?? (!!onPress && !hasSwitch);

  const body = (
    <Row gap={14} style={[{ paddingHorizontal: 14, paddingVertical: 13, opacity: disabled ? 0.5 : 1 }, style]}>
      {leading ?? (icon ? <IconTile icon={icon} tone={destructive ? 'rose' : tone} size={40} /> : null)}
      <View style={{ flex: 1 }}>
        <AppText variant="title" weight="bold" color={destructive ? 'error' : 'text'} numberOfLines={2}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText variant="bodySm" color="textSecondary" numberOfLines={2} style={{ marginTop: 1 }}>
            {subtitle}
          </AppText>
        )}
      </View>
      {!!value && (
        <AppText variant="bodySm" weight="bold" color="textMuted" numberOfLines={1} style={{ maxWidth: 120 }}>
          {value}
        </AppText>
      )}
      {trailing}
      {hasSwitch && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          disabled={disabled}
          trackColor={{ false: colors.border, true: alpha(colors.primary, 0.55) }}
          thumbColor={switchValue ? colors.primary : '#FFFFFF'}
        />
      )}
      {chevron && <Ionicons name={dir.forwardIcon} size={18} color={colors.textMuted} />}
    </Row>
  );

  if (onPress && !disabled) {
    return (
      <PressableScale onPress={onPress} activeScale={0.985} accessibilityRole="button">
        {body}
      </PressableScale>
    );
  }
  if (hasSwitch && !disabled) {
    return (
      <PressableScale onPress={() => onSwitchChange!(!switchValue)} activeScale={0.99} accessibilityRole="switch">
        {body}
      </PressableScale>
    );
  }
  return body;
};

interface ListGroupProps {
  children: React.ReactNode;
  title?: string;
  footer?: string;
  style?: StyleProp<ViewStyle>;
}

/** Rounded card grouping ListItems with hairline separators. */
export const ListGroup: React.FC<ListGroupProps> = ({ children, title, footer, style }) => {
  const { colors, shape, shadow } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ marginBottom: 22 }, style]}>
      {!!title && (
        <AppText variant="overline" color="textMuted" style={{ marginBottom: 8, paddingHorizontal: 6 }}>
          {title}
        </AppText>
      )}
      <View
        style={[
          {
            backgroundColor: colors.surfaceRaised,
            borderRadius: shape.card,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          },
          shadow(1),
        ]}
      >
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 14 }} />}
            {child}
          </React.Fragment>
        ))}
      </View>
      {!!footer && (
        <AppText variant="caption" color="textMuted" style={{ marginTop: 8, paddingHorizontal: 8 }}>
          {footer}
        </AppText>
      )}
    </View>
  );
};
