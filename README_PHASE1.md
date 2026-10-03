# Phase 1: Foundation + Design System + SQLite Architecture

## 📋 What was built in Phase 1

1. **Expo SDK 52 + TypeScript Project Setup**:
   - `app.json`: Configured with Expo Router, Expo SQLite, RTL support, offline permissions, and development build settings.
   - `tsconfig.json`: TypeScript strict mode with `@/*` path aliases.
   - `babel.config.js`: React Native Reanimated plugin configuration.

2. **Design Tokens & System (Section 8B.2 - 8B.3)**:
   - Tokens defined in `src/theme/tokens.ts`:
     - Color palettes: Primary green (`#58CC02`), Secondary blue (`#1CB0F6`), Accent purple (`#CE82FF`), Orange flame (`#FF9600`), Error red (`#FF4B4B`), Gold (`#FFC800`), Neutrals.
     - Dark mode and true AMOLED black mode (`#000000`).
     - "Chunky 3D" elevation design: solid 4px darker bottom borders with translate effect on press.
     - Typography scale (12, 14, 16, 18, 22, 28, 36) and font tokens.
     - Shape tokens: radius 12 (inputs), 16 (cards/buttons), 24 (sheets), full (chips/badges).
   - `ThemeProvider` & `useTheme`: Dynamic switching between Light, Dark, and AMOLED with persistent settings.

3. **i18n & Full Arabic RTL Support**:
   - `src/i18n/translations/ar.json`: Complete, native Arabic translations.
   - `src/i18n/translations/en.json`: English translation counterpart.
   - Automatic RTL layout switching and mirrored components (`Header`, `TextField`, cards, counters).

4. **Complete SQLite Database & Repository Layer (Section 3)**:
   - `src/core/db/connection.ts`: WAL mode, foreign keys enabled (`PRAGMA foreign_keys = ON;`).
   - `src/core/db/migrations/001_initial_schema.ts`: All 19 required tables created (`decks`, `notes`, `cards`, `note_types`, `review_logs`, `daily_stats`, `schedules`, `settings`, `quiz_*`, `mistakes`, etc.) with indexes on foreign keys, `due`, `state`, `guid`.
   - `src/core/db/seed.ts`: Seeds built-in note types (`Basic`, `Basic (reversed)`, `Cloze`), initial settings, and a sample bilingual deck with due and new cards ready for testing.
   - Repositories: `deckRepository`, `noteRepository`, `cardRepository`, `settingsRepository`, `statsRepository`.

5. **Reusable Core UI Components (8B.3)**:
   - `Button`: Chunky 3D button with press translation, variants (`primary`, `secondary`, `accent`, `danger`, `ghost`, `gold`), sizes, loading state.
   - `Card`: Chunky 3D border cards with press feedback.
   - `ProgressRing`: SVG circular progress ring for the daily goal.
   - `ProgressBar`: Animated linear progress bar.
   - `Badge`: Distinct pill counters for New (blue), Learn (orange), and Due (green) cards.
   - `Chip`: Selectable filter tags.
   - `StreakFlame` & `XPCounter`: Gamification tokens.
   - `TextField`: RTL-aware input with clear button, multiline support, and validation errors.
   - `EmptyState`: Friendly offline mascot illustration and action buttons.
   - `Header`: Standard navigation bar with back actions.
   - `FAB`: Floating Action Button with chunky 3D style.

6. **Navigation & Screens (Expo Router Tabs Shell)**:
   - `src/app/_layout.tsx`: Root layout with database init & safe area provider.
   - `(tabs)/index.tsx`: **Today (Home)** screen with greeting, daily goal progress ring, Review Due Cards card, Learn New Words card, Quick Quiz shortcut, and active decks list.
   - `(tabs)/decks.tsx`: **Decks** screen with search, card counts, and inline deck creation modal.
   - `(tabs)/quiz.tsx`: **Quiz** tab shell showing quiz modes (Random, Exam, Survival, Match).
   - `(tabs)/stats.tsx`: **Stats** screen showing today's review counts, time studied, streaks, and card distribution.
   - `(tabs)/settings.tsx`: **Settings & Profile** screen with Theme switcher (Light/Dark/AMOLED), Language switcher (Arabic/English), and SQLite integrity check tool.
   - `modal/add-note.tsx`: **Add Card** modal triggered from FAB to add new notes and generate cards in SQLite.

---

## 🚀 How to Run and Test

### 1. Install dependencies
```bash
npm install
```

### 2. Run unit tests
```bash
npx jest
```

### 3. Run development build
```bash
npx expo start
```
Or for Android development build:
```bash
npx expo run:android
```

---

## 🧪 Manual Verification Steps

1. **Database initialization**:
   - Launch the app. The app automatically creates the SQLite database, runs migrations, and seeds the sample deck.
2. **Home Screen (Today)**:
   - Verify greeting, streak flame (🔥 3), XP counter (⚡ 120 XP), and the Daily Goal circle (8/20 cards).
   - Verify the "Review Due Cards" card shows 2 due cards, and "Learn New Cards" shows 3 new cards from the seeded deck.
3. **Decks Screen**:
   - Switch to the "Decks" tab.
   - Verify the sample deck shows correct counts: 5 cards total, 3 new, 2 due.
   - Tap `+ New Deck`, enter a name (e.g. "Spanish A1"), and save. Verify the new deck appears in the list.
4. **Quick Add Card (FAB)**:
   - Tap the `+` FAB button on the bottom right/left of the Home screen.
   - Enter Front (e.g., "Hello") and Back (e.g., "مرحباً").
   - Tap "Add to Deck". Verify the card is created in SQLite and the deck count updates.
5. **Theme & Language**:
   - Go to the "Settings" tab.
   - Toggle theme between **Light**, **Dark**, and **AMOLED Black**. Verify surfaces and text adjust instantly.
   - Toggle language between **العربية** and **English**. Verify RTL layout switches.
   - Tap "Verify Database Integrity" (`PRAGMA integrity_check`). Verify it reports database health as OK.

---

## ⏭️ Next Step: Phase 2
- **Phase 2: Decks, Notes & Templates**:
  - Full deck list & hierarchical tree (`Parent::Child`).
  - Note Type manager (`Settings -> Note Types`): Basic, Reversed, Cloze, Language presets.
  - Fields editor (add, rename, delete, reorder, RTL toggle, sort field).
  - Card Templates editor ("Cards..." screen) with Front/Back HTML & shared CSS.
  - Template engine in `core/render/` (`{{Field}}`, `{{cloze}}`, `{{#Field}}`, `{{FrontSide}}`, etc.).
  - WebView card renderer with CSS injection and background pre-rendering.
