# Project Spec: Offline Flashcards App (AnkiDroid-like) — React Native

> Give this whole document to the AI coding assistant. Build **phase by phase** (see Section 14). Do not skip ahead. After each phase, the app must run and be testable.

---

## 1. Product Summary

An **offline-first, fully local** spaced-repetition flashcards app for Android (iOS later), similar to AnkiDroid but simpler and more modern.

**Core promises**
1. Import existing decks from **AnkiDroid/Anki (`.apkg`)**, **text (`.txt`/`.tsv`/`.csv`)**, and **Excel (`.xlsx`)**.
2. Two main study flows: **Review** (due cards) and **Learn New** (new words).
3. **Scheduling**: daily study time, session reminders, review reminders.
4. **100% local storage**: no account, no server, no analytics, no internet required. It is a utility app.

**Look & feel:** modern, playful and gamified (inspired by Duolingo/Quizlet-style apps, original branding), with a switch to a minimal Anki-style mode.
**Also included:** a full **Quiz/Test system** (random, exam, survival, matching…), **AnkiDroid feature parity** (Section 8D), **card-template editing** (Section 8A), and many extras (Section 8E).

**Target users:** language learners, medical/university students, anyone memorizing. Must fully support **Arabic (RTL)** and **English** UI, and RTL/LTR card content.

---

## 2. Tech Stack (required)

| Concern | Choice |
|---|---|
| Framework | React Native + **Expo (latest stable SDK)** with **development build** (not Expo Go), **TypeScript strict** |
| Navigation | `expo-router` |
| Database | `expo-sqlite` (SQLite) — use a thin repository layer, migrations table |
| State | `zustand` (UI state only; DB is source of truth) |
| Lists | `@shopify/flash-list` (large decks) |
| Files | `expo-file-system`, `expo-document-picker`, `expo-sharing` |
| ZIP | `jszip` (for `.apkg` and backups) |
| Excel / CSV | `xlsx` (SheetJS) + `papaparse` |
| Scheduler | `ts-fsrs` (FSRS) **and** a built-in SM-2/Anki-v2 style option |
| Notifications | `expo-notifications` (local only) |
| Background | `expo-background-task` / `expo-task-manager` |
| Audio/TTS | `expo-av` or `expo-audio`, `expo-speech` |
| Images | `expo-image`, `expo-image-picker` |
| Charts | `victory-native` or `react-native-svg` custom |
| Animation / gestures | `react-native-reanimated`, `react-native-gesture-handler`, `lottie-react-native` and/or `@shopify/react-native-skia` (confetti), `expo-haptics`, `expo-linear-gradient`, `expo-keep-awake` |
| Fonts | `expo-font` — Nunito, Cairo, Tajawal, Amiri, Noto Naskh/Kufi (bundled offline) |
| Drawing | `@shopify/react-native-skia` (whiteboard, handwriting, image occlusion) |
| OCR (optional) | on-device ML Kit text recognition via a config plugin / native module |
| i18n | `i18next` + `expo-localization`, with `I18nManager` RTL support |
| Security | `expo-local-authentication` (optional app lock) |
| Testing | `jest`, `@testing-library/react-native`, plus unit tests for scheduler & importers |

**Hard constraints:** no network calls, no `INTERNET`-dependent features, no Firebase/analytics/crash SDKs. Request the minimum permissions (notifications, optional camera/mic only when used).

---

## 3. Data Model (SQLite)

Use integer ms timestamps. Enable `PRAGMA foreign_keys = ON`, WAL mode, and index all FK/search columns.

```
decks(id, parent_id NULL, name, description, created_at, updated_at,
      new_per_day, reviews_per_day, settings_json, archived)

note_types(id, name, fields_json, templates_json, css, is_cloze, created_at)
  -- fields_json: [{id, name, order, rtl, font, size, sticky, collapsed, description}]
  -- templates_json: [{id (stable), name, order, front_html, back_html,
  --                   browser_q, browser_a, deck_override_id}]
  -- sort_field_id, is_builtin, preset_key, js_allowed(bool)

note_type_versions(id, note_type_id, snapshot_json, saved_at)  -- last 10 kept

notes(id, guid UNIQUE, note_type_id, fields_json, tags, sort_field,
      checksum, created_at, updated_at)

cards(id, note_id, deck_id, template_ord,
      state            -- 0 New, 1 Learning, 2 Review, 3 Relearning
      due              -- ms timestamp (or day number for review cards)
      stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
      ease_factor, interval_days,           -- SM-2 fields
      last_review, suspended, buried_until, flag, bookmarked,
      created_at, updated_at)

review_logs(id, card_id, deck_id, rating, state_before, due_before,
            interval_before, interval_after, duration_ms, reviewed_at)

media(id, filename UNIQUE, mime, size, hash)   -- files stored on disk
note_media(note_id, media_id)

schedules(id, deck_id NULL, type, -- 'study' | 'review' | 'custom'
          time_of_day, days_of_week_mask, duration_min,
          enabled, notification_id, created_at)

study_sessions(id, deck_id, mode, started_at, ended_at,
               cards_seen, new_count, review_count, correct_count)

daily_stats(date PK, deck_id, new_done, reviews_done, time_ms, goal_met)

settings(key PRIMARY KEY, value)
import_history(id, source_type, filename, imported_at, notes_added, notes_skipped, errors_json)
```

---

## 4. Feature 1 — Import (the most important feature)

### 4.1 Import UX
- Single **"Import"** entry: pick file via system picker (`.apkg`, `.colpkg`, `.txt`, `.tsv`, `.csv`, `.xlsx`, `.xls`). Also support **"Open with" / share-to-app** intent for these file types.
- Flow: **Pick file → Detect type → Preview (first 20 rows/cards) → Mapping/Options → Import with progress bar → Summary report**.
- Run import in chunks inside transactions (e.g., 500 notes/transaction), keep UI responsive, show cancel button, support 100,000+ cards.
- **Duplicate handling options:** skip duplicates / update existing / import as new (match by `guid`, else by first-field checksum within the same note type).
- Import summary: added / updated / skipped / failed + downloadable error log.
- **Undo import** (by `import_history` id) as long as no other changes conflict.

### 4.2 `.apkg` (Anki package) import
An `.apkg` is a **ZIP** containing:
- `collection.anki2` or `collection.anki21` (SQLite DB), or **`collection.anki21b`** (new format, zstd-compressed + protobuf)
- `media` (JSON map `{"0":"image.jpg", ...}` in older versions; protobuf in newest)
- numbered media files `0`, `1`, `2`…

