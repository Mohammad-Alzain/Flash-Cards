import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Row, AppText, ProgressRing } from '../../../components/ui';
import type { DeckWithCounts } from '../../../core/db/repositories/deckRepository';
import { masteryRatio } from '../useDeckDetail';

/** Gradient summary: mastery ring + due/new/learning/future counts. */
export const DeckHero: React.FC<{ deck: DeckWithCounts }> = ({ deck }) => {
  const { t } = useTranslation();
  const ratio = masteryRatio(deck);

  const rows = [
    { key: 'due', label: t('deck_detail.due_today'), value: deck.due_count, dot: '#6EE7B7' },
    { key: 'new', label: t('deck_detail.new'), value: deck.new_count, dot: '#93C5FD' },
    { key: 'learn', label: t('deck_detail.learning'), value: deck.learn_count, dot: '#FCD34D' },
    { key: 'future', label: t('deck_detail.future'), value: deck.future_count || 0, dot: '#F9A8D4' },
  ];

  return (
    <Card variant="gradient" padding={18} style={{ marginBottom: 14 }}>
      <Row gap={16}>
        <ProgressRing
          progress={ratio}
          size={104}
          strokeWidth={10}
          color="#FFFFFF"
          trackColor="rgba(255,255,255,0.22)"
          textColor="#FFFFFF"
          label={`${Math.round(ratio * 100)}%`}
          sublabel={t('deck_detail.mastered')}
        />
        <View style={{ flex: 1, gap: 6 }}>
          {rows.map((r) => (
            <Row key={r.key} gap={8}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.dot }} />
              <AppText variant="bodySm" weight="bold" color="rgba(255,255,255,0.85)" style={{ flex: 1 }} numberOfLines={1}>
                {r.label}
              </AppText>
              <AppText variant="bodyStrong" weight="black" color="#FFFFFF">
                {r.value}
              </AppText>
            </Row>
          ))}
        </View>
      </Row>
    </Card>
  );
};
