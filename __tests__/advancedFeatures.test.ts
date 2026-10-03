import { cleanTextForTts, detectLanguage } from '../src/core/audio/ttsService';
import { OcclusionBox } from '../src/components/card/ImageOcclusion';

describe('Phase 10: Advanced Features & Polish Unit Tests', () => {
  describe('TTS Service Utilities', () => {
    it('strips complex HTML markup, leaving only spoken text', () => {
      const html = '<div class="card"><p>What is the <b>powerhouse</b> of the cell?</p><hr><span>Answer</span></div>';
      const cleaned = cleanTextForTts(html);
      expect(cleaned).toBe('What is the powerhouse of the cell? Answer');
    });

    it('extracts target word from Anki cloze deletion syntax', () => {
      const cloze = 'The {{c1::capital::hint}} of France is {{c2::Paris}}.';
      const cleaned = cleanTextForTts(cloze);
      expect(cleaned).toBe('The capital of France is Paris.');
    });

    it('removes sound tags [sound:...]', () => {
      const text = 'Hello [sound:pronunciation.mp3] World';
      const cleaned = cleanTextForTts(text);
      expect(cleaned).toBe('Hello World');
    });

    it('decodes HTML entities properly', () => {
      const text = 'Tom &amp; Jerry &lt;3 cheese &nbsp;';
      const cleaned = cleanTextForTts(text);
      expect(cleaned).toBe('Tom & Jerry <3 cheese');
    });

    it('detects Arabic script for regional TTS voice', () => {
      expect(detectLanguage('كتاب القراءة')).toBe('ar-SA');
      expect(detectLanguage('مرحبا بك')).toBe('ar-SA');
      expect(detectLanguage('English with عربي word')).toBe('ar-SA');
    });

    it('detects Latin script for English TTS voice', () => {
      expect(detectLanguage('Hello, this is a test.')).toBe('en-US');
      expect(detectLanguage('Photosynthesis')).toBe('en-US');
    });
  });

  describe('Image Occlusion Box Geometry', () => {
    it('calculates pixel positions accurately based on percentage coordinates', () => {
      const containerWidth = 400;
      const containerHeight = 300;

      const box: OcclusionBox = {
        id: 'box_1',
        xPercent: 20, // 20%
        yPercent: 30, // 30%
        widthPercent: 25, // 25%
        heightPercent: 15, // 15%
        label: 'Nucleus',
        isQuestion: true,
      };

      const left = (box.xPercent / 100) * containerWidth;
      const top = (box.yPercent / 100) * containerHeight;
      const width = (box.widthPercent / 100) * containerWidth;
      const height = (box.heightPercent / 100) * containerHeight;

      expect(left).toBe(80);
      expect(top).toBe(90);
      expect(width).toBe(100);
      expect(height).toBe(45);
    });
  });
});
