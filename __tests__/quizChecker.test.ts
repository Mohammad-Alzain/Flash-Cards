import {
  quizChecker,
  stripArabicDiacritics,
  normalizeArabicText,
} from '../src/core/quiz/checker';

describe('Quiz Answer Checker with Arabic Normalization (Section 8C.2 & 8C.6)', () => {
  test('strips Arabic tashkeel accurately', () => {
    const raw = 'الْمُرُونَةُ وَالصُّمُودُ';
    expect(stripArabicDiacritics(raw)).toBe('المرونة والصمود');
  });

  test('normalizes Arabic alef, taa marbuta, and alef maqsura', () => {
    expect(normalizeArabicText('إِكْرَام')).toBe('اكرام');
    expect(normalizeArabicText('قُوَّةٌ')).toBe('قوه');
    expect(normalizeArabicText('مُسْتَشْفَى')).toBe('مستشفي');
  });

  test('accepts user answer with missing or different Arabic diacritics', () => {
    const expected = 'الْمُرُونَةُ وَالْقُدْرَةُ عَلَى التَّعَافِي';
    const user = 'المرونه والقدره علي التعافي';

    const result = quizChecker.checkAnswer(user, expected, true, true);
    expect(result.isCorrect).toBe(true);
  });

  test('tolerates 1-letter typo for longer English words', () => {
    const expected = 'Perseverance';
    const userTypo = 'Perseverence'; // 'e' instead of 'a'

    const result = quizChecker.checkAnswer(userTypo, expected, true, true);
    expect(result.isCorrect).toBe(true);
    expect(result.isAlmostCorrect).toBe(true);
  });

  test('correctly rejects incorrect answers', () => {
    const expected = 'London';
    const wrong = 'Paris';

    const result = quizChecker.checkAnswer(wrong, expected, true, true);
    expect(result.isCorrect).toBe(false);
  });
});
