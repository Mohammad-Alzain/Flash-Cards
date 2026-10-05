import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { Illustration, IllustrationName } from '../illustrations';
import { Button } from './Button';
import { AppText } from './AppText';
import { IconTile } from './IconTile';
import { IconName, isIconName } from './types';

/** Legacy illustration keys mapped to the new mascot scenes. */
export type EmptyIllustrationType = 'study' | 'search' | 'complete' | 'backup' | IllustrationName;

const LEGACY: Record<string, IllustrationName> = {
  study: 'empty-decks',
  complete: 'all-done',
};

interface EmptyStateProps {
  icon?: IconName | React.ReactNode | string;
  branded?: boolean;
  illustration?: EmptyIllustrationType;
  title: string;
  description: string;
  actionTitle?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  secondaryTitle?: string;
  onSecondary?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  branded: _branded,
  illustration,
  title,
  description,
  actionTitle,
  actionIcon,
  onAction,
  secondaryTitle,
  onSecondary,
  compact = false,
  style,
}) => {
  const renderVisual = () => {
    if (illustration) {
      return <Illustration name={LEGACY[illustration] ?? (illustration as IllustrationName)} size={compact ? 150 : 210} />;
    }
    if (isIconName(icon)) {
      return <IconTile icon={icon} tone="indigo" size={72} shape="circle" />;
    }
    if (typeof icon === 'string' && icon !== 'branded') {
      return <AppText size={44}>{icon}</AppText>;
    }
    if (icon && typeof icon !== 'string') return icon;
    return <Illustration name="empty-decks" size={compact ? 150 : 210} />;
  };

  return (
    <View style={[{ alignItems: 'center', paddingVertical: compact ? 16 : 32, paddingHorizontal: 24 }, style]}>
      <View style={{ marginBottom: 14 }}>{renderVisual()}</View>
      <AppText variant="h2" align="center" style={{ marginBottom: 6 }}>
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={{ maxWidth: 320, marginBottom: 20 }}>
        {description}
      </AppText>
      {actionTitle && onAction && (
        <Button title={actionTitle} onPress={onAction} icon={actionIcon} size="md" style={{ minWidth: 180 }} />
      )}
      {secondaryTitle && onSecondary && (
        <Button
          title={secondaryTitle}
          onPress={onSecondary}
          variant="soft"
          size="sm"
          style={{ marginTop: 10 }}
        />
      )}
    </View>
  );
};

