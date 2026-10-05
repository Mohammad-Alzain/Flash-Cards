import { useState, useEffect } from 'react';
import { podcastPlayerService, PodcastPlayerState } from './podcastPlayerService';
import { StudyCardItem } from '../scheduler/queueBuilder';

export function usePodcastPlayer() {
  const [state, setState] = useState<PodcastPlayerState>(podcastPlayerService.getState());

  useEffect(() => {
    const unsubscribe = podcastPlayerService.subscribe((newState) => {
      setState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    play: () => podcastPlayerService.play(),
    pause: () => podcastPlayerService.pause(),
    togglePlay: () => podcastPlayerService.togglePlay(),
    next: () => podcastPlayerService.next(),
    prev: () => podcastPlayerService.prev(),
    replayCurrent: () => podcastPlayerService.replayCurrent(),
    stop: () => podcastPlayerService.stop(),
    setThinkingSeconds: (sec: number) => podcastPlayerService.setThinkingSeconds(sec),
    setSpeechRate: (rate: number) => podcastPlayerService.setSpeechRate(rate),
    setQueue: (queue: StudyCardItem[], startIndex?: number, deckTitle?: string) =>
      podcastPlayerService.setQueue(queue, startIndex, deckTitle),
  };
}
