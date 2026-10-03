/**
 * Arabic Normalization, Levenshtein Distance, and Fuzzy Answer Checker (Section 8C.2)
 */

/**
 * Removes Arabic diacritics (tashkeel/harakat) and tatweel
 */
export function stripArabicDiacritics(text: string): string {
  if (!text) return '';
  return text
    // Tashkeel / Harakat range
    .replace(/[\u064B-\u0652\u0653-\u065F\u0670]/g, '')
    // Tatweel (kashida)
    .replace(/\u0640/g, '');
}

/**
 * Normalizes Arabic letters:
 * - أ / إ / آ / ٱ -> ا
 * - ة -> ه
 * - ى -> ي
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  let str = stripArabicDiacritics(text);

  str = str
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');

  return str;
}

/**
 * Cleans string: strips punctuation, lowercase, normalizes whitespace
 */
export function cleanString(text: string, normalizeArabic = true): string {
  if (!text) return '';
  let str = text.trim().toLowerCase();

  // Strip punctuation
  str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, '');

  if (normalizeArabic) {
    str = normalizeArabicText(str);
  }

  // Collapse multiple spaces into single space
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

/**
 * Computes Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export interface CheckAnswerResult {
  isCorrect: boolean;
  isExact: boolean;
  isAlmostCorrect: boolean;
  cleanedUser: string;
  cleanedExpected: string;
}

export const quizChecker = {
  checkAnswer(
    userAnswer: string,
    expectedAnswer: string,
    enableArabicNormalization = true,
    enableFuzzyTypoTolerance = true
  ): CheckAnswerResult {
    const cleanedUser = cleanString(userAnswer, enableArabicNormalization);
    const cleanedExpected = cleanString(expectedAnswer, enableArabicNormalization);

    // 1. Exact match
    if (cleanedUser === cleanedExpected) {
      return {
        isCorrect: true,
        isExact: true,
        isAlmostCorrect: false,
        cleanedUser,
        cleanedExpected,
      };
    }

    // 2. Fuzzy / Typo tolerance
    if (enableFuzzyTypoTolerance && cleanedExpected.length >= 4) {
      const distance = levenshteinDistance(cleanedUser, cleanedExpected);
      const maxAllowedDistance = cleanedExpected.length >= 8 ? 2 : 1;

      if (distance <= maxAllowedDistance) {
        return {
          isCorrect: true,
          isExact: false,
          isAlmostCorrect: true,
          cleanedUser,
          cleanedExpected,
        };
      }
    }

    return {
      isCorrect: false,
      isExact: false,
      isAlmostCorrect: false,
      cleanedUser,
      cleanedExpected,
    };
  },
};
