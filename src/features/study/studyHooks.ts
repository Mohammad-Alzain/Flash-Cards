import { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { renderCard, RenderedCard } from '../../core/render/templateEngine';
import { mediaManager } from '../../core/media/mediaManager';
import { audioService } from '../../core/audio/audioService';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';
import type { StudyCardItem } from '../../core/scheduler/queueBuilder';

/** Delay before auto-play so the card animation settles first. */
const AUTOPLAY_DELAY_MS = 200;

/** Renders the Anki templates of the current study card. */
export const useRenderedCard = (card: StudyCardItem | undefined): RenderedCard | null =>
  useMemo(() => {
    if (!card) return null;
    return renderCard({
      frontTemplate: card.front_template,
      backTemplate: card.back_template,
      fields: card.note_fields,
      css: card.css,
      templateOrd: card.template_ord,
      deckName: card.deck_name,
      tags: card.tags,
      mediaBaseUri: mediaManager.getMediaDirectory(),
    });
  }, [card]);

/** Persisted "auto-play card audio" preference. */
export const useAutoPlayAudio = () => {
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    settingsRepository.get('auto_play_audio', '1').then((val) => setAutoPlay(val !== '0'));
  }, []);

  const toggle = async () => {
    const next = !autoPlay;
    setAutoPlay(next);
    await settingsRepository.set('auto_play_audio', next ? '1' : '0');
    if (!next) audioService.stop();
  };

  return { autoPlay, toggle };
};

/** Plays audio files one after another until finished or cancelled. */
export const playSequence = async (files: string[] | undefined, isCancelled: () => boolean = () => false) => {
  for (const file of files ?? []) {
    if (isCancelled()) break;
    await audioService.playAndWait(file);
  }
};

/**
 * Auto-plays `files` whenever any of `deps` change (and `enabled` is true).
 * Stops playback when the card changes or the screen unmounts.
 */
export const useAutoPlaySequence = (enabled: boolean, files: () => string[] | undefined, deps: unknown[]) => {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, AUTOPLAY_DELAY_MS));
      if (cancelled) return;
      await playSequence(files(), () => cancelled);
    })();
    return () => {
      cancelled = true;
      audioService.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
};

/** Stops any card audio when the study screen unmounts. */
export const useStopAudioOnUnmount = () => {
  useEffect(
    () => () => {
      audioService.stop();
    },
    []
  );
};

export const tapHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  Haptics.impactAsync(style).catch(() => {});
};

/** Front/back text passed to the AI assistant. */
export const aiCardText = (card: StudyCardItem) => {
  const values = Object.values(card.note_fields || {});
  return {
    front: card.note_fields?.Front || values[0] || '',
    back: card.note_fields?.Back || values[1] || '',
  };
};

/** Returns a copy of the queue with the note at `index` updated after editing. */
export const patchQueueItem = (
  queue: StudyCardItem[],
  index: number,
  fields: Record<string, string>,
  tags: string
): StudyCardItem[] => {
  if (!queue[index]) return queue;
  const next = [...queue];
  next[index] = { ...next[index], note_fields: fields, tags };
  return next;
};
