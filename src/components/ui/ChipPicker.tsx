import React from 'react';
import { View, FlatList } from 'react-native';
import { useDirection } from '../../theme';
import { Chip } from './Chip';
import { IconName } from './types';

interface ChipPickerProps<T> {
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  icon?: IconName;
  bleed?: boolean;
}

/** Horizontal single-select chip list (decks, note types…). */
export function ChipPicker<T>({ items, selectedId, onSelect, getId, getLabel, icon, bleed = false }: ChipPickerProps<T>) {
  const dir = useDirection();
  return (
    <FlatList
      horizontal
      inverted={dir.rtl}
      data={items}
      keyExtractor={getId}
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, bleed ? { marginHorizontal: -16 } : undefined]}
      contentContainerStyle={bleed ? { paddingHorizontal: 16 } : undefined}
      ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
      renderItem={({ item }) => (
        <Chip label={getLabel(item)} icon={icon} selected={getId(item) === selectedId} onPress={() => onSelect(getId(item))} />
      )}
    />
  );
}
