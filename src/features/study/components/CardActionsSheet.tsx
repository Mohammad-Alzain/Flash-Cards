import React from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, ListGroup, ListItem, Button } from '../../../components/ui';

export type CardAction = 'suspend' | 'bury' | 'reset';

interface CardActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onAction: (action: CardAction) => void;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
}

export const CardActionsSheet: React.FC<CardActionsSheetProps> = ({
  visible,
  onClose,
  onAction,
  autoPlay,
  onToggleAutoPlay,
}) => {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('study.actions')}
      icon="ellipsis-horizontal-circle"
      tone="slate"
      footer={<Button title={t('common.cancel')} variant="ghost" onPress={onClose} fullWidth />}
    >
      <ListGroup style={{ marginBottom: 0 }}>
        <ListItem
          icon="musical-notes"
          tone="violet"
          title={t('study.autoplay_state', { state: autoPlay ? t('study.state_on') : t('study.state_off') })}
          subtitle={t('study.autoplay_desc')}
          switchValue={autoPlay}
          onSwitchChange={onToggleAutoPlay}
        />
        <ListItem icon="pause-circle" tone="amber" title={t('study.suspend')} subtitle={t('study.suspend_desc')} onPress={() => onAction('suspend')} />
        <ListItem icon="moon" tone="sky" title={t('study.bury')} subtitle={t('study.bury_desc')} onPress={() => onAction('bury')} />
        <ListItem icon="refresh-circle" destructive title={t('study.reset')} subtitle={t('study.reset_desc')} onPress={() => onAction('reset')} />
      </ListGroup>
    </BottomSheet>
  );
};
