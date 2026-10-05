import React from 'react';
import { View } from 'react-native';
import { useTheme, fontFamilyFor, useDirection } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';
import { IconButton } from './IconButton';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Cycle past max back to min (and vice versa), e.g. for clock values. */
  wrap?: boolean;
  /** Zero-pad the displayed value to this many digits. */
  pad?: number;
  width?: number;
}

/** − [value] + control for small integer settings. Never opens the keyboard. */
export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  wrap = false,
  pad,
  width = 64,
}) => {
  const { colors } = useTheme();
  const dir = useDirection();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const shift = (delta: number) => {
    const next = value + delta;
    if (wrap && Number.isFinite(min) && Number.isFinite(max)) {
      const span = max - min + 1;
      onChange(((((next - min) % span) + span) % span) + min);
    } else {
      onChange(clamp(next));
    }
  };
  const display = pad ? String(value).padStart(pad, '0') : String(value);
  return (
    <Row gap={8}>
      <IconButton icon="remove" size={38} onPress={() => shift(-step)} disabled={!wrap && value <= min} accessibilityLabel="−" />
      <View
        style={{
          width,
          height: 40,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <AppText
          style={{
            color: colors.text,
            fontSize: 16,
            fontFamily: fontFamilyFor('extrabold', dir.arabic),
            writingDirection: 'ltr',
          }}
        >
          {display}
        </AppText>
      </View>
      <IconButton icon="add" size={38} onPress={() => shift(step)} disabled={!wrap && value >= max} accessibilityLabel="+" />
    </Row>
  );
};
