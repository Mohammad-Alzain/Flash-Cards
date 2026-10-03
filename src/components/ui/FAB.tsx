import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface FABProps {
  onPress: () => void;
  icon?: React.ReactNode | string;
  style?: StyleProp<ViewStyle>;
}

export const FAB: React.FC<FABProps> = ({ onPress, icon, style }) => {
  const { colors, typography, radius } = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  const renderIcon = () => {
    if (!icon) {
      return <Ionicons name="add" size={30} color="#FFFFFF" />;
    }
    if (typeof icon === 'string') {
      if (icon in Ionicons.glyphMap) {
        return <Ionicons name={icon as any} size={26} color="#FFFFFF" />;
      }
      return (
        <Text
          style={[
            styles.iconText,
            {
              color: '#FFFFFF',
              fontSize: typography.sizes.xxl,
              fontWeight: typography.weights.bold,
            },
          ]}
        >
          {icon}
        </Text>
      );
    }
    return icon;
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={[
        styles.fab,
        {
          backgroundColor: colors.primary,
          borderColor: colors.primaryPressed,
          borderRadius: radius.full,
          borderBottomWidth: isPressed ? 0 : 4,
          transform: [{ translateY: isPressed ? 4 : 0 }],
        },
        style,
      ]}
    >
      {renderIcon()}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fab: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  iconText: {
    includeFontPadding: false,
    lineHeight: 34,
  },
});
