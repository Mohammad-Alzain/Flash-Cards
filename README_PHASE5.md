# Phase 5: Quiz & Test System (Section 8C)

## 📋 What was built in Phase 5

1. **Question Types & Distractor Engine (`src/core/quiz/generator.ts`)**:
   - **Multiple Choice**: Automatically generates 3 plausible distractors from other cards in the same deck or note type. Shuffles options to prevent predictable positions.
   - **True / False**: Shows cards with 50% accurate answers and 50% swapped incorrect distractors.
   - **Type Answer**: Free text recall checking against the card answer.
   - **Matching Game**: Generates paired terms and definitions for interactive association.

2. **Arabic Normalization & Fuzzy Checker (`src/core/quiz/checker.ts`)**:
   - **Tashkeel removal**: Strips all Arabic diacritics (fatha, damma, kasra, sukun, shadda, tanween, tatweel).
   - **Letter normalization**: Standardizes alef variants (`أ / إ / آ / ٱ` -> `ا`), taa marbuta (`ة` -> `ه`), and alef maqsura (`ى` -> `ي`).
   - **Typo Tolerance**: Levenshtein distance allowing single-character typos on longer words without penalizing the student.
   - 100% pure TypeScript module with unit tests in `__tests__/quizChecker.test.ts`.

3. **Mistakes Notebook (`src/core/quiz/mistakesManager.ts`)**:
   - Auto-collects failed cards into the SQLite `mistakes` table.
   - Tracks consecutive correct answers: automatically graduates/removes a card from the Mistakes Notebook when answered right 3 times in a row.
   - Dedicated "Practice Mistakes" quiz mode.

4. **Interactive Quiz Player (`src/app/quiz/play.tsx`)**:
   - Support for 5 modes:
     - 🎲 **Random Quiz**: Fast 10 or 20 questions mixing multiple choice, true/false, and typing.
     - 📝 **Exam Mode**: Formal test with final score.
     - ❤️ **Survival Mode**: 3 lives with hearts display.
     - ⚡ **Matching Game**: Pair associations.
     - 📓 **Mistakes Notebook**: Drill only weak cards.
   - **Duolingo-style Feedback Banner**:
     - Slides up from the bottom with animated green/red background.
     - Clear correct answer display.
     - Haptic feedback and continue flow.

5. **Quiz Results Screen (`src/app/quiz/results.tsx`)**:
   - Circular score progress ring.
   - Correct answers ratio, XP calculation (+15 XP per correct question).
   - Direct button to drill only wrong answers with "Practice Mistakes".

---

## 🧪 Testing Instructions

1. **Run Unit Tests**:
   ```bash
   npx jest __tests__/quizChecker.test.ts
   ```
2. **Test Quiz Gameplay**:
   - Go to the **"Quiz"** tab.
   - Tap **"Start Practice"** on **Random Quiz**.
   - Answer a question:
     - Notice the instantaneous Duolingo-style bottom banner (Green for correct, Red with expected answer for wrong).
     - Notice haptic feedback.
   - Complete the quiz -> Results screen displays your score ring, correct/total count, and XP earned.
   - If you made any errors, tap **"Practice Mistakes"** -> Drills only those failed cards!
