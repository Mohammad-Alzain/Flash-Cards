import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';
import { PressableScale } from './PressableScale';
import { IconName } from './types';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedControlProps<T>) {
  const { colors, shadow } = useTheme();
  return (
    <Row
      gap={4}
      style={[{ backgroundColor: colors.surface, borderRadius: 16, padding: 4 }, style]}
      accessibilityRole="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            onPress={() => onChange(opt.value)}
            haptic
            activeScale={0.96}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              {
                flex: 1,
                borderRadius: 12,
                paddingVertical: 9,
                paddingHorizontal: 6,
                backgroundColor: active ? colors.surfaceRaised : 'transparent',
              },
              active ? shadow(1) : null,
            ]}
          >
            <Row gap={6} justify="center">
              {opt.icon && <Ionicons name={opt.icon} size={16} color={active ? colors.primary : colors.textMuted} />}
              <AppText
                variant="bodySm"
                weight={active ? 'extrabold' : 'semibold'}
                color={active ? 'primary' : 'textSecondary'}
                align="center"
                numberOfLines={1}
              >
                {opt.label}
              </AppText>
            </Row>
          </PressableScale>
        );
      })}
    </Row>
  );
}
