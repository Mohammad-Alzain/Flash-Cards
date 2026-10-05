import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection, toneForKey } from '../../../theme';
import { AppText, Row, IconTile, PressableScale, ProgressBar } from '../../../components/ui';
import type { DeckWithCounts } from '../../../core/db/repositories/deckRepository';
import { DeckCountPills } from './DeckCountPills';

interface DeckTileProps {
  deck: DeckWithCounts;
  onPress: () => void;
  width?: number;
}

/** Share of a deck's cards that have been seen at least once. */
export const deckSeenRatio = (total: number, unseen: number) => (total > 0 ? (total - unseen) / total : 0);

/** Compact deck card for horizontal carousels. */
export const DeckTile: React.FC<DeckTileProps> = ({ deck, onPress, width = 172 }) => {
  const { colors, shape, shadow, tone } = useTheme();
  const { t } = useTranslation();
  const dir = useDirection();
  const toneName = toneForKey(deck.id);
  const total = deck.total_card_count ?? deck.card_count;
  const unseen = deck.total_new_count ?? deck.new_count;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={deck.name}
      style={[
        {
          width,
          borderRadius: shape.card,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          overflow: 'hidden',
        },
        shadow(1),
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: -30,
          ...dir.end(-30),
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: tone(toneName).bg,
        }}
      />
      <IconTile icon="layers" tone={toneName} size={40} variant="solid" style={{ alignSelf: dir.alignStart }} />
      <AppText variant="title" weight="extrabold" numberOfLines={2} style={{ marginTop: 10, minHeight: 44 }}>
        {deck.name}
      </AppText>
      <AppText variant="caption" color="textMuted" style={{ marginBottom: 8 }}>
        {t('decks.cards_badge', { count: total })}
      </AppText>
      <ProgressBar progress={deckSeenRatio(total, unseen)} color={tone(toneName).fg} height={6} />
      <Row style={{ marginTop: 10 }}>
        <DeckCountPills
          style="dots"
          newCount={deck.new_count}
          learnCount={deck.learn_count}
          dueCount={deck.due_count}
        />
      </Row>
    </PressableScale>
  );
};
