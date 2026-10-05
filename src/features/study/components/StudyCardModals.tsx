import React from 'react';
import { NoteEditorModal } from '../../../components/card/NoteEditorModal';
import { AIAssistantModal } from '../../../components/card/AIAssistantModal';
import type { StudyCardItem } from '../../../core/scheduler/queueBuilder';
import { aiCardText } from '../studyHooks';

interface StudyCardModalsProps {
  card: StudyCardItem | undefined;
  editVisible: boolean;
  aiVisible: boolean;
  onCloseEdit: () => void;
  onCloseAI: () => void;
  onNoteSaved: (fields: Record<string, string>, tags: string) => void;
}

/** Note editor + AI assistant overlays shared by the study screens. */
export const StudyCardModals: React.FC<StudyCardModalsProps> = ({
  card,
  editVisible,
  aiVisible,
  onCloseEdit,
  onCloseAI,
  onNoteSaved,
}) => (
  <>
    <NoteEditorModal
      visible={editVisible}
      noteId={card ? card.note_id : null}
      onClose={onCloseEdit}
      onSaved={(fields, tags) => {
        if (card) onNoteSaved(fields, tags);
      }}
    />
    {card && (
      <AIAssistantModal
        visible={aiVisible}
        onClose={onCloseAI}
        cardId={card.id}
        {...aiCardText(card)}
        deckName={card.deck_name}
        fields={card.note_fields}
      />
    )}
  </>
);
