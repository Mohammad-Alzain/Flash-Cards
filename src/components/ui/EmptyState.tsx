import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Button } from './Button';
import {
  Logo,
  EmptyStudyIllustration,
  EmptySearchIllustration,
  SessionCompleteIllustration,
  VaultBackupIllustration,
} from '../brand';

export type EmptyIllustrationType = 'study' | 'search' | 'complete' | 'backup';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap | React.ReactNode | string;
  branded?: boolean;
  illustration?: EmptyIllustrationType;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  branded = false,
  illustration,
  title,
  description,
  actionTitle,
  onAction,
  style,
}) => {
  const { colors, typography, spacing } = useTheme();

  const isIllustrated = branded || !!illustration || icon === 'branded';

  const renderVisual = () => {
    if (illustration === 'search') {
      return <EmptySearchIllustration size={140} />;
    }
    if (illustration === 'complete') {
      return <SessionCompleteIllustration size={140} />;
    }
    if (illustration === 'backup') {
      return <VaultBackupIllustration size={130} />;
    }
    if (branded || illustration === 'study' || icon === 'branded') {
      return <EmptyStudyIllustration size={150} />;
    }

    if (typeof icon === 'string') {
      if (icon in Ionicons.glyphMap) {
        return (
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={36}
            color={colors.primary}
          />
        );
      }
      return <Text style={styles.icon}>{icon}</Text>;
    }

    if (icon) {
      return icon;
    }

    // Default to branded study illustration
    return <EmptyStudyIllustration size={150} />;
  };

  return (
    <View style={[styles.container, style]}>
      {isIllustrated || !icon ? (
        <View style={styles.illustrationWrapper}>
          {renderVisual()}
        </View>
      ) : (
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
        >
          {renderVisual()}
        </View>
      )}

      <Text
        style={[
          styles.title,
          {
            color: colors.text,
            fontSize: typography.sizes.xl,
            fontWeight: typography.weights.bold,
            marginBottom: spacing.xs,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.description,
          {
            color: colors.textSecondary,
            fontSize: typography.sizes.md,
            marginBottom: spacing.xl,
          },
        ]}
      >
        {description}
      </Text>

      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          size="md"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  illustrationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
