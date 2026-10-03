# Phase 3: Scheduler & Study Modes (Sections 5.1–5.4 & 8B.4)

## 📋 What was built in Phase 3

1. **Pure TypeScript SM-2 & Anki-v2 Scheduler (`src/core/scheduler/sm2.ts`)**:
   - Multi-step learning progression: `[1m, 10m]` steps -> graduation to Review state (1 day).
   - Rating interval calculations for Again, Hard, Good, Easy:
     - **Again**: lapse counter incremented, ease reduced by 0.20, moves to Relearning state (`10m`).
     - **Hard**: ease reduced by 0.15, interval multiplied by `hardMultiplier` (1.2x).
     - **Good**: interval scaled by current `easeFactor` and `intervalModifier`.
     - **Easy**: interval scaled with additional `easyBonus` (1.3x) and ease increased by 0.15.
   - Dynamic button interval previews (e.g., `1m`, `10m`, `1d`, `4d`).

2. **Pure TypeScript FSRS Scheduler (`src/core/scheduler/fsrs.ts`)**:
   - Implementation of Free Spaced Repetition Scheduler algorithm formulas.
   - 17 optimized FSRS weights tracking Memory Stability ($S$), Difficulty ($D$), and Retrievability ($R$).
   - Dynamic desired retention targeting (default 90% retention).

3. **Day Boundary & Rollover System (`src/core/scheduler/dayBoundary.ts`)**:
   - Handles late-night study sessions with configurable `rollover_hour` (default 4:00 AM).
   - Timezone travel and clock change resilience.

4. **Study Queue Builder (`src/core/scheduler/queueBuilder.ts`)**:
   - `buildReviewQueue`: Fetches due review cards and learning cards up to daily limits.
   - **Sibling burying**: Automatically prevents showing sister cards from the same note on the same day.
   - `buildLearnQueue`: Gathers new cards with batch limits.
   - `answerCard`: Records review in SQLite `review_logs`, updates card scheduling fields, updates `daily_stats`, and awards XP (+10 XP).
   - `undoLastReview`: Reverts card state and log on demand.
   - Card actions: `suspendCard`, `buryCard`, `resetCard`.

5. **3D Flip Card Component (`src/components/card/FlashCardFlip.tsx`)**:
   - Smooth 3D Y-axis rotation (0 to 180 deg) using `react-native-reanimated`.
   - Perspective and backface visibility management.
   - Haptic feedback on flip.

6. **Review Mode Screen (`src/app/study/review.tsx`)**:
   - Top bar: remaining counts, animated progress, timer, card actions menu (⋮), and Undo (↶).
   - 3D Flip Card in center.
   - Bottom rating buttons with live interval previews:
     - 🔴 **Again** (`1m` / `10m`)
     - 🟠 **Hard**
     - 🟢 **Good**
     - 🔵 **Easy**
   - Re-queues failed cards for end-of-session practice.

7. **Learn New Mode Screen (`src/app/study/learn.tsx`)**:
   - **Introduction step first**: Presents word, meaning, example, and audio with a **"Got it! Continue"** button.
   - **Mini-learning loop**: Immediate recall check before graduating.

8. **Session Complete Screen (`src/app/study/complete.tsx`)**:
   - Celebratory visual feedback, summary of cards reviewed, and XP earned.
   - Quick navigation to review more or return to Home.

---

## 🧪 Testing Instructions

1. **Run Unit Tests**:
   ```bash
   npx jest __tests__/scheduler.test.ts
   ```
2. **Test Review Flow**:
   - On the Home screen, tap **"Start Review"** (due cards banner).
   - Tap the card or "Show Answer" to trigger the smooth 3D flip.
   - Note the intervals displayed on the 4 buttons (Again, Hard, Good, Easy).
   - Rate a card with "Good" -> next card appears.
   - Tap `↶` (Undo) -> previous card is restored.
   - Tap `⋮` (Menu) -> test Suspend, Bury, or Reset card.
3. **Test Learn New Flow**:
   - On the Home screen or any deck, tap **"Learn Now"**.
   - Notice the "New Word Introduction" stage with the "Got it! Continue" button.
   - Tap "Got it!" -> the card enters the active recall mini-loop.
