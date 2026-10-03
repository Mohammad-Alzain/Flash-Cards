let ExpoSpeech: any = null;
try {
  ExpoSpeech = require('expo-speech');
} catch {
  ExpoSpeech = null;
}

export interface TtsOptions {
  language?: string;
  rate?: number; // 0.5 to 2.0, default 1.0
  pitch?: number;
  onDone?: () => void;
  onError?: (error: any) => void;
}

/**
 * Strips HTML tags, cloze brackets, and [sound:...] markers from text for clean TTS pronunciation.
 */
export function cleanTextForTts(html: string): string {
  if (!html) return '';
  let cleaned = html
    .replace(/<img[^>]*>/gi, '') // Strip img tags completely without keeping attributes
    .replace(/<[^>]*>/g, ' ') // Strip other HTML tags
    .replace(/\[sound:[^\]]*\]/g, ' ') // Strip sound references
    .replace(/\b[\w.-]+\.(png|jpe?g|gif|webp|svg|bmp|mp3|wav|ogg|m4a)\b/gi, ' ') // Strip file names
    .replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '$1') // Cloze brackets {{c1::word::hint}} -> word
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Auto-detects primary language based on character script.
 */
export function detectLanguage(text: string): 'ar-SA' | 'en-US' {
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text) ? 'ar-SA' : 'en-US';
}

export class TtsService {
  private static speaking = false;

  /**
   * Speaks the given text with auto-language detection and HTML cleanup.
   */
  static async speak(text: string, options: TtsOptions = {}): Promise<void> {
    const cleaned = cleanTextForTts(text);
    if (!cleaned) return;

    const lang = options.language || detectLanguage(cleaned);
    const rate = options.rate || 1.0;
    const pitch = options.pitch || 1.0;

    this.speaking = true;

    // React Native Expo Speech
    if (ExpoSpeech && typeof ExpoSpeech.speak === 'function') {
      try {
        await ExpoSpeech.stop();
        ExpoSpeech.speak(cleaned, {
          language: lang,
          rate,
          pitch,
          onDone: () => {
            this.speaking = false;
            options.onDone?.();
          },
          onError: (e: any) => {
            this.speaking = false;
            options.onError?.(e);
          },
        });
        return;
      } catch (err) {
        console.warn('ExpoSpeech error, attempting fallback:', err);
      }
    }

    // Web SpeechSynthesis fallback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleaned);
        utterance.lang = lang;
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.onend = () => {
          this.speaking = false;
          options.onDone?.();
        };
        utterance.onerror = (e) => {
          this.speaking = false;
          options.onError?.(e);
        };
        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn('Web SpeechSynthesis error:', e);
      }
    }

    // If no TTS engine available, invoke onDone immediately
    this.speaking = false;
    options.onDone?.();
  }

  /**
   * Stops any currently active speech playback.
   */
  static async stop(): Promise<void> {
    this.speaking = false;
    if (ExpoSpeech && typeof ExpoSpeech.stop === 'function') {
      try {
        await ExpoSpeech.stop();
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  static isSpeaking(): boolean {
    return this.speaking;
  }
}
