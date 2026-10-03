import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap | React.ReactNode | string;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'file-tray-outline',
  title,
  description,
  actionTitle,
  onAction,
  style,
}) => {
  const { colors, typography, spacing } = useTheme();

  const renderIcon = () => {
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
    return icon;
  };

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
          },
        ]}
      >
        {renderIcon()}
      </View>

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
    padding: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
