import React, { useState } from 'react';
import { View, TextInput, TextInputProps, ViewStyle, TextStyle, StyleProp, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection, alpha } from '../../theme';
import { AppText } from './AppText';
import { IconName } from './types';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  hint?: string;
  /** Force text direction; defaults to the app language. */
  rtl?: boolean;
  icon?: IconName;
  clearButton?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChangeText,
  error,
  hint,
  multiline = false,
  numberOfLines = 1,
  rtl,
  icon,
  clearButton = false,
  style,
  inputStyle,
  onFocus,
  onBlur,
  ...inputProps
}) => {
  const { colors, shape } = useTheme();
  const dir = useDirection();
  const [focused, setFocused] = useState(false);
  const isRTLText = rtl ?? dir.rtl;
  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;

  return (
    <View style={[{ width: '100%', marginBottom: 16 }, style]}>
      {!!label && (
        <AppText
          variant="bodySm"
          weight="bold"
          color="textSecondary"
          style={{ marginBottom: 6, paddingHorizontal: 4, textAlign: isRTLText ? 'right' : 'left' }}
        >
          {label}
        </AppText>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: colors.surface,
          borderRadius: shape.input,
          borderWidth: 1.5,
          borderColor,
          minHeight: multiline ? (numberOfLines || 3) * 24 + 24 : 52,
          paddingHorizontal: 12,
        }}
      >
        {/* In RTL: clear button sits on the left */}
        {isRTLText && clearButton && value.length > 0 && !multiline && (
          <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear" style={{ paddingHorizontal: 4 }}>
            <Ionicons name="close-circle" size={19} color={colors.textMuted} />
          </Pressable>
        )}

        {/* In LTR: icon sits on the left */}
        {!isRTLText && icon && (
          <Ionicons
            name={icon}
            size={19}
            color={focused ? colors.primary : colors.textMuted}
            style={[
              { marginRight: 8 },
              multiline ? { marginTop: 14 } : undefined,
            ]}
          />
        )}

        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          textAlign={isRTLText ? 'right' : 'left'}
          selectionColor={alpha(colors.primary, 0.4)}
          cursorColor={colors.primary}
          underlineColorAndroid="transparent"
          style={[
            {
              flex: 1,
              color: colors.text,
              fontSize: 15,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingVertical: multiline ? 12 : 10,
              paddingHorizontal: 4,
            },
            inputStyle,
          ]}
        />

        {/* In RTL: icon sits on the right */}
        {isRTLText && icon && (
          <Ionicons
            name={icon}
            size={19}
            color={focused ? colors.primary : colors.textMuted}
            style={[
              { marginLeft: 8 },
              multiline ? { marginTop: 14 } : undefined,
            ]}
          />
        )}

        {/* In LTR: clear button sits on the right */}
        {!isRTLText && clearButton && value.length > 0 && !multiline && (
          <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear" style={{ paddingHorizontal: 4 }}>
            <Ionicons name="close-circle" size={19} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {!!(error || hint) && (
        <View style={{ flexDirection: isRTLText ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 4 }}>
          {error && <Ionicons name="alert-circle" size={14} color={colors.error} />}
          <AppText variant="caption" color={error ? 'error' : 'textMuted'} style={{ flex: 1, textAlign: isRTLText ? 'right' : 'left' }}>
            {error || hint}
          </AppText>
        </View>
      )}
    </View>
  );
};
