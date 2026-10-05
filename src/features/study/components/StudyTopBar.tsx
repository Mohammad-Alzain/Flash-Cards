import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { Row, IconButton, ProgressBar, Badge, BadgeVariant } from '../../../components/ui';

interface StudyTopBarProps {
  progress: number;
  remaining: number;
  /** Colour of the progress fill. */
  color?: string;
  badgeVariant?: BadgeVariant;
  onClose: () => void;
  /** Trailing icon buttons. */
  actions?: React.ReactNode;
}

/** Close · progress · remaining-count · actions. */
export const StudyTopBar: React.FC<StudyTopBarProps> = ({
  progress,
  remaining,
  color,
  badgeVariant = 'due',
  onClose,
  actions,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Row gap={10} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
      <IconButton icon="close" onPress={onClose} size={40} accessibilityLabel={t('common.close')} />
      <View style={{ flex: 1 }}>
        <ProgressBar progress={progress} height={10} color={color ?? colors.primary} />
      </View>
      <Badge variant={badgeVariant} solid label={t('study.remaining', { count: remaining })} />
      {actions}
    </Row>
  );
};
