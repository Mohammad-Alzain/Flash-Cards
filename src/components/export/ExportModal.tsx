import React from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, Row } from '../ui';
import { useExporter } from '../../features/export/useExporter';
import { ExportOptionsForm, ExportProgressView, ExportResultView, ExportError } from '../../features/export/components/ExportParts';

interface ExportModalProps {
  visible: boolean;
  deckId?: string;
  deckName?: string;
  onClose: () => void;
}

/** Deck export sheet: configure → progress → result (save / share). */
export const ExportModal: React.FC<ExportModalProps> = ({ visible, deckId, deckName, onClose }) => {
  const { t } = useTranslation();
  const ex = useExporter();
  const exporting = ex.busy === 'export';

  const close = () => {
    if (exporting || ex.busy === 'save') return; // don't interrupt a running export/save
    ex.reset();
    onClose();
  };

  const configuring = !ex.result && !exporting;

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={t('export.deck_title')}
      subtitle={deckName}
      icon="share-social"
      tone="pink"
      scrollable
      footer={
        configuring ? (
          <Row gap={10}>
            <Button title={t('common.cancel')} variant="ghost" onPress={close} style={{ flex: 1 }} />
            <Button title={t('export.export_now')} icon="download" onPress={() => ex.runExport(deckId)} style={{ flex: 1 }} />
          </Row>
        ) : undefined
      }
    >
      {ex.result ? (
        <ExportResultView ex={ex} onClose={close} />
      ) : exporting ? (
        <ExportProgressView ex={ex} />
      ) : (
        <>
          <ExportOptionsForm ex={ex} />
          <ExportError message={ex.error} />
        </>
      )}
    </BottomSheet>
  );
};
