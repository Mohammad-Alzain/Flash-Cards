import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
  highlightColor?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevated = true,
  highlightColor,
}) => {
  const { colors, radius, spacing } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: highlightColor || colors.border,
    ...(elevated
      ? {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 2,
        }
      : {}),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && {
            opacity: 0.92,
            transform: [{ scale: 0.985 }],
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
