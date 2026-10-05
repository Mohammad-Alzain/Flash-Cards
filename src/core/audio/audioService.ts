import { mediaManager } from '../media/mediaManager';
import { TtsService, TtsOptions } from './ttsService';

let ExpoAudio: any = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  ExpoAudio = null;
}

class AudioPlaybackService {
  private currentPlayer: any = null;
  private currentSubscription: any = null;
  private currentFinishResolver: ((success: boolean) => void) | null = null;
  private activeSessionId = 0;
  private isAudioModeConfigured = false;

  private async configureAudioMode(): Promise<void> {
    if (this.isAudioModeConfigured) return;
    try {
      if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
        await ExpoAudio.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
      }
      if (ExpoAudio && typeof ExpoAudio.clearAllPreloadedSources === 'function') {
        try {
          await ExpoAudio.clearAllPreloadedSources();
        } catch {}
      }
      this.isAudioModeConfigured = true;
    } catch (e) {
      console.warn('[AudioService] Could not set audio mode:', e);
    }
  }

  /**
   * Completely destroys an AudioPlayer instance and frees native Android/iOS hardware resources.
   * Prevents ExoPlayer / MediaCodec / AudioTrack exhaustion on Android.
   */
  private destroyPlayer(player: any, subscription?: any): void {
    if (subscription) {
      try {
        subscription.remove?.();
      } catch (e) {}
    }
    if (!player) return;

    try {
      if (typeof player.pause === 'function') {
        player.pause();
      }
    } catch (e) {}

    try {
      if (typeof player.remove === 'function') {
        player.remove();
      }
    } catch (e) {}

    try {
      if (typeof player.release === 'function') {
        player.release();
      }
    } catch (e) {}
  }

  /**
   * Plays an audio file by filename (stored in media directory) or absolute URI
   */
  async play(filenameOrUri: string): Promise<boolean> {
    if (!filenameOrUri) return false;

    console.log(`[MEDIA] Requested audio playback: "${filenameOrUri}"`);
    try {
      await this.configureAudioMode();
      await this.stop();

      const existingUri = await mediaManager.resolveMediaUri(filenameOrUri);
      console.log(`[MEDIA] Resolved audio URI: "${existingUri}", exists: ${existingUri !== null}`);
      if (!existingUri) return false;

      const safeUri = encodeURI(decodeURI(existingUri)).replace(/#/g, '%23');
      const sessionId = ++this.activeSessionId;

      // 1. Try modern expo-audio (SDK 57)
      if (ExpoAudio && typeof ExpoAudio.createAudioPlayer === 'function') {
        let player: any = null;
        try {
          player = ExpoAudio.createAudioPlayer({ uri: safeUri }, { updateInterval: 100 });
        } catch (createErr) {
          console.warn('[AudioService] createAudioPlayer failed:', createErr);
          return false;
        }

        this.currentPlayer = player;

        if (typeof player.addListener === 'function') {
          const sub = player.addListener('playbackStatusUpdate', (status: any) => {
            if (this.activeSessionId !== sessionId) {
              this.destroyPlayer(player, sub);
              return;
            }

            if (status?.didJustFinish || status?.error) {
              if (this.currentPlayer === player) {
                this.currentPlayer = null;
                this.currentSubscription = null;
              }
              this.destroyPlayer(player, sub);
            }
          });
          this.currentSubscription = sub;
        }

        player.play();
        return true;
      }

      // 2. HTML5 Web / fallback audio
      if (typeof Audio !== 'undefined') {
        const audio = new Audio(safeUri);
        this.currentPlayer = audio;
        audio.onended = () => {
          if (this.currentPlayer === audio) this.currentPlayer = null;
        };
        audio.onerror = () => {
          if (this.currentPlayer === audio) this.currentPlayer = null;
        };
        audio.play().catch(() => {});
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[AudioService] play error:', err);
      return false;
    }
  }

  /**
   * Plays an audio file and returns a Promise that resolves when playback finishes or times out.
   */
  async playAndWait(filenameOrUri: string, maxDurationMs = 15000): Promise<boolean> {
    if (!filenameOrUri) return false;

    console.log(`[MEDIA] Requested audio playback (wait): "${filenameOrUri}"`);
    try {
      await this.configureAudioMode();
      await this.stop();

      const existingUri = await mediaManager.resolveMediaUri(filenameOrUri);
      console.log(`[MEDIA] Resolved audio URI (wait): "${existingUri}", exists: ${existingUri !== null}`);
      if (!existingUri) return false;

      const safeUri = encodeURI(decodeURI(existingUri)).replace(/#/g, '%23');
      const sessionId = ++this.activeSessionId;

      // 1. Try modern expo-audio (SDK 57)
      if (ExpoAudio && typeof ExpoAudio.createAudioPlayer === 'function') {
        let player: any = null;
        try {
          player = ExpoAudio.createAudioPlayer({ uri: safeUri }, { updateInterval: 100 });
        } catch (createErr) {
          console.warn('[AudioService] createAudioPlayer failed in playAndWait:', createErr);
          return false;
        }

        this.currentPlayer = player;

        return new Promise<boolean>((resolve) => {
          let finished = false;
          let hasStartedPlaying = false;

          const finish = (result: boolean) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeoutId);

            if (this.currentFinishResolver === finish) {
              this.currentFinishResolver = null;
            }
            if (this.currentPlayer === player) {
              this.currentPlayer = null;
              this.currentSubscription = null;
            }

            // Immediately destroy player and free native hardware decoders
            this.destroyPlayer(player, subscription);
            resolve(result);
          };

          this.currentFinishResolver = finish;

          const timeoutId = setTimeout(() => {
            finish(true);
          }, maxDurationMs);

          let subscription: any = null;
          if (typeof player.addListener === 'function') {
            subscription = player.addListener('playbackStatusUpdate', (status: any) => {
              if (this.activeSessionId !== sessionId) {
                finish(false);
                return;
              }

              if (status?.playing) {
                hasStartedPlaying = true;
              }

              // Normal finish event from expo-audio
              if (status?.didJustFinish) {
                finish(true);
                return;
              }

              // Duration-based completion fallback (when track reaches near end)
              if (
                hasStartedPlaying &&
                status?.duration > 0 &&
                status?.currentTime >= status?.duration - 0.1
              ) {
                finish(true);
                return;
              }

              // Handle error if any
              if (status?.error) {
                console.warn('[AudioService] Playback status error:', status.error);
                finish(false);
                return;
              }
            });
            this.currentSubscription = subscription;
          }

          player.play();
        });
      }

      // 2. HTML5 Web / fallback audio
      if (typeof Audio !== 'undefined') {
        return new Promise<boolean>((resolve) => {
          const audio = new Audio(safeUri);
          this.currentPlayer = audio;

          let finished = false;
          const finish = (result: boolean) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeoutId);
            if (this.currentPlayer === audio) {
              this.currentPlayer = null;
            }
            try { audio.pause(); } catch (e) {}
            resolve(result);
          };

          const timeoutId = setTimeout(() => finish(true), maxDurationMs);

          audio.onended = () => finish(true);
          audio.onerror = () => finish(false);
          audio.play().catch(() => finish(false));
        });
      }

      return false;
    } catch (err) {
      console.warn('[AudioService] playAndWait error:', err);
      return false;
    }
  }

  /**
   * Stops any currently playing audio cleanly and completely frees hardware resources
   */
  async stop(): Promise<void> {
    this.activeSessionId++;

    if (this.currentFinishResolver) {
      const resolver = this.currentFinishResolver;
      this.currentFinishResolver = null;
      try {
        resolver(false);
      } catch (e) {}
    }

    if (this.currentSubscription) {
      try {
        this.currentSubscription.remove?.();
      } catch (e) {}
      this.currentSubscription = null;
    }

    if (this.currentPlayer) {
      const player = this.currentPlayer;
      this.currentPlayer = null;
      this.destroyPlayer(player);
    }
  }

  /**
   * Plays an audio file if present on disk, otherwise speaks fallback text using TTS.
   * Guarantees that pronunciation is ALWAYS heard by the user with zero missing-file errors!
   */
  async playOrSpeak(
    filenameOrUri: string | undefined,
    fallbackText: string,
    ttsOptions?: TtsOptions
  ): Promise<boolean> {
    if (filenameOrUri) {
      const success = await this.playAndWait(filenameOrUri);
      if (success) return true;
    }
    if (fallbackText) {
      await TtsService.speak(fallbackText, ttsOptions);
      return true;
    }
    return false;
  }

  /**
   * Extracts all audio filenames referenced in Anki format: [sound:filename.mp3] or <audio src="...">
   * Excludes video files (.mp4, .webm, etc.) which are handled by the WebView video player.
   */
  extractSoundTags(text: string): string[] {
    if (!text) return [];
    const matches: string[] = [];
    const soundRegex = /\[sound:([^\]]+)\]/g;
    let match;
    while ((match = soundRegex.exec(text)) !== null) {
      if (match[1]) {
        const file = match[1].trim();
        // Ignore video files from audio playlist so expo-audio does not fail with Source error
        if (!/\.(mp4|webm|mkv|mov|m4v|avi|ogv)$/i.test(file)) {
          matches.push(file);
        }
      }
    }
    const audioTagRegex = /<audio[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((match = audioTagRegex.exec(text)) !== null) {
      if (match[1]) {
        matches.push(match[1].trim());
      }
    }
    return matches;
  }
}

export const audioService = new AudioPlaybackService();
