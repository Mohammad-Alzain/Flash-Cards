import { StudyCardItem } from '../scheduler/queueBuilder';
import { TtsService, cleanTextForTts } from './ttsService';
import { audioService } from './audioService';
import { mediaManager } from '../media/mediaManager';
import { renderCard } from '../render/templateEngine';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

let ExpoAudio: any = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  ExpoAudio = null;
}

let Notifications: any = null;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    Notifications = null;
  }
}

export type PlaybackPhase = 'idle' | 'word' | 'thinking' | 'explanation' | 'example' | 'wait_next';

export interface PodcastTracks {
  wordText: string;
  wordAudio: string | null;
  explanationText: string;
  explanationAudio: string | null;
  exampleText: string;
  exampleAudio: string | null;
  extraAudios: string[];
}

export interface PodcastPlayerState {
  isPlaying: boolean;
  currentIndex: number;
  queue: StudyCardItem[];
  phase: PlaybackPhase;
  remainingThinking: number;
  thinkingSeconds: number;
  speechRate: number;
  currentCard: StudyCardItem | null;
  tracks: PodcastTracks | null;
  deckTitle: string;
}

export const PODCAST_NOTIFICATION_CATEGORY = 'PODCAST_PLAYER_ACTIONS';
export const PODCAST_NOTIFICATION_ID = 'podcast-active-player';
export const ACTION_PODCAST_PREV = 'ACTION_PODCAST_PREV';
export const ACTION_PODCAST_TOGGLE = 'ACTION_PODCAST_TOGGLE';
export const ACTION_PODCAST_NEXT = 'ACTION_PODCAST_NEXT';
export const ACTION_PODCAST_STOP = 'ACTION_PODCAST_STOP';
const PODCAST_CHANNEL_ID = 'podcast-playback-channel';

export function extractPodcastTracks(card: StudyCardItem, rendered?: any): PodcastTracks {
  const fields = card?.note_fields || {};

  const getSoundFrom = (str: string | undefined): string | null => {
    if (!str) return null;
    const sounds = audioService.extractSoundTags(str);
    return sounds.length > 0 ? sounds[0] : null;
  };

  // 1. Identify Word (Text & Audio)
  const wordKey =
    Object.keys(fields).find((k) =>
      /word|expression|front|term|vocabulary|الكلمة|المفردة|المصطلح/i.test(k)
    ) || Object.keys(fields)[0];

  const wordText = cleanTextForTts(fields[wordKey] || Object.values(fields)[0] || 'Question');

  let wordAudio: string | null = null;
  if (rendered?.frontAudio && rendered.frontAudio.length > 0) {
    wordAudio = rendered.frontAudio[0];
  } else {
    const wordAudioKey = Object.keys(fields).find((k) =>
      /word.*audio|audio.*word|front.*audio|sound|نطق|صوت.*الكلمة/i.test(k)
    );
    if (wordAudioKey) {
      wordAudio =
        getSoundFrom(fields[wordAudioKey]) ||
        (fields[wordAudioKey].endsWith('.mp3') ? fields[wordAudioKey] : null);
    }
    if (!wordAudio && wordKey) {
      wordAudio = getSoundFrom(fields[wordKey]);
    }
  }

  // 2. Identify Explanation / Meaning (Text & Audio)
  const explanationKey =
    Object.keys(fields).find((k) =>
      /meaning|definition|explanation|translation|back|المعنى|الشرح|الترجمة|التعريف/i.test(k)
    ) || Object.keys(fields)[1];

  const explanationText = cleanTextForTts(fields[explanationKey] || Object.values(fields)[1] || '');

  let explanationAudio: string | null = null;
  const explanationAudioKey = Object.keys(fields).find((k) =>
    /meaning.*audio|explanation.*audio|definition.*audio|translation.*audio|صوت.*المعنى|صوت.*الشرح|صوت.*الترجمة/i.test(k)
  );
  if (explanationAudioKey) {
    explanationAudio =
      getSoundFrom(fields[explanationAudioKey]) ||
      (fields[explanationAudioKey].endsWith('.mp3') ? fields[explanationAudioKey] : null);
  }

  // 3. Identify Example / Sentence (Text & Audio)
  const exampleKey =
    Object.keys(fields).find((k) =>
      /example|sentence|context|sample|المثال|الجملة|سياق/i.test(k)
    ) || (Object.keys(fields).length > 2 ? Object.keys(fields)[2] : null);

  const exampleText = exampleKey ? cleanTextForTts(fields[exampleKey]) : '';

  let exampleAudio: string | null = null;
  const exampleAudioKey = Object.keys(fields).find((k) =>
    /example.*audio|sentence.*audio|context.*audio|صوت.*المثال|صوت.*الجملة/i.test(k)
  );
  if (exampleAudioKey) {
    exampleAudio =
      getSoundFrom(fields[exampleAudioKey]) ||
      (fields[exampleAudioKey].endsWith('.mp3') ? fields[exampleAudioKey] : null);
  }

  // Distribute from rendered.backAudio if explanation or example audio not explicitly assigned
  const backAudios: string[] = rendered?.backAudio || [];
  let backIdx = 0;

  if (!explanationAudio && backAudios.length > backIdx) {
    explanationAudio = backAudios[backIdx];
    backIdx++;
  }
  if (!exampleAudio && backAudios.length > backIdx) {
    exampleAudio = backAudios[backIdx];
    backIdx++;
  }

  // Fallbacks: search field values for sound tags
  if (!explanationAudio && explanationKey) {
    explanationAudio = getSoundFrom(fields[explanationKey]);
  }
  if (!exampleAudio && exampleKey) {
    exampleAudio = getSoundFrom(fields[exampleKey]);
  }

  // Collect any remaining unused audio clips
  const usedSounds = new Set([wordAudio, explanationAudio, exampleAudio].filter(Boolean));
  const extraAudios: string[] = [];
  for (const a of backAudios) {
    if (!usedSounds.has(a) && !extraAudios.includes(a)) {
      extraAudios.push(a);
    }
  }
  for (const val of Object.values(fields)) {
    const s = getSoundFrom(val);
    if (s && !usedSounds.has(s) && !extraAudios.includes(s)) {
      extraAudios.push(s);
    }
  }

  return {
    wordText,
    wordAudio,
    explanationText,
    explanationAudio,
    exampleText,
    exampleAudio,
    extraAudios,
  };
}

