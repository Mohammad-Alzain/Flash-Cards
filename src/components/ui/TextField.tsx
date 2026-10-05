import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Ionicons } from '@expo/vector-icons';

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  rtl?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  clearButton?: boolean;
  autoFocus?: boolean;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  multiline = false,
  numberOfLines = 1,
  rtl,
  style,
  inputStyle,
  clearButton = false,
  autoFocus = false,
}) => {
  const { colors, typography, radius, spacing } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // Direction: if specified, use it; otherwise follow app RTL state
  const isTextRTL = rtl !== undefined ? rtl : isRTL();

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: colors.text,
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.bold,
              textAlign: isTextRTL ? 'right' : 'left',
              marginBottom: spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderColor: error
              ? colors.error
              : isFocused
              ? colors.primary
              : colors.border,
            borderBottomWidth: 3,
            borderBottomColor: error
              ? colors.errorPressed
              : isFocused
              ? colors.primaryPressed
              : colors.borderDarker,
            minHeight: multiline ? (numberOfLines || 3) * 24 + 20 : 50,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoFocus={autoFocus}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          textAlign={isTextRTL ? 'right' : 'left'}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: typography.sizes.md,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingLeft: isTextRTL && clearButton && value.length > 0 ? 38 : spacing.md,
              paddingRight: !isTextRTL && clearButton && value.length > 0 ? 38 : spacing.md,
              paddingVertical: spacing.sm,
            },
            inputStyle,
          ]}
        />

        {clearButton && value.length > 0 && !multiline && (
          <Pressable
            onPress={() => onChangeText('')}
            style={[
              styles.clearBtn,
              {
                left: isTextRTL ? 12 : undefined,
                right: isTextRTL ? undefined : 12,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {error && (
        <Text
          style={[
            styles.errorText,
            {
              color: colors.error,
              fontSize: typography.sizes.xs,
              marginTop: 4,
              textAlign: isTextRTL ? 'right' : 'left',
            },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {},
  inputWrapper: {
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
  },
  clearBtn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  errorText: {},
});