Requirements:
1. Unzip with `jszip`, write the collection DB to a temp SQLite file, open it read-only with `expo-sqlite`, and read the tables **`col`, `notes`, `cards`, `revlog`**.
2. From `col`: parse `models` JSON (note types: fields, templates `qfmt`/`afmt`, css, type=cloze) and `decks` JSON (names, `::` hierarchy → nested decks), `dconf` (limits).
3. From `notes`: split `flds` by `\x1f` into fields; keep `tags`, `guid`, `mid`.
4. From `cards`: map `type/queue/due/ivl/factor/reps/lapses/odue/did/ord`.
   - Offer a choice: **"Keep original scheduling progress"** (convert Anki due/ivl/factor to the app's fields) **or "Reset all as new cards"**.
   - Convert Anki review `due` (day offset from `col.crt`) to a real date correctly; handle learning cards (`due` = epoch seconds).
5. Optionally import `revlog` for statistics.
6. **Media:** map numbered files using the `media` JSON, copy to app `documentDirectory/media/` with original filename, rewrite references in fields: `<img src="x.jpg">`, `[sound:x.mp3]`.
7. Support **cloze** notes (`{{c1::text::hint}}`) and basic/reversed/optional-reversed/typing note types.
8. **If the file contains `collection.anki21b`** (zstd/protobuf) and the importer can't decode it: show a clear, friendly message — *"This package was exported with the new Anki format. Please re-export it from Anki with **'Support older Anki versions'** checked."* — and include a short help screen. (Try to add a WASM/JS zstd decoder if feasible, but this fallback is mandatory.)
9. `.colpkg` (full collection) → treat as importing all decks.
10. Never crash on corrupt files; validate and report.

### 4.3 Text import (`.txt`, `.tsv`, `.csv`)
- Auto-detect **encoding** (UTF-8, UTF-8 BOM, UTF-16) and **delimiter** (tab, comma, semicolon, pipe) with manual override.
- Parse Anki text-export headers: `#separator:tab`, `#html:true`, `#tags column:3`, `#deck column:`, `#notetype column:`.
- Handle quoted fields, embedded newlines, `<br>` conversion.
- **Column mapping UI:** map each column → Front / Back / Extra fields / Tags / Deck / Ignore. Toggle "First row is header". Live preview of the resulting card.
- Choose the target deck (existing or create new) and note type.

### 4.4 Excel import (`.xlsx`, `.xls`)
- Use SheetJS to read; let the user choose the **sheet** (or "one deck per sheet").
- Same mapping UI as text import. Support multiple columns for extra fields (e.g., word / meaning / example / pronunciation / part of speech).
- Handle merged cells, empty rows, numeric cells coerced to strings.

### 4.5 Export (needed too — local backup & portability)
- Export deck(s) → `.apkg` (compatible with AnkiDroid, legacy format), `.csv`, `.txt`, `.xlsx`.
- Share through Android share sheet.

---

## 5. Feature 2 — Study Modes

### 5.1 Review mode (due cards)
- Shows **learning + relearning + due review** cards for today.
- Card flow: front → **Show Answer** (tap or space/swipe up) → rating buttons **Again / Hard / Good / Easy** with the **next interval shown on each button** (e.g., `1m · 6m · 10m · 4d`).
- Gestures (configurable): swipe left/right for Again/Good, double-tap to flip, long-press menu.
- **Undo last answer** (multiple levels).
- Top bar: remaining counts (New / Learning / Review) with colors, timer, progress.
- Card actions: edit, suspend, bury, flag (colors), bookmark, delete, reset progress, "mark as leech", card info (history, due, ease/stability).

### 5.2 Learn New mode (new words) — differentiated from Review
- **Introduction step first:** present each new word in a rich "learn" view (word, meaning, example, image, audio auto-play) with a **"Got it"** button *before* it enters the quiz loop.
- Then **mini-learning loop**: show the card as a quiz, repeat inside the session with short steps until it graduates (configurable steps, e.g., `1m 10m`).
- Session size selector: "Learn **5 / 10 / 20 / custom** new words now".
- Optional **mixed order**: interleave new + review (ratio setting), or new first / review first.
- Optional answer styles: *flip card*, *type the answer* (with diff highlighting), *multiple choice* (auto-generated distractors from the same deck), *listen & type*.
- End-of-session summary: learned N words, accuracy, time, "Learn more" / "Review now" buttons.

### 5.3 Additional study modes
- **Custom Study / Cram:** by tag, by deck, difficult cards (high lapses), cards forgotten today, ahead of schedule, preview new cards — without disturbing the scheduling (cram mode).
- **Reverse mode:** study backwards (back → front) on demand.
- **Shuffle** and **"Hard cards only"** drills.
- **Leech handling:** after N lapses (default 8) → suspend or tag, with a notification.
- **Sibling burying** (don't show cards from the same note on the same day).

### 5.4 Scheduling algorithm
- Default **FSRS** (via `ts-fsrs`) with configurable **desired retention** (default 0.9) and **fuzz**; alternative **Anki SM-2** (learning steps, graduating interval, easy interval, starting ease, hard/easy multipliers, lapse steps, minimum interval).
- Per-deck options (with "apply to all"): new cards/day, max reviews/day, learning steps, relearning steps, order of new cards (sequential/random), maximum interval, auto-play audio.
- **Day rollover hour** setting (default 4:00 AM) so late-night study counts for "today".
- Handle timezone / device-clock changes and DST safely.
- All scheduling logic in a **pure TypeScript module** with unit tests (no UI/DB inside).

---

## 6. Feature 3 — Scheduling, Planner & Reminders

1. **Daily study goals:** target new cards, reviews, and/or minutes per day. Progress ring on Home.
2. **Study sessions schedule:** user creates sessions e.g. "Morning vocab — 07:30 — 15 min — Mon–Fri — Deck: English". Multiple schedules per deck, per day-of-week.
3. **Review reminders:** notification at chosen time(s) **only when cards are due**; the text shows the count ("32 cards are waiting for you"). Smart option: skip the notification if the daily goal is already completed.
4. **Notification actions:** *Start now*, *Snooze 10/30/60 min*, *Skip today*. Tapping opens directly into the study screen of the relevant deck.
5. **Session timer:** configurable Pomodoro-style (e.g., 25 min study / 5 min break), with soft alert at the end; "Stop after N minutes or N cards".
6. **Planner/Calendar view:** monthly calendar with heatmap of past study + **forecast** of upcoming due cards per day; tap a day to see details.
7. **Exam/target date mode:** user sets a deadline (e.g., exam in 30 days) → app suggests daily new-card quota to finish the deck on time.
8. **Streaks** and gentle gamification: current/longest streak, streak-freeze, weekly goal badge (optional, can be turned off).
9. **Quiet hours** and "Do not disturb" window for notifications.
10. **Reliability on Android:** re-schedule notifications after device reboot and after time/timezone changes; handle exact-alarm permission (`SCHEDULE_EXACT_ALARM`) gracefully; show guidance for battery-optimization restrictions on aggressive OEMs (Xiaomi, Huawei, Samsung).
11. All schedules persisted in SQLite; notification IDs stored to allow cancel/update.

---

## 7. Feature 4 — Local-Only Storage

- All data in the app's private storage: SQLite DB + `media/` folder. **Zero network usage.**
- **Manual backup/restore:** export full backup (`.zip` containing DB + media + settings) → restore with confirmation and version check.
- **Auto local backups:** daily/weekly rolling backups (keep last N) into a user-selectable folder (Android Storage Access Framework) so users can sync via their own tools (Syncthing, Drive app, etc.).
- **Database migrations** with version table; never lose data on app updates.
- **Integrity check** on startup (`PRAGMA integrity_check` occasionally) and a **"Repair / check database"** tool in Settings.
- Storage usage screen (DB size, media size) + "clean unused media".
- Optional **app lock** (biometric/PIN) and hide content in app switcher.
- Add `android:allowBackup` decision: document the choice (default: `false` for privacy, since in-app backup exists).

---

## 8. Additional Features (recommended roadmap)

### 8.1 Deck & card management
- Nested decks (`Parent::Child`), drag to reorder, rename, merge, move cards, deck colors/icons, archive.
- **Card Browser** (Anki-style): powerful search (`deck:`, `tag:`, `is:due`, `is:new`, `is:suspended`, `prop:ease<2`, `added:7`, free text in any field), multi-select bulk actions (move, tag, suspend, delete, reset).
- **Add/Edit note screen:** rich text (bold, italic, underline, color, lists), insert image (gallery/camera), audio (record/pick), cloze button, tags autocomplete, RTL toggle per field, templates preview.
- **Note type editor:** fields & card templates (HTML + CSS), preview — see **Section 8A** (required, full AnkiDroid parity).
- **Duplicate finder** and merger.
- **Quick add** from a Home FAB and Android share-text intent ("Share to Flashcards" creates a card from selected text).
- Undo for destructive actions + **Trash** (30-day recycle bin).

### 8.2 Study experience
- Text-to-speech (`expo-speech`) for front/back with per-deck language setting (auto-detect Arabic/English etc.); auto-play audio option.
- Image support with pinch-zoom; audio replay button; LaTeX/MathJax-lite (optional later); code highlighting (optional).
- Per-card **hints** and **notes/mnemonics** field.
- **Image occlusion** (Phase 6, optional).
- **Typing mode** with character-level diff and Arabic diacritics tolerance option.
- Custom fonts per field (important for Arabic: Naskh/Kufi, Amiri, Noto), font size slider, text alignment, night mode styling inside card HTML.
- Haptic feedback and sound effects (toggle).
- One-handed mode (answer buttons at bottom, large hit areas), landscape/tablet layout.
- Keep screen awake during study.

### 8.3 Statistics
- Today summary, answer-button distribution, true retention, mature/young/new/learning counts.
- Review heatmap (365 days), reviews-per-day chart, **future due forecast**, interval distribution, ease/stability/difficulty distribution, time studied, cards added per day.
- Per-deck and all-decks views; date range filters; export stats as CSV.

### 8.4 Settings & personalization
- Light / Dark / AMOLED / follow system; accent color; Material 3 design.
- Language: Arabic / English (+ extensible); full RTL mirroring.
- Day rollover hour, timezone behavior, default deck options, gesture mapping, button layout.
- Notification settings, backup settings, app lock, storage tools, import history, "About / Open-source licenses".

### 8.5 Quality-of-life
- **Home screen widgets (Android)**: due-cards counter, tap to study (can be a later phase; requires native module/`react-native-android-widget`).
- **Quick Settings tile / app shortcuts**: "Review now", "Add card".
- **Onboarding:** 3 screens + sample deck + "Import your Anki deck" shortcut.
- **Empty states** with clear call-to-action; contextual help tips.
- Global search across decks.
- Optional **offline dictionary lookup** (user-imported) — future.
- Optional **AI-free auto-generation** helpers: bulk "reverse cards" generation, "create cloze from selection".

---

## 8A. Card Templates & Styling Engine (AnkiDroid-style card layout editing) — REQUIRED

The user must be able to **fully customize how cards look and which fields appear on the front/back**, exactly like AnkiDroid's *Note Types → Fields / Cards...* screens. Imported `.apkg` templates must be preserved and remain editable.

### 8A.1 Note Types (Models) manager
- Screen **Settings → Note Types**: list, add, clone, rename, delete (with warning showing how many notes use it), reset to default.
- Built-in types: **Basic, Basic (and reversed card), Basic (optional reversed), Basic (type in the answer), Cloze**, plus language-learning presets (see 8A.6).
- Each note type shows: number of notes, fields, card templates.
- Export / import a single note type as a `.json` file (to share templates).
- **Change Note Type** for existing notes with a mapping screen (old fields → new fields, old templates → new templates).

### 8A.2 Fields editor
- Add, rename, delete, **reorder** (drag) fields.
- Per field: **font family, font size, RTL direction, "sticky" (keep value when adding multiple notes), collapse in editor, description/placeholder**.
- Choose the **Sort field** (used for browser sorting and duplicate check).
- Renaming a field must **automatically update all templates** that reference it. Deleting a field must warn and strip it from templates.

### 8A.3 Card Templates editor ("Cards..." screen)
- A note type has **one or more card templates** (add / delete / rename / reorder / duplicate). Each template has:
  - **Front template** (HTML)
  - **Back template** (HTML)
  - Optional **Browser appearance** (short question/answer format for the card list)
  - Optional **Deck override** (cards of this template go to a specific deck)
- One **shared Styling (CSS)** editor per note type.
- UI: tabs **Front | Back | Styling**, bottom toolbar with **Insert Field** (chips/menu listing all fields), **Preview**, **Undo/Redo**, **Save**, **Discard**.
- Code editor features: monospace font, syntax highlighting for HTML/CSS/Mustache `{{ }}`, line numbers, auto-closing tags/braces, find & replace, font-size control, RTL-safe editing, and Insert-field-at-cursor.
- **Live preview** (side-by-side on tablets, toggle on phones): Front and Back, using a **sample note** (user can pick any real note from the deck) with options for Light / Dark mode and font scale.
- Validation with friendly errors (unknown field, unclosed `{{#Field}}`, front template empty, front template producing identical output for all notes, cloze requirement).
- **Version history:** keep the last 10 saved versions of each note type's templates/CSS with one-tap restore.
- **Safety:** saving shows a confirmation if the change will **create or delete cards**; a **Reset to default** button for built-in types.

### 8A.4 Template language (must be implemented in `core/render/`)
Support Anki-compatible syntax so imported templates work unchanged:
- `{{Field}}` — field value (HTML allowed)
- `{{FrontSide}}` — front rendered inside the back template
- `{{#Field}} ... {{/Field}}` — show only if the field is **not empty**
- `{{^Field}} ... {{/Field}}` — show only if the field **is empty**
- `{{text:Field}}` — strip HTML; `{{hint:Field}}` — click-to-reveal hint
- `{{type:Field}}` — type-in-the-answer box with diff comparison on the back
- `{{cloze:Field}}` and `{{c1::answer::hint}}` — cloze rendering (hidden `[...]` on front, highlighted on back)
- Special fields: `{{Tags}}`, `{{Deck}}`, `{{Subdeck}}`, `{{Card}}`, `{{Type}}` (note type name), `{{CardFlag}}`
- `<hr id=answer>` — scroll/split point on the back
- Media: `<img src="file.jpg">`, `[sound:file.mp3]` (rendered as a play button), plus TTS tag: `{{tts ar_SA:Field}}`
- CSS classes injected on the card root: `.card`, `.card1`, `.card2`…, `.night_mode`, `.nightMode`, `.android`, plus `.cloze`
- Unknown or malformed tags must **never crash**: show a readable error card instead.
- **JavaScript in cards:** disabled by default; optional switch "Allow JavaScript in cards" in Settings (with security warning) for advanced users; when enabled, run only inside the sandboxed WebView with no access to app APIs.

### 8A.5 Cards generation rules (when templates change)
- A card is generated for a note when its template's **front side is non-empty** after rendering.
- **Adding a template** → create new cards for all existing notes of that type (new state), into the template's deck override or the note's current deck.
- **Deleting a template** → delete its cards after a clear warning (show count).
- **Editing a field value** can create/remove cards (conditional templates) → provide **"Empty Cards" cleanup tool** (Tools → Check cards) that lists and deletes cards with empty fronts.
- Changing templates **never resets** scheduling of existing cards; changing the *order* of templates keeps card identity by a stable template id (not by position only).

### 8A.6 Visual (no-code) style editor + template gallery
For non-technical users, add **"Simple mode"** next to **"HTML/CSS mode"** (toggle). Simple mode generates the CSS/HTML for the user:
- Font family (include bundled Arabic fonts: **Amiri, Noto Naskh Arabic, Noto Kufi Arabic, Cairo, Tajawal**; plus the system fonts), size, weight, text color, background color, alignment, line height, direction (auto/RTL/LTR), card padding, border/radius, image max-width.
- Per-field styling (e.g., word = large bold, example = small italic gray, pronunciation = colored).
- Layout toggles: show/hide fields on front or back, order of fields (drag), separators, show tags/deck name.
- Separate **Night mode** colors.

**Template gallery (presets, work offline, bundled):**
1. Classic Basic
2. Vocabulary card — Word / Meaning / Example / Pronunciation / Part of speech / Image / Audio
3. Reverse + Typing answer
4. Cloze (sentence completion)
5. Arabic ↔ English with diacritics (tashkeel) and RTL layout
6. Medical/Q&A with Extra notes
7. Minimal dark / Large-text accessibility style

Apply a preset to an existing note type (with preview and confirmation) or create a new note type from it.

### 8A.7 Rendering & performance requirements
- Render cards in a WebView (or equivalent) with the note type's CSS injected; cache compiled templates; pre-render the **next card in the background** so flipping and advancing is instant.
- Re-rendering after a template/CSS change must apply **immediately** across Home → Study → Browser without restarting the app.
- Local media referenced by relative filename must resolve from the app's `media/` folder.
- Respect per-field RTL/font settings and the card's own CSS; card CSS must not leak into the app UI.
- `.apkg` import/export must **round-trip** note types: fields, templates (qfmt/afmt), css, sort field, cloze flag — so a deck exported from this app and opened in AnkiDroid keeps its design.

### 8A.8 Acceptance criteria
- [ ] Import an `.apkg` with a custom-designed note type → cards look the same as in AnkiDroid (fonts, colors, layout, conditional fields, cloze).
- [ ] Edit Front/Back/CSS, tap Preview → changes visible immediately; Save → all existing cards of that type update.
- [ ] Add a field, insert it in the template via "Insert Field", fill it in a note → it appears on the card.
- [ ] Add a second template (reverse) → reverse cards are created for existing notes; delete it → warning + cleanup.
- [ ] `{{#Field}}` / `{{^Field}}` conditionals, `{{type:Field}}`, `{{cloze:Field}}`, `[sound:]` and `<img>` all render correctly.
- [ ] Arabic RTL template renders correctly in both Light and Night mode.
- [ ] Restore a previous template version from history works.
- [ ] Malformed template shows an error message, never a crash.

---

## 8B. Design System & UX (modern, playful — "Duolingo / Quizlet / modern flashcards" style)

> Visual direction: **friendly, colorful, gamified, rounded, big and tappable**. *Inspired by* modern learning apps, but with an **original** identity: original mascot, icons, sounds and colors — do **not** copy Duolingo/Quizlet/Anki logos, characters, or assets.

### 8B.1 Design principles
1. **One clear action per screen** (a big primary button).
2. **Instant feedback** on every answer: color, motion, haptic, sound.
3. **Short sessions, visible progress** (progress bar always on top during study/quiz).
4. **Celebrate effort** (streaks, XP, confetti) but give a **"Focus / Pro mode"** switch that turns off gamification and shows a minimal Anki-like UI.
5. **RTL-first** (Arabic) and LTR (English), mirrored layouts and icons.

### 8B.2 Design tokens (build as a theme file, never hardcode colors)
- **Colors (default palette, user can change accent):** Primary green `#58CC02` (pressed `#46A302`), Secondary blue `#1CB0F6`, Accent purple `#CE82FF`, Warning/streak orange `#FF9600`, Error red `#FF4B4B`, Gold `#FFC800`; neutrals: Snow `#FFFFFF`, Feather `#F7F7F7`, Hare `#E5E5E5`, Wolf `#AFAFAF`, Eel `#4B4B4B`; Dark mode: background `#131F24`, surface `#1F2C34`, border `#37464F`, text `#F1F7FB`. AMOLED black option.
- **Typography:** Latin: *Nunito* (rounded, friendly). Arabic: *Cairo* or *Tajawal* (+ Amiri/Noto Naskh for card content). Scale: 12/14/16/18/22/28/36. Weights: 600/700/800 for headings.
- **Shape:** radius 12 (inputs), 16 (buttons/cards), 24 (sheets), full (chips/avatars). **Spacing scale:** 4/8/12/16/24/32.
- **Elevation style: "chunky 3D"** — buttons and cards have a solid **bottom border (4px darker shade)** instead of blurry shadows; pressing translates the element down 4px and removes the border.
- **Motion tokens:** 120 ms (micro), 250 ms (standard), 400 ms (celebration); spring easing. Respect **Reduce Motion** setting.

### 8B.3 Core UI components (reusable library)
`Button` (primary/secondary/danger/ghost, chunky 3D, disabled, loading) · `Card` · `FlashCard` (3D flip) · `ProgressBar` (animated, segmented) · `ProgressRing` · `Chip` · `Tag` · `Tabs` · `BottomSheet` · `Dialog` · `Toast/Snackbar` · `Switch/Checkbox/Radio/Slider/Stepper` · `TextField` (RTL-aware) · `SearchBar` · `EmptyState` (with mascot illustration) · `Skeleton loader` · `Badge` · `StreakFlame` · `XPCounter` · `Confetti` · `Avatar/Mascot` · `Calendar` · `HeatmapGrid` · `Charts` · `FAB` · `ListItem` with swipe actions.

### 8B.4 Key screen designs
- **Home ("Today"):** greeting + streak flame + XP; **big daily-goal ring**; two large cards: **Review (N due)** and **Learn New (N)**; **"Quick Quiz"** button; "Continue where you left off"; today's quests; next scheduled session; deck shortcuts.
- **Decks ("Library"):** colorful deck cards (icon + color + progress bar + New/Learn/Due counters), grid/list toggle, nested decks as expandable folders, search, sort, long-press for actions.
- **Learning path (optional view):** a Duolingo-like vertical **path of lessons** per deck — each node = a batch of 5–10 cards (new → practice → review) with locked/unlocked/completed states and a "legendary/review" node. User can switch between "Path view" and "Classic deck list".
- **Study screen:** top: close ✕ + animated progress bar + counters; center: **large flip card** (tap or swipe to flip) with the **3D flip animation**; bottom: 4 chunky rating buttons (Again red / Hard orange / Good green / Easy blue) showing next interval. Swipe gestures with colored overlay hints.
- **Feedback overlay:** after answering in quiz modes, a bottom banner slides up (green "Correct!" / red "Correct answer: …") with a **Continue** button (Duolingo-style), plus sound and haptic.
- **Session complete:** confetti, XP earned, accuracy ring, time, streak update, new words learned list, buttons "Study more", "Review mistakes", "Home".
- **Stats:** friendly cards with charts, calendar heatmap, streak history.
- **Profile (local only):** level, total XP, badges, longest streak, total words learned, avatar/mascot customization — **all stored locally**.
- **Onboarding:** 4 animated screens → choose goal (Casual 5 / Regular 10 / Serious 20 / Intense 50 cards a day) → pick language & theme → ask notification time → import deck or create sample deck.

### 8B.5 Gamification (all local, all optional)
- **XP** per card/quiz answer, bonus for streaks and perfect sessions; **Levels** with titles.
- **Streak** with flame, **streak freeze** (earned by XP), weekly streak calendar.
- **Daily Quests** (e.g., "Learn 10 new words", "Finish 1 quiz", "Review 30 cards", "Get 5 correct in a row") with chest/reward animation.
- **Achievements/Badges** (First import, 7-day streak, 100 words, Perfect quiz, Night owl, Early bird, Marathon…).
- **Personal bests & "Leagues-like" weekly tiers** computed locally against the user's own previous weeks (no online leaderboard).
- Optional **Hearts/Lives** only inside Survival quiz mode (never in normal review).
- **Master switch:** Settings → "Gamification: On / Minimal (Anki-style) / Off".

### 8B.6 Sound, haptics & polish
- Original short sound effects: correct, wrong, flip, complete, streak — volume + on/off toggles.
- Haptics (`expo-haptics`): light on tap, success/error on answers.
- Animations with `react-native-reanimated` + `react-native-gesture-handler`; confetti and mascot with **Lottie** or **Skia**.
- Smooth 60 fps, keep the next card pre-rendered.

---

## 8C. Quiz & Test System (separate from SRS review)

A dedicated **"Quiz"** tab/section. Quizzes are **practice/testing** and **do not change SRS scheduling by default** (setting: "Let quiz answers affect scheduling: Off / Only wrong answers / On").

### 8C.1 Quiz builder (custom quiz)
User chooses:
- **Source:** one or many decks (incl. sub-decks), tags, flags, only new / learned / difficult (high lapses) / suspended excluded / "my mistakes", or all cards.
- **Number of questions:** 10 / 20 / 50 / custom / all.
- **Selection:** **Random** (default), weighted-random (favor weak cards), sequential, by least-recently-seen.
- **Question types** (mix any): see 8C.2.
- **Direction:** Front→Back, Back→Front, or random per question; choose which fields are the question/answer.
- **Time:** none / per-question timer (5–60 s) / total timer.
- **Options:** shuffle answers, show hints, allow skip, show answer immediately vs only at end, auto-play audio/TTS, case/diacritics-insensitive typing.
- **Save as preset** ("My quizzes") and quick-start buttons: *Quick 10*, *Random 20*, *Mistakes only*, *Exam 50*.

### 8C.2 Question types
1. **Multiple choice** (4 options; distractors auto-generated from other cards in the same deck/tag, same note type, similar length; Arabic/English aware; avoid duplicates and near-synonyms).
2. **True / False** (card shown with either its real answer or a wrong one).
3. **Type the answer** (with fuzzy matching: ignore case, punctuation, Arabic diacritics/hamza variants optionally; "almost correct" typo tolerance with Levenshtein; show diff).
4. **Flashcard self-check** ("I knew it / I didn't") for quick drills.
5. **Matching game** (match 5–6 pairs: drag/tap, timed, animated).
6. **Fill in the blank / Cloze** (from cloze notes or auto-blank a word in the example sentence).
7. **Word scramble / Build the word** (arrange letters or words of a sentence — Duolingo-style tiles).
8. **Listening quiz** (audio/TTS plays → choose or type what you heard).
9. **Image quiz** (image → choose word, or word → choose image).
10. *(Optional later)* **Speaking** with on-device speech recognition and pronunciation scoring.

### 8C.3 Quiz modes
- **Random Quiz** — random cards & random question types.
- **Practice mode** — instant feedback after each question; retries allowed.
- **Exam / Test mode** — timed, no feedback until the end, final score, pass mark setting, review of all answers.
- **Survival mode** — 3 lives; endless until you fail; high score tracking.
- **Speed round / Time attack** — as many correct answers as possible in 60 s; combo multiplier.
- **Daily Challenge** — fixed set generated per day from weak/due cards; counts toward quests/streak.
- **Mistakes Notebook** — automatically collects wrong answers; "Practice mistakes" and "Remove when answered right 3 times".
- **Match Rush** — matching game levels with increasing pairs/speed.
- **Mixed Session (Duolingo-style lesson):** introduce 5 new words → quiz them with varied question types → final review.

### 8C.4 Results & analytics
- Result screen: score %, correct/wrong, time, XP, per-question review (your answer vs correct), **"Retry wrong ones"**, **"Add wrong to Mistakes / suspend / flag"**, share result as image.
- **Quiz history** list with filters; trend chart of scores; weak cards/tags ranking; accuracy per question type.
- Export results CSV.

### 8C.5 Data tables to add
```
quiz_presets(id, name, config_json, created_at)
quiz_attempts(id, preset_id NULL, mode, started_at, ended_at, total, correct, score, duration_ms, config_json)
quiz_answers(id, attempt_id, card_id, question_type, user_answer, correct_answer, is_correct, time_ms, answered_at)
mistakes(card_id PK, wrong_count, correct_streak, last_wrong_at)
xp_log(id, source, amount, created_at)  achievements(id, key, unlocked_at)  quests(id, date, key, progress, target, claimed)
```
Module: `core/quiz/` (question generator, distractor engine, answer checker with fuzzy/Arabic normalization, scoring) — pure TS with unit tests.

### 8C.6 Acceptance criteria
- [ ] Random quiz of 20 questions from 3 decks with mixed types starts in < 1 s and never repeats a question or shows duplicate options.
- [ ] Arabic typing answers accept diacritic/hamza/ta-marbuta variations when the option is on.
- [ ] Exam mode hides feedback until the end and the timer ends the test automatically.
- [ ] Wrong answers appear in the Mistakes Notebook and "Retry wrong" works.
- [ ] Quiz answers do not alter SRS unless the user enabled it.

---

## 8D. AnkiDroid Feature-Parity Checklist (everything must exist)

**Decks & deck picker**
- [ ] Deck list with New/Learn/Due counts, nested decks, collapse/expand, create/rename/delete, drag to reparent, deck description (HTML), deck options (per deck / presets / "apply to all"), empty deck, deck export, **filtered decks** (create by search + limit + order, with/without rescheduling, rebuild/empty), **Custom Study** (increase today's new/review limits, review forgotten cards, review ahead, study by state/tag, preview new cards, cram).
- [ ] **Deck options presets:** new cards/day, max reviews/day, learning steps, graduating/easy interval, insertion order, relearning steps, minimum interval, leech threshold/action, maximum interval, starting ease, easy bonus, interval modifier, hard interval, new interval, bury new/review/interment siblings, auto-play audio, replay on answer, maximum answer seconds, show timer, FSRS toggle & desired retention & parameter optimization on-device from review history.

**Reviewer**
- [ ] Show Answer, 4 answer buttons with intervals, **undo**, **edit note**, **add note**, **mark note**, **suspend/bury card or note**, **flag (7 colors)**, **delete note**, **reset/forget card**, **set due date**, **reposition new card**, card info, **replay audio**, **TTS**, **record voice**, **whiteboard (draw on card; pen colors, undo, clear; stylus support)**, **type-in answer with diff**, **auto-advance & auto-show-answer timers**, full-screen / hide status bar, answer-button size/position settings, show remaining count & timer, **gestures** (swipe, tap zones, double tap, shake) fully customizable, **hardware keyboard shortcuts** (Space, 1–4, E, U, Z, *, !, etc.), **Bluetooth/headset button** actions, keep screen on, night mode inversion for card content, **show answer-time limit**, "focus mode".
- [ ] **Previewer** for card templates and browser items.

**Card Browser**
- [ ] Cards/Notes toggle, selectable columns (Sort field, Question, Answer, Deck, Due, Interval, Ease, Reps, Lapses, Created, Modified, Tags, Note type), sort by any column, **full Anki search syntax**, saved searches, multi-select + bulk: change deck, add/remove tags, flag, mark, suspend, delete, reset progress, reposition, set due date, change note type, **find & replace**, **find duplicates**, export selected, "Select all", preview.
- [ ] **Tags manager** (rename, delete, merge) and sidebar filter by deck/tag/note type/flag/state.

**Notes & editor**
- [ ] Add/Edit note with field editor (rich-text + **HTML view**), image (gallery/camera/crop), audio (record/file), **clipboard paste of images/HTML**, cloze buttons (new cloze / same cloze), tag editor with autocomplete, multimedia attach/remove, note type & deck chooser, copy/paste/duplicate note, **add-note shortcut from other apps (ACTION_SEND text)**, **ACTION_PROCESS_TEXT "Create flashcard"** in the text-selection menu.

**Statistics**
- [ ] Today, forecast (1 month/3 months/1 year/all), review count, review time, intervals, ease, answer buttons, hourly breakdown, card counts (new/learning/relearning/young/mature/suspended/buried), added cards, retention, per deck/collection, FSRS stats (stability/difficulty/retrievability).

**Tools / maintenance**
- [ ] **Check database**, **Check media** (find unused/missing files), **Empty cards**, **Remove unused media**, **Reset all scheduling**, **Rebuild/Reschedule on change**, **Undo history**, Fix card order, compact DB (VACUUM).

**Media & language**
- [ ] Audio/video/image support; **TTS per language with voice/speed selection** and TTS template tag; per-field/deck language.
- [ ] **Image Occlusion** (hide-one / hide-all rectangles/ellipses on an image) — built-in note type.

**Import/Export** (all of Section 4) plus: import `.colpkg`, text with tags/deck columns, "update existing notes", export **with/without scheduling info and media**, export notes as text, share single deck/note.

**App behaviors**
- [ ] Notifications for due cards; **home-screen widgets** (deck due counts, "Add note" shortcut); app shortcuts; **Android 13+ per-app language**; tablet two-pane layouts; split-screen; **night mode** + custom themes; **backups** (auto + manual); permission handling; gesture navigation back-stack correctness; large-font accessibility; keyboard/mouse support.
- [ ] **Sync:** AnkiWeb sync is **intentionally excluded** (offline-only app). Provide instead an optional **local transfer** later: export/import `.zip` backup or **Wi-Fi LAN/QR transfer between two devices** (no cloud, no accounts).

---

## 8E. Extra Features Beyond AnkiDroid (differentiators)

**Faster card creation**
- **Quizlet-style bulk text import** (paste `term<TAB>definition`, or `term - definition`) with live preview.
- **Camera OCR → cards** (on-device ML Kit text recognition, Arabic + Latin), select text lines → create cards.
- **Voice input** to dictate a term/definition.
- **Auto-reverse generator**, **auto-cloze from selection**, **batch edit fields**, **auto-fetch example sentences from an *optional, user-imported offline dictionary file*** (no internet).
- **Duplicate detection while typing** (warning chip).
- **Smart paste:** split pasted lists into multiple cards.

**Smarter learning**
- **Study Plan / Exam-date planner** (see Section 6) with daily quota recommendations.
- **Daily Mix:** auto-built session mixing due reviews + new words + weak cards + a short quiz.
- **Adaptive difficulty:** recommends more/less new cards based on recent retention; "You're overloaded — pause new cards?" prompt when review backlog is large.
- **Backlog recovery tool:** spread overdue cards over N days.
- **Leech coach:** suggests creating a mnemonic/example, splitting the card, or adding an image.
- **Word of the day** notification & home card (from the user's own decks).
- **Focus mode** with Pomodoro, ambient timer, and "do-not-disturb" reminder.
- **Handwriting practice** for Arabic letters/Chinese/Japanese (canvas with stroke order guide, optional).
- **Pronunciation practice:** record yourself vs. TTS playback comparison.
- **Listening mode / "Podcast mode":** hands-free playback of cards (question → pause → answer) with TTS for commuting.
- **Reading mode:** browse a deck like a list/word list with quick reveal.

**Organization & sharing (offline)**
- Collections/folders, favorites, pin decks on Home, deck colors/emoji icons, archive.
- **Share a deck/note as an image or PDF** (study sheet / printable flashcards PDF with cut lines).
- **QR/LAN transfer** between devices; **share via any app** as `.apkg`.
- **Trash/Recycle bin**, **change history/undo log** for the whole collection.

**Quality of life**
- Per-deck theme/accent, font presets, one-handed mode, tablet/foldable layout.
- App lock (biometric/PIN), hide notification content, private decks (locked folder).
- Home-screen widgets (due count, streak, quick quiz), Quick Settings tile, adaptive launcher icon, themed icons.
- In-app **Help center** (offline) with short guides: importing from Anki, creating templates, how SRS works.
- **Feedback-free:** no network; "Report a bug" opens a pre-filled email with a locally generated, user-reviewable log file.

---

## 9. Screens / Navigation Map

```
Tabs: Home | Decks | Quiz | Stats | Profile/Settings   (+ center FAB: Add note)

Home            → today's summary, goal ring, streak, "Review (N)", "Learn New (N)", next scheduled session
Decks           → list/tree, per-deck counts (New/Learn/Due), tap → Deck Overview
Deck Overview   → Study buttons, deck options, browse, import into deck, export, stats
Study (Review)  → card view, rating buttons, undo, card menu
Study (Learn)   → intro view → quiz loop → summary
Quiz            → builder, presets, modes (random/exam/survival/speed/match), results, mistakes notebook
Profile         → level, XP, streak, badges, quests, gamification mode
Add / Edit Note → editor
Note Types      → list → Fields editor / Cards (Front|Back|Styling) editor + Preview + Gallery
Browser         → search + list + bulk actions
Import Wizard   → pick → preview → mapping → progress → report
Planner         → calendar, schedules list, add/edit schedule
Stats           → charts
Settings        → general, scheduling, notifications, backup, storage, security, about
```

---

## 10. Architecture & Code Structure

```
src/
  app/                    # expo-router routes
  features/
    decks/ cards/ study/ quiz/ import/ export/ schedule/ stats/ gamification/ profile/ browser/ templates/ settings/ backup/ tools/
  core/
    db/        # connection, migrations, repositories (DAO)
    scheduler/ # pure TS: fsrs.ts, sm2.ts, queue-builder.ts, day-boundary.ts
    quiz/      # pure TS: generator.ts, distractors.ts, checker.ts (fuzzy + Arabic normalization), scoring.ts
    gamification/ # xp.ts, streak.ts, quests.ts, achievements.ts
    search/    # Anki search-syntax parser → SQL
    importers/ # apkg.ts, csv.ts, xlsx.ts, anki-text.ts, mapping.ts
    exporters/ # apkg.ts, csv.ts, xlsx.ts
    render/    # template engine ({{Field}}, {{cloze}}, conditionals, {{FrontSide}})
    notifications/
    media/
  components/ ui/
  i18n/ (ar.json, en.json)
  theme/     # tokens.ts (colors, type, radius, spacing, motion), light/dark/amoled
  utils/
__tests__/
```

**Rules**
- Template rendering lives in `core/render/` (parser → AST → renderer), fully unit-tested against Anki template examples, including Arabic/RTL cases.
- Strict separation: UI → hooks → services → repositories → SQLite.
- Scheduler, importers, template renderer = **pure and unit-tested** with fixture files (small `.apkg`, `.txt`, `.xlsx` samples including Arabic text and media).
- Use **HTML sanitization** when rendering card HTML in `react-native-webview` (disable JS in cards by default, allow only local media via file URIs). Card renderer should be a single WebView reused across cards for performance.
- Heavy work (import, export, backup) must not block the UI thread: chunk with `InteractionManager`/yielding, show progress.
- Build the **study queue** efficiently with SQL (indexed on `deck_id, state, due`), not by loading all cards in memory.

---

## 11. Non-Functional Requirements

- **Performance:** cold start < 2 s on a mid-range device; next card < 100 ms; browser smooth with 100k cards; import of 10k cards < 30 s.
- **Reliability:** transactional writes; no data loss on crash/kill during review (write each answer immediately).
- **Accessibility:** screen reader labels, scalable fonts, sufficient contrast, large touch targets.
- **Privacy:** no network, no tracking. Include a privacy statement screen ("Everything stays on your device").
- **Compatibility:** Android 8+ (API 26+); portrait + landscape; tablets.
- **Size:** keep dependencies lean; enable Hermes and ProGuard/R8.
- **Localization:** all strings externalized; correct plural forms in Arabic; Arabic-Indic digits optional.

---

## 12. Edge Cases the AI Must Handle

- Importing the same file twice; huge files (100 MB+ media); missing media entries; unusual characters/emoji; mixed RTL/LTR text in one field; HTML in fields; empty fields; very long fields.
- Cards with deleted note types; cloze with multiple deletions (`c1`, `c2`) producing multiple cards.
- Device clock changed backwards; timezone travel; notifications permission denied (show in-app banner and path to settings).
- App killed during import → no half-imported deck (transaction/rollback or resumable).
- Low storage space: detect and warn before import/backup.
- Anki decks with filtered decks (`odid`, `odue`) → flatten to the original deck.
- Scheduling conversion from Anki: `queue`/`type` mapping, `factor/1000` ease, negative `due` for learning cards.

---

## 13. Acceptance Criteria (per core feature)

**Import**
- [ ] A real AnkiDroid-exported `.apkg` (with images & audio, nested decks, cloze) imports with correct card count, fields, tags, media, and (optionally) scheduling.
- [ ] A tab-separated `.txt` exported from Anki imports with correct mapping; CSV with Arabic text displays correctly.
- [ ] An `.xlsx` with 3 columns (word, meaning, example) imports via the mapping UI.
- [ ] Re-importing the same file creates no duplicates when "skip duplicates" is on.
- [ ] Corrupt / unsupported files show a clear message, never a crash.

**Study**
- [ ] Review and Learn New are separate flows with their own counts and summaries.
- [ ] Interval previews on buttons match the scheduler's actual next due.
- [ ] Undo restores the exact previous card state and log.
- [ ] Daily limits and rollover hour are respected.

**Design**
- [ ] UI uses only design tokens; chunky 3D buttons, animated progress, flip animation, feedback banners, confetti; runs at 60 fps on a mid-range phone; full RTL mirroring; Reduce Motion respected; gamification can be switched to Minimal/Off.

**Quiz**
- [ ] See 8C.6.

**Anki parity**
- [ ] Every item in 8D is implemented or explicitly marked "deferred" with a reason.

**Scheduling**
- [ ] A schedule created for 07:30 Mon–Fri fires on time, survives app restart and device reboot, and opens the correct deck.
- [ ] No reminder when nothing is due (if "smart reminder" is on).

**Storage**
- [ ] Airplane mode: every feature works.
- [ ] Backup → uninstall → reinstall → restore returns identical data.

---

## 14. Delivery Phases (build in this order)

1. **Foundation + Design System:** Expo project, TypeScript, routing, **design tokens & core UI components (8B.2–8B.3)**, light/dark/AMOLED, i18n (AR/EN + RTL), fonts, SQLite + migrations + repositories, seed sample deck, bottom-tab shell.
2. **Decks, Notes & Templates:** deck list/tree, add/edit note (basic + reversed + cloze), **template engine (8A.4)**, WebView card renderer with CSS injection, media storage, **Note Types / Fields / Cards editor with live preview (8A.1–8A.3)**.
3. **Scheduler & Study:** SM-2 + FSRS modules with tests, queue builder, Review mode, Learn New mode, 3D flip card, undo, card actions (suspend/bury/flag/mark/reset/set due), daily limits, rollover hour, session-complete screen.
4. **Import:** text/CSV/Quizlet-paste → Excel → `.apkg` (media + scheduling conversion) → import history/undo → "Open with"/share intent.
5. **Quiz System (8C):** question generator, distractor engine, answer checker (Arabic normalization), builder, all modes, results, mistakes notebook, quiz history.
6. **Planner & Notifications:** schedules, reminders, notification actions, reboot rescheduling, session timer, goals, calendar/forecast, exam-date planner.
7. **Gamification & Profile (8B.5):** XP, levels, streaks, quests, badges, learning-path view, celebrations, sounds/haptics, master gamification switch.
8. **Browser, Stats & Tools (8D):** card browser + full search syntax + bulk actions, tags manager, filtered decks & custom study, statistics, check database/media, empty cards, find/replace, duplicates.
9. **Backup, Export, Security:** export `.apkg/.csv/.xlsx/.pdf`, full backup/restore, auto backups, app lock, private decks, LAN/QR transfer (optional).
10. **Advanced & Polish:** whiteboard, image occlusion, TTS/voice recording, typing/handwriting, podcast mode, OCR card creation, widgets/shortcuts, Simple-mode style editor + template gallery + version history, onboarding, accessibility, performance tuning, release build (AAB), store assets.

For every phase: provide a short README of what was built, how to test it, and unit tests for core logic. Ask me before choosing between alternatives not covered here.

---

## 15. Instruction to the AI (copy this part as the prompt)

> You are a senior React Native engineer. Build the app described in this document using Expo + TypeScript + SQLite, strictly offline. Start with **Phase 1 only**. Output complete, runnable code with file paths, install commands, and run instructions (development build). Keep the scheduler, importers, and template renderer as pure, tested modules. Use clean architecture as specified. After finishing a phase, stop and list what's done, what to test manually, and the next phase. Never add network calls or tracking. Support Arabic RTL from day one. Apply the Design System in Section 8B (original assets only) and follow Sections 8A–8E as the full feature scope. If something in the spec is ambiguous or technically infeasible (e.g., Anki `.anki21b` zstd decoding), implement the specified fallback and tell me.
