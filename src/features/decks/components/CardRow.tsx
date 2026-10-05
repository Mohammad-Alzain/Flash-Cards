import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection } from '../../../theme';
import { AppText, Row, IconTile, Badge, PressableScale, IconName, BadgeVariant } from '../../../components/ui';
import type { BrowserCardItem } from '../../../core/db/repositories/browserRepository';

const STATE_META: Record<'new' | 'learn' | 'due', { icon: IconName; variant: BadgeVariant }> = {
  new: { icon: 'sparkles', variant: 'new' },
  learn: { icon: 'school', variant: 'learn' },
  due: { icon: 'refresh', variant: 'due' },
};

export const cardStateKey = (state: number): 'new' | 'learn' | 'due' =>
  state === 0 ? 'new' : state === 1 ? 'learn' : 'due';

/** Compact row for a card in a list: state icon, prompt, tags, state badge. */
export const CardRow: React.FC<{ item: BrowserCardItem; onPress: () => void }> = ({ item, onPress }) => {
  const { colors, shadow } = useTheme();
  const dir = useDirection();
  const { t } = useTranslation();
  const key = cardStateKey(item.state);
  const meta = STATE_META[key];
  const stateColor = key === 'new' ? colors.newCards : key === 'learn' ? colors.learningCards : colors.dueCards;

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.985}
      style={[
        {
          backgroundColor: colors.surfaceRaised,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 12,
          marginBottom: 8,
        },
        shadow(1),
      ]}
    >
      <Row gap={12}>
        <IconTile icon={meta.icon} color={stateColor} size={38} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item.sort_field || t('deck_detail.no_prompt')}
          </AppText>
          {!!item.tags && (
            <Row gap={4} style={{ marginTop: 2 }}>
              <Ionicons name="pricetag" size={11} color={colors.textMuted} />
              <AppText variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
                {item.tags}
              </AppText>
            </Row>
          )}
        </View>
        <Badge size="sm" variant={meta.variant} label={t(`deck_detail.state_${key}`)} />
        <Ionicons name={dir.forwardIcon} size={16} color={colors.textMuted} />
      </Row>
    </PressableScale>
  );
};
