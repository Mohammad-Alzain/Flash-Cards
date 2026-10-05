import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTheme, useDirection, ToneName } from '../../theme';
import { Logo } from '../brand/Logo';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconButton } from './IconButton';
import { IconTile } from './IconTile';
import { IconName } from './types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  logo?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  /** Decorative icon tile beside the title. */
  icon?: IconName;
  iconTone?: ToneName;
  /** Large title layout for tab roots. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Screen header: back button, optional icon tile, title/subtitle and trailing actions. */
export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  logo = false,
  onBack,
  rightElement,
  icon,
  iconTone = 'indigo',
  large = false,
  style,
}) => {
  const { colors } = useTheme();
  const dir = useDirection();

  return (
    <Row
      gap={12}
      style={[
        {
          backgroundColor: colors.background,
          paddingHorizontal: 16,
          paddingTop: large ? 10 : 8,
          paddingBottom: large ? 8 : 8,
          minHeight: 60,
        },
        style,
      ]}
    >
      {onBack && (
        <IconButton icon={dir.backIcon} onPress={onBack} accessibilityLabel="Back" size={40} />
      )}
      {logo && <Logo variant="mark" size={28} />}
      {icon && !logo && <IconTile icon={icon} tone={iconTone} size={large ? 42 : 36} variant="soft" />}

      <View style={{ flex: 1 }}>
        <AppText variant={large ? 'h1' : 'h3'} weight={large ? 'black' : 'extrabold'} numberOfLines={1}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText variant="bodySm" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>

      {rightElement && <Row gap={8}>{rightElement}</Row>}
    </Row>
  );
};
