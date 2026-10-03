import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightElement,
  style,
}) => {
  const { colors, typography, spacing } = useTheme();
  const rtl = isRTL();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          flexDirection: rtl ? 'row-reverse' : 'row',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        },
        style,
      ]}
    >
      <View style={[styles.leftRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={[
              styles.backBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginRight: rtl ? 0 : 12,
                marginLeft: rtl ? 12 : 0,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons
              name={rtl ? 'chevron-forward' : 'chevron-back'}
              size={22}
              color={colors.text}
            />
          </Pressable>
        )}
        <View style={styles.titleColumn}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.bold,
                textAlign: rtl ? 'right' : 'left',
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {rightElement && (
        <View
          style={[
            styles.rightElement,
            {
              marginLeft: rtl ? 0 : 12,
              marginRight: rtl ? 12 : 0,
            },
          ]}
        >
          {rightElement}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    minHeight: 56,
  },
  leftRow: {
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  title: {},
  subtitle: {
    marginTop: 2,
  },
  rightElement: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