class PodcastPlayerService {
  private queue: StudyCardItem[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private phase: PlaybackPhase = 'idle';
  private remainingThinking: number = 3;
  private thinkingSeconds: number = 3;
  private speechRate: number = 1.0;
  private deckTitle: string = 'Flashcards Podcast';

  private listeners: Set<(state: PodcastPlayerState) => void> = new Set();
  private abortController: AbortController | null = null;
  private lockScreenPlayer: any = null;
  private lockScreenSub: any = null;
  private isNotificationChannelSetup = false;
  private lastSeekTime: number = 0;

  constructor() {
    this.setupNotificationChannelAndCategories();
  }

  private async setupNotificationChannelAndCategories() {
    if (!Notifications) return;
    try {
      if (Platform.OS === 'android' && typeof Notifications.setNotificationChannelAsync === 'function') {
        await Notifications.setNotificationChannelAsync(PODCAST_CHANNEL_ID, {
          name: 'مشغل البودكاست (Podcast Player)',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          vibrationPattern: null,
          showBadge: false,
          enableLights: false,
        });
      }

      if (typeof Notifications.setNotificationCategoryAsync === 'function') {
        await Notifications.setNotificationCategoryAsync(PODCAST_NOTIFICATION_CATEGORY, [
          {
            identifier: ACTION_PODCAST_PREV,
            buttonTitle: '⏮️ السابقة',
            options: { opensAppToForeground: false },
          },
          {
            identifier: ACTION_PODCAST_TOGGLE,
            buttonTitle: '⏯️ تشغيل / إيقاف',
            options: { opensAppToForeground: false },
          },
          {
            identifier: ACTION_PODCAST_NEXT,
            buttonTitle: '⏭️ التالية',
            options: { opensAppToForeground: false },
          },
          {
            identifier: ACTION_PODCAST_STOP,
            buttonTitle: '⏹️ إيقاف',
            options: { opensAppToForeground: false },
          },
        ]);
      }
      this.isNotificationChannelSetup = true;
    } catch (e) {
      console.warn('[PodcastService] Could not register notification channel/category:', e);
    }
  }

  public getState(): PodcastPlayerState {
    const currentCard = this.queue[this.currentIndex] || null;
    let tracks: PodcastTracks | null = null;
    if (currentCard) {
      const rendered = renderCard({
        frontTemplate: currentCard.front_template,
        backTemplate: currentCard.back_template,
        fields: currentCard.note_fields,
        css: currentCard.css,
        templateOrd: currentCard.template_ord,
        deckName: currentCard.deck_name,
      });
      tracks = extractPodcastTracks(currentCard, rendered);
    }

    return {
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      queue: this.queue,
      phase: this.phase,
      remainingThinking: this.remainingThinking,
      thinkingSeconds: this.thinkingSeconds,
      speechRate: this.speechRate,
      currentCard,
      tracks,
      deckTitle: this.deckTitle,
    };
  }

  public subscribe(listener: (state: PodcastPlayerState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(state);
      } catch (e) {
        console.error('[PodcastService] Error in listener:', e);
      }
    });
  }

  public setQueue(queue: StudyCardItem[], startIndex = 0, deckTitle = 'Flashcards Podcast') {
    this.stopPlaybackLoop();
    this.queue = queue;
    this.currentIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
    this.deckTitle = deckTitle;
    this.phase = 'idle';
    this.notify();
  }

  public setThinkingSeconds(sec: number) {
    this.thinkingSeconds = sec;
    this.notify();
  }

  public setSpeechRate(rate: number) {
    this.speechRate = rate;
    this.notify();
  }

  /**
   * Initializes or updates the native lockscreen player session with expo-audio
   */
  private async ensureLockScreenPlayer(): Promise<void> {
    if (!ExpoAudio) return;

    try {
      await ExpoAudio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });

      if (!this.lockScreenPlayer) {
        // Use a persistent silent audio loop to retain foreground service on Android / iOS
        const silenceAsset = require('../../../assets/audio/silence.wav');
        this.lockScreenPlayer = ExpoAudio.createAudioPlayer(silenceAsset, {
          keepAudioSessionActive: true,
        });

        if (this.lockScreenPlayer) {
          this.lockScreenPlayer.loop = true;
          this.lockScreenPlayer.volume = 0.01; // Inaudible beacon to keep audio hardware & foreground alive

          if (typeof this.lockScreenPlayer.addListener === 'function') {
            this.lockScreenSub = this.lockScreenPlayer.addListener(
              'playbackStatusUpdate',
              (status: any) => {
                // If the user paused/resumed via system lockscreen controls
                if (status) {
                  if (typeof status.playing === 'boolean') {
                    if (!status.playing && this.isPlaying) {
                      // Lockscreen Pause pressed
                      this.pause();
                    } else if (status.playing && !this.isPlaying && this.phase !== 'idle') {
                      // Lockscreen Play pressed
                      this.play();
                    }
                  }

                  // Handle lockscreen Seek button (Next/Previous Card)
                  if (typeof status.currentTime === 'number') {
                    const now = Date.now();
                    if (now - this.lastSeekTime > 1200) {
                      if (status.currentTime > 5) {
                        this.lastSeekTime = now;
                        this.next();
                      } else if (status.currentTime < 0) {
                        this.lastSeekTime = now;
                        this.prev();
                      }
                    }
                  }
                }
              }
            );
          }
        }
      }

      if (this.lockScreenPlayer) {
        const metadata = this.getCurrentMetadata();
        this.lockScreenPlayer.setActiveForLockScreen(true, metadata, {
          showSeekBackward: true,
          showSeekForward: true,
        });
      }
    } catch (e) {
      console.warn('[PodcastService] Could not initialize lockscreen player:', e);
    }
  }

  private getCurrentMetadata() {
    const state = this.getState();
    const word = state.tracks?.wordText || 'بطاقة المذاكرة';
    const explanation = state.tracks?.explanationText || '';
    const progress = `${this.currentIndex + 1} / ${this.queue.length}`;

    return {
      title: word,
      artist: `${state.deckTitle} • ${progress}`,
      albumTitle: explanation ? explanation.slice(0, 50) : 'Flashcards Review',
    };
  }

  private updateLockScreenAndNotification() {
    const metadata = this.getCurrentMetadata();

    // 1. Update native lockscreen player
    if (this.lockScreenPlayer && typeof this.lockScreenPlayer.updateLockScreenMetadata === 'function') {
      try {
        this.lockScreenPlayer.updateLockScreenMetadata(metadata);
      } catch (e) {}
    }

    // 2. Update custom notification tray player
    this.updateCustomNotification();
  }

  private async updateCustomNotification() {
    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') return;

    try {
      const state = this.getState();
      if (!this.isPlaying && this.phase === 'idle') {
        await Notifications.dismissNotificationAsync(PODCAST_NOTIFICATION_ID);
        return;
      }

      const word = state.tracks?.wordText || 'بطاقة المذاكرة';
      const explanation = state.tracks?.explanationText || '';
      const progress = `${this.currentIndex + 1}/${this.queue.length}`;

      let phaseLabel = '▶️ استماع';
      if (this.phase === 'word') phaseLabel = '🗣️ الكلمة';
      else if (this.phase === 'thinking') phaseLabel = `⏳ تفكير (${this.remainingThinking}ث)`;
      else if (this.phase === 'explanation') phaseLabel = '💡 الشرح';
      else if (this.phase === 'example') phaseLabel = '📝 مثال';
      else if (!this.isPlaying) phaseLabel = '⏸️ متوقف';

      await Notifications.scheduleNotificationAsync({
        identifier: PODCAST_NOTIFICATION_ID,
        content: {
          title: `🎧 ${word} (${progress})`,
          body: `${phaseLabel}: ${explanation ? explanation.slice(0, 70) : state.deckTitle}`,
          categoryIdentifier: PODCAST_NOTIFICATION_CATEGORY,
          sound: false,
          color: '#4F46E5',
          data: {
            isPodcastPlayer: true,
            currentIndex: this.currentIndex,
          },
        },
        trigger: null,
      });
    } catch (e) {
      // Ignore background notification update errors
    }
  }

  public async play(): Promise<void> {
    if (this.queue.length === 0) return;
    this.isPlaying = true;
    this.notify();

    await this.ensureLockScreenPlayer();
    if (this.lockScreenPlayer && typeof this.lockScreenPlayer.play === 'function') {
      try {
        this.lockScreenPlayer.play();
      } catch (e) {}
    }

    this.updateLockScreenAndNotification();
    this.runPlaybackLoop();
  }

  public pause(): void {
    this.isPlaying = false;
    this.stopPlaybackLoop();
    this.notify();

    if (this.lockScreenPlayer && typeof this.lockScreenPlayer.pause === 'function') {
      try {
        this.lockScreenPlayer.pause();
      } catch (e) {}
    }

    this.updateLockScreenAndNotification();
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public next(): void {
    this.stopPlaybackLoop();
    if (this.currentIndex + 1 < this.queue.length) {
      this.currentIndex += 1;
    } else {
      // Loop to beginning if reached end
      this.currentIndex = 0;
    }
    this.notify();
    if (this.isPlaying) {
      this.play();
    } else {
      this.updateLockScreenAndNotification();
    }
  }

  public prev(): void {
    this.stopPlaybackLoop();
    if (this.currentIndex > 0) {
      this.currentIndex -= 1;
    }
    this.notify();
    if (this.isPlaying) {
      this.play();
    } else {
      this.updateLockScreenAndNotification();
    }
  }

  public replayCurrent(): void {
    this.stopPlaybackLoop();
    if (this.isPlaying) {
      this.play();
    }
  }

  public async stop(): Promise<void> {
    this.isPlaying = false;
    this.phase = 'idle';
    this.stopPlaybackLoop();
    this.notify();

    if (this.lockScreenPlayer) {
      try {
        this.lockScreenPlayer.clearLockScreenControls();
        this.lockScreenPlayer.pause();
      } catch (e) {}
    }

    if (Notifications && typeof Notifications.dismissNotificationAsync === 'function') {
      try {
        await Notifications.dismissNotificationAsync(PODCAST_NOTIFICATION_ID);
      } catch (e) {}
    }
  }

  private stopPlaybackLoop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    TtsService.stop();
    audioService.stop();
  }

  private async sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      let timeoutId: any = null;
      const onAbort = () => {
        clearTimeout(timeoutId);
        resolve(false);
      };

      if (signal?.aborted) {
        resolve(false);
        return;
      }

      timeoutId = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve(true);
      }, ms);

      signal?.addEventListener('abort', onAbort);
    });
  }

  private async runPlaybackLoop(): Promise<void> {
    this.stopPlaybackLoop();
    const abort = new AbortController();
    this.abortController = abort;
    const { signal } = abort;

    while (this.isPlaying && !signal.aborted && this.currentIndex < this.queue.length) {
      const card = this.queue[this.currentIndex];
      const rendered = renderCard({
        frontTemplate: card.front_template,
        backTemplate: card.back_template,
        fields: card.note_fields,
        css: card.css,
        templateOrd: card.template_ord,
        deckName: card.deck_name,
      });

      const tracks = extractPodcastTracks(card, rendered);
      this.updateLockScreenAndNotification();

      // Phase 1: Play Word (Audio file or TTS)
      this.phase = 'word';
      this.notify();
      this.updateLockScreenAndNotification();

      let playedWord = false;
      if (tracks.wordAudio) {
        playedWord = await audioService.playAndWait(tracks.wordAudio);
      }
      if (!playedWord && tracks.wordText && !signal.aborted) {
        await new Promise<void>((resolve) => {
          TtsService.speak(tracks.wordText, {
            rate: this.speechRate,
            onDone: () => resolve(),
            onError: () => resolve(),
          });
        });
      }

      if (signal.aborted || !this.isPlaying) break;

      // Phase 2: Thinking Pause (فترة التفكير)
      if (this.thinkingSeconds > 0) {
        this.phase = 'thinking';
        for (let s = this.thinkingSeconds; s > 0; s--) {
          if (signal.aborted || !this.isPlaying) break;
          this.remainingThinking = s;
          this.notify();
          this.updateLockScreenAndNotification();
          const ok = await this.sleep(1000, signal);
          if (!ok) break;
        }
        this.remainingThinking = 0;
      }

      if (signal.aborted || !this.isPlaying) break;

      // Phase 3: Play Explanation (Audio file or TTS)
      this.phase = 'explanation';
      this.notify();
      this.updateLockScreenAndNotification();

      let playedExp = false;
      if (tracks.explanationAudio) {
        playedExp = await audioService.playAndWait(tracks.explanationAudio);
      }
      if (!playedExp && tracks.explanationText && !tracks.explanationText.includes('<img') && !signal.aborted) {
        await new Promise<void>((resolve) => {
          TtsService.speak(tracks.explanationText, {
            rate: this.speechRate,
            onDone: () => resolve(),
            onError: () => resolve(),
          });
        });
      }

      if (signal.aborted || !this.isPlaying) break;

      // Brief natural pause
      await this.sleep(600, signal);
      if (signal.aborted || !this.isPlaying) break;

      // Phase 4: Play Example (Audio file or TTS)
      if (tracks.exampleAudio || (tracks.exampleText && !tracks.exampleText.includes('<img'))) {
        this.phase = 'example';
        this.notify();
        this.updateLockScreenAndNotification();

        let playedEx = false;
        if (tracks.exampleAudio) {
          playedEx = await audioService.playAndWait(tracks.exampleAudio);
        }
        if (!playedEx && tracks.exampleText && !signal.aborted) {
          await new Promise<void>((resolve) => {
            TtsService.speak(tracks.exampleText, {
              rate: this.speechRate,
              onDone: () => resolve(),
              onError: () => resolve(),
            });
          });
        }
      }

      if (signal.aborted || !this.isPlaying) break;

      // Phase 5: Extra audios attached to the card
      for (const extra of tracks.extraAudios) {
        if (signal.aborted || !this.isPlaying) break;
        await this.sleep(400, signal);
        await audioService.playAndWait(extra);
      }

      if (signal.aborted || !this.isPlaying) break;

      // Phase 6: Wait next card
      this.phase = 'wait_next';
      this.notify();
      this.updateLockScreenAndNotification();
      await this.sleep(1200, signal);

      if (signal.aborted || !this.isPlaying) break;

      // Phase 7: Advance to next card
      if (this.currentIndex + 1 < this.queue.length) {
        this.currentIndex += 1;
        this.notify();
      } else {
        // Finished entire playlist
        this.isPlaying = false;
        this.phase = 'idle';
        this.notify();
        this.updateLockScreenAndNotification();
        break;
      }
    }

    if (this.abortController === abort) {
      this.abortController = null;
    }
  }
}

export const podcastPlayerService = new PodcastPlayerService();
