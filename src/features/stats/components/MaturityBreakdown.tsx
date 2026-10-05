import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '../../../theme';
import { AppText, Row, ProgressBar, IconTile, IconName } from '../../../components/ui';
import type { CardMaturityBreakdown } from '../../../core/db/repositories/statsRepository';

interface MaturityBreakdownProps {
  maturity: CardMaturityBreakdown;
  total: number;
}

/** Stacked overview bar + one row per maturity stage. */
export const MaturityBreakdown: React.FC<MaturityBreakdownProps> = ({ maturity, total }) => {
  const { colors, tone } = useTheme();
  const { t } = useTranslation();
  const mature = tone('green').fg;

  const stages: { key: string; icon: IconName; color: string; label: string; count: number }[] = [
    { key: 'new', icon: 'sparkles', color: colors.newCards, label: t('stats.stage_new'), count: maturity.newCards },
    { key: 'learning', icon: 'school', color: colors.learningCards, label: t('stats.stage_learning'), count: maturity.learning },
    { key: 'mature', icon: 'trophy', color: mature, label: t('stats.stage_mature'), count: maturity.mature },
  ];
  if (maturity.leeches > 0) {
    stages.push({ key: 'leeches', icon: 'bug', color: colors.error, label: t('stats.stage_leeches'), count: maturity.leeches });
  }
  const share = (v: number) => (total > 0 ? v / total : 0);

  return (
    <View>
      {/* Overview strip */}
      <Row style={{ height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: colors.surface, marginBottom: 16 }}>
        {stages
          .filter((s) => s.key !== 'leeches' && s.count > 0)
          .map((s) => (
            <View key={s.key} style={{ flex: s.count, backgroundColor: s.color }} />
          ))}
      </Row>

      {stages.map((s) => (
        <Row key={s.key} gap={12} style={{ marginBottom: 12 }}>
          <IconTile icon={s.icon} color={s.color} size={36} />
          <View style={{ flex: 1 }}>
            <Row justify="space-between" style={{ marginBottom: 6 }}>
              <AppText variant="bodySm" weight="bold" color={s.key === 'leeches' ? 'error' : 'text'} style={{ flex: 1 }} numberOfLines={1}>
                {s.label}
              </AppText>
              <View style={{ backgroundColor: alpha(s.color, 0.14), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
                <AppText variant="caption" weight="black" color={s.color}>
                  {s.count}
                </AppText>
              </View>
            </Row>
            <ProgressBar progress={share(s.count)} color={s.color} height={7} />
          </View>
        </Row>
      ))}
    </View>
  );
};
