# Phase 7: Gamification & Profile (Section 8B.5)

## 📋 What was built in Phase 7

1. **Levels & XP Engine (`src/core/gamification/gamificationManager.ts`)**:
   - Progressive leveling curve based on cumulative XP:
     - Level 1: Novice (0–150 XP)
     - Level 2: Explorer (151–350 XP)
     - Level 3: Diligent Learner (351–650 XP)
     - Level 4: Scholar (651–1050 XP)
     - Level 5: Sage (1051–1550 XP)
     - Level 6: Memory Master (1551+ XP)
   - Dynamic progress percentage calculation towards next rank.

2. **Daily Quests System**:
   - Auto-generates 3 refreshed daily challenges for each calendar study day:
     - *Review 15 Cards* (+40 XP reward)
     - *Learn 5 New Words* (+50 XP reward)
     - *Maintain Streak* (+30 XP reward)
   - Real-time progress updates linked to SQLite study sessions.
   - Interactive **"Claim Reward! 🎉"** button with haptic feedback that updates user XP in SQLite.

3. **Badges & Achievements**:
   - Persistent tracking in SQLite `achievements` table.
   - 6 Core Milestones:
     - 🌱 *First Step*: First review completed
     - 🔥 *Ignition*: 3-day study streak
     - ⚔️ *Week Warrior*: 7-day study streak
     - 💯 *Century Club*: 100 cards reviewed
     - 👑 *Quiz Champion*: Perfect 100% quiz score
     - 📦 *Deck Collector*: First imported deck
   - Visual distinction between unlocked badges and locked milestones.

4. **Master Gamification Control**:
   - Setting options: **Playful (Full)**, **Minimal (Anki-style)**, and **Off**.
   - Preserves user choice for distraction-free classical flashcard study.

5. **Profile & Quests Screen (`src/app/profile/index.tsx`)**:
   - User card with avatar, rank title, and level progress bar.
   - Streak flame counter + longest streak record + streak freeze indicator.
   - Daily quests card with progress bars.
   - 2-Column achievements grid.
   - Direct access via the top bar on the Home screen.

---

## 🧪 Testing Instructions

1. **Test Profile & Level Progress**:
   - On the Home screen, tap the top **🔥 Streak / ⚡ XP** pill.
   - View your current Level, Title, and XP progress bar.
2. **Test Daily Quests**:
   - Study a card in Review mode or complete a quick quiz.
   - Return to the Profile screen -> Verify the quest progress bar increments.
   - When a quest reaches 100%, tap **"Claim Reward! 🎉"** -> Notice the XP reward added instantly to your total!
3. **Test Gamification Switch**:
   - On the Profile screen, switch Gamification Mode between **Playful (Full)** and **Minimal (Anki-style)**.
