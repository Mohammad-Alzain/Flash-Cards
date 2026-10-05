import React from 'react';
import { FlatList, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection } from '../../theme';
import { AppText } from './AppText';
import { Row } from './Row';
import { Chip } from './Chip';
import { IconName } from './types';

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  icon?: IconName;
}

interface ChoiceChipsProps<T extends string | number> {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  labelIcon?: IconName;
  /** Horizontal scroll (many options) or wrap (few options). */
  layout?: 'scroll' | 'wrap';
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Labelled single-select chip group. */
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  label,
  labelIcon,
  layout = 'wrap',
  color,
  style,
}: ChoiceChipsProps<T>) {
  const { colors } = useTheme();
  const dir = useDirection();

  const chips = options.map((o) => (
    <Chip
      key={String(o.value)}
      label={o.label}
      icon={o.icon}
      color={color}
      selected={o.value === value}
      onPress={() => onChange(o.value)}
    />
  ));

  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {!!label && (
        <Row gap={6} style={{ marginBottom: 8 }}>
          {labelIcon && <Ionicons name={labelIcon} size={15} color={colors.textSecondary} />}
          <AppText variant="bodySm" weight="bold" color="textSecondary">
            {label}
          </AppText>
        </Row>
      )}
      {layout === 'scroll' ? (
        <FlatList
          horizontal
          inverted={dir.rtl}
          data={chips}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => item}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16 }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        />
      ) : (
        <Row gap={8} wrap>
          {chips}
        </Row>
      )}
    </View>
  );
}
