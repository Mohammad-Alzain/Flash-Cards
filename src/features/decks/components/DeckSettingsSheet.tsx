import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, TextField, Button, Row } from '../../../components/ui';
import { CustomAlert } from '../../../components/common/CustomDialog';
import { deckRepository, DeckWithCounts } from '../../../core/db/repositories/deckRepository';

const DEFAULT_NEW_PER_DAY = 20;
const DEFAULT_REVIEWS_PER_DAY = 100;

interface DeckSettingsSheetProps {
  deck: DeckWithCounts;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Edit deck name, description and daily limits. */
export const DeckSettingsSheet: React.FC<DeckSettingsSheetProps> = ({ deck, visible, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [newPerDay, setNewPerDay] = useState(String(DEFAULT_NEW_PER_DAY));
  const [reviewsPerDay, setReviewsPerDay] = useState(String(DEFAULT_REVIEWS_PER_DAY));

  // Reset the form from the latest deck values whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setName(deck.name);
    setDesc(deck.description || '');
    setNewPerDay(String(deck.new_per_day || DEFAULT_NEW_PER_DAY));
    setReviewsPerDay(String(deck.reviews_per_day || DEFAULT_REVIEWS_PER_DAY));
  }, [visible, deck]);

  const save = async () => {
    try {
      await deckRepository.update(deck.id, {
        name: name.trim(),
        description: desc.trim(),
        new_per_day: parseInt(newPerDay, 10) || DEFAULT_NEW_PER_DAY,
        reviews_per_day: parseInt(reviewsPerDay, 10) || DEFAULT_REVIEWS_PER_DAY,
      });
      onClose();
      onSaved();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('deck_detail.settings')}
      icon="options"
      tone="sky"
      scrollable
      footer={
        <Row gap={10}>
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button title={t('common.save')} icon="checkmark" onPress={save} style={{ flex: 1 }} />
        </Row>
      }
    >
      <TextField label={t('decks.deck_name')} value={name} onChangeText={setName} icon="text" />
      <TextField label={t('decks.deck_desc')} value={desc} onChangeText={setDesc} multiline numberOfLines={2} />
      <Row gap={10} align="flex-start">
        <TextField
          label={t('deck_detail.new_per_day')}
          value={newPerDay}
          onChangeText={setNewPerDay}
          keyboardType="number-pad"
          icon="sparkles"
          style={{ flex: 1, width: undefined }}
        />
        <TextField
          label={t('deck_detail.reviews_per_day')}
          value={reviewsPerDay}
          onChangeText={setReviewsPerDay}
          keyboardType="number-pad"
          icon="refresh"
          style={{ flex: 1, width: undefined }}
        />
      </Row>
    </BottomSheet>
  );
};
