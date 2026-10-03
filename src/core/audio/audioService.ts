import { mediaManager } from '../media/mediaManager';

let ExpoAudio: any = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  ExpoAudio = null;
}

class AudioPlaybackService {
  private currentPlayer: any = null;
  private isAudioModeConfigured = false;

  private async configureAudioMode(): Promise<void> {
    if (this.isAudioModeConfigured) return;
    try {
      if (ExpoAudio && typeof ExpoAudio.setAudioModeAsync === 'function') {
        await ExpoAudio.setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
        });
      }
      this.isAudioModeConfigured = true;
    } catch (e) {
      console.warn('[AudioService] Could not set audio mode:', e);
    }
  }

  /**
   * Plays an audio file by filename (stored in media directory) or absolute URI
   */
  async play(filenameOrUri: string): Promise<boolean> {
    if (!filenameOrUri) return false;

    try {
      await this.configureAudioMode();

      // Stop previous playback if any
      await this.stop();

      const resolvedUri = mediaManager.resolveUri(filenameOrUri);
      if (!resolvedUri) return false;

      // 1. Try modern expo-audio (SDK 57)
      if (ExpoAudio && typeof ExpoAudio.createAudioPlayer === 'function') {
        const player = ExpoAudio.createAudioPlayer({ uri: resolvedUri });
        this.currentPlayer = player;
        player.play();
        return true;
      }

      // 2. HTML5 Web / fallback audio
      if (typeof Audio !== 'undefined') {
        const audio = new Audio(resolvedUri);
        this.currentPlayer = audio;
        audio.play().catch((err) => {
          console.warn('[AudioService] HTML5 audio play error:', err);
        });
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[AudioService] Failed to play audio:', filenameOrUri, err);
      return false;
    }
  }

  /**
   * Plays an audio file and returns a Promise that resolves when playback finishes or times out.
   */
  async playAndWait(filenameOrUri: string, maxDurationMs = 15000): Promise<boolean> {
    if (!filenameOrUri) return false;

    try {
      await this.configureAudioMode();
      await this.stop();

      const resolvedUri = mediaManager.resolveUri(filenameOrUri);
      if (!resolvedUri) return false;

      // 1. Try modern expo-audio (SDK 57)
      if (ExpoAudio && typeof ExpoAudio.createAudioPlayer === 'function') {
        const player = ExpoAudio.createAudioPlayer({ uri: resolvedUri });
        this.currentPlayer = player;

        return new Promise<boolean>((resolve) => {
          let finished = false;
          let hasStartedPlaying = false;

          const finish = (result: boolean) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeoutId);
            try {
              subscription?.remove?.();
            } catch (e) {}
            resolve(result);
          };

          const timeoutId = setTimeout(() => {
            finish(true);
          }, maxDurationMs);

          let subscription: any = null;
          if (typeof player.addListener === 'function') {
            subscription = player.addListener('playbackStatusUpdate', (status: any) => {
              if (status?.playing) {
                hasStartedPlaying = true;
              }
              // Normal finish event from expo-audio
              if (status?.didJustFinish) {
                finish(true);
                return;
              }
              // Duration-based completion fallback (when track reaches end)
              if (
                hasStartedPlaying &&
                status?.duration > 0 &&
                status?.currentTime >= status?.duration - 0.15
              ) {
                finish(true);
                return;
              }
              // Handle error if any
              if (status?.error) {
                console.warn('[AudioService] Playback error in status:', status.error);
                finish(false);
                return;
              }
            });
          }

          player.play();
        });
      }

      // 2. HTML5 Web / fallback audio
      if (typeof Audio !== 'undefined') {
        return new Promise<boolean>((resolve) => {
          const audio = new Audio(resolvedUri);
          this.currentPlayer = audio;

          let finished = false;
          const finish = (result: boolean) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeoutId);
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
      console.warn('[AudioService] Failed to play audio and wait:', filenameOrUri, err);
      return false;
    }
  }

  /**
   * Stops any currently playing audio
   */
  async stop(): Promise<void> {
    try {
      if (this.currentPlayer) {
        if (typeof this.currentPlayer.pause === 'function') {
          this.currentPlayer.pause();
        }
        if (typeof this.currentPlayer.remove === 'function') {
          this.currentPlayer.remove();
        }
        this.currentPlayer = null;
      }
    } catch (err) {
      console.warn('[AudioService] Error stopping audio:', err);
      this.currentPlayer = null;
    }
  }

  /**
   * Extracts all audio filenames referenced in Anki format: [sound:filename.mp3] or <audio src="...">
   */
  extractSoundTags(text: string): string[] {
    if (!text) return [];
    const matches: string[] = [];
    const soundRegex = /\[sound:([^\]]+)\]/g;
    let match;
    while ((match = soundRegex.exec(text)) !== null) {
      if (match[1]) {
        matches.push(match[1].trim());
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
