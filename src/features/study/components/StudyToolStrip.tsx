import React from 'react';
import { FlatList, View } from 'react-native';
import { useDirection, ToneName } from '../../../theme';
import { Chip, IconName } from '../../../components/ui';

export interface StudyTool {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  active?: boolean;
  tone?: ToneName;
}

/** Horizontally scrolling row of study tool chips (audio, draw, AI, edit…). */
export const StudyToolStrip: React.FC<{ tools: StudyTool[] }> = ({ tools }) => {
  const dir = useDirection();
  return (
    <FlatList
      horizontal
      inverted={dir.rtl}
      data={tools}
      keyExtractor={(tool) => tool.key}
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
      ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
      renderItem={({ item }) => (
        <Chip label={item.label} icon={item.icon} selected={!!item.active} onPress={item.onPress} />
      )}
    />
  );
};
