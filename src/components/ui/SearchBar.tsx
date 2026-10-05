import React, { useState } from 'react';
import { View, TextInput, ViewStyle, StyleProp, Pressable, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection } from '../../theme';

interface SearchBarProps extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Trailing element (e.g. filter button). */
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder,
  trailing,
  style,
  ...rest
}) => {
  const { colors } = useTheme();
  const dir = useDirection();
  const [focused, setFocused] = useState(false);
  const isRTL = dir.rtl;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          height: 50,
          borderRadius: 16,
          paddingHorizontal: 14,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : colors.border,
          gap: 10,
        },
        style,
      ]}
    >
      {/* Clear on left for RTL */}
      {isRTL && value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={19} color={colors.textMuted} />
        </Pressable>
      )}

      {/* Search icon on left for LTR */}
      {!isRTL && (
        <Ionicons name="search" size={19} color={focused ? colors.primary : colors.textMuted} />
      )}

      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        textAlign={dir.textAlign}
        cursorColor={colors.primary}
        underlineColorAndroid="transparent"
        style={{
          flex: 1,
          color: colors.text,
          fontSize: 15,
          paddingVertical: 0,
        }}
      />

      {/* Search icon on right for RTL */}
      {isRTL && (
        <Ionicons name="search" size={19} color={focused ? colors.primary : colors.textMuted} />
      )}

      {/* Clear on right for LTR */}
      {!isRTL && value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={19} color={colors.textMuted} />
        </Pressable>
      )}

      {trailing}
    </View>
  );
};
