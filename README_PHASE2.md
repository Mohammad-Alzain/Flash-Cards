# Phase 2: Decks, Notes & Templates (Sections 8A.1–8A.6)

## 📋 What was built in Phase 2

1. **Anki-Compatible Template Engine (`src/core/render/templateEngine.ts`)**:
   - `{{Field}}`: HTML field replacement with special tags (`{{Tags}}`, `{{Deck}}`, `{{Subdeck}}`, `{{Card}}`, `{{Type}}`, `{{CardFlag}}`).
   - `{{FrontSide}}`: Replaces with the rendered Front HTML inside Back templates.
   - `{{#Field}} ... {{/Field}}`: Conditionals (rendered only when field is non-empty).
   - `{{^Field}} ... {{/Field}}`: Inverted conditionals (rendered only when field is empty).
   - `{{text:Field}}`: HTML tag stripping for clean text.
   - `{{hint:Field}}`: Click-to-reveal hint element (`<a class="hint">Show Hint</a>`).
   - `{{type:Field}}`: Type-in answer input on Front, automated diff checking on Back.
   - `{{cloze:Field}}` & `{{c1::answer::hint}}`: Multi-cloze deletion engine.
   - Local media resolution: `<img src="image.jpg">` and `[sound:audio.mp3]`.
   - CSS isolation and `.nightMode` / `.card` classes injection.
   - 100% pure TypeScript module with unit tests in `__tests__/templateEngine.test.ts`.

2. **Offline Media Storage Manager (`src/core/media/mediaManager.ts`)**:
   - Private storage inside `documentDirectory/media/`.
   - Path resolution (`resolveUri`), media copy, deletion, and size calculation.
   - Media metadata indexing in SQLite (`media` table).

3. **Card Renderer (`src/components/card/CardRenderer.tsx`)**:
   - Sandboxed WebView component for rendering card templates with CSS.
   - Zero network exposure, offline file URI access enabled.
   - Dynamic Dark / AMOLED mode style injection.

4. **Note Types Manager (`src/app/note-types/index.tsx`)**:
   - List note types with live counts (notes using it, fields count, templates count).
   - Create new note type.
   - Clone and delete (with safety protection if notes exist).

5. **Fields Editor (`src/app/note-types/[id]/fields.tsx`)**:
   - Add new fields, rename, and delete with safety checks.
   - Reorder fields with Up / Down position buttons.
   - Per-field Right-to-Left (RTL) switch for Arabic / Hebrew script.

6. **Card Templates & CSS Editor (`src/app/note-types/[id]/templates.tsx`)**:
   - Tabs: **Front | Back | Styling (CSS)**.
   - Monospace code editor.
   - "Insert Field" toolbar chips for instant cursor tag insertion.
   - **Live Preview Modal**: Test card rendering on Front and Back with sample data and Dark mode switch.
   - **Version History**: Keep last 10 snapshots in `note_type_versions` with one-tap restore.

7. **Template Gallery (`src/app/note-types/gallery.tsx`)**:
   - 7 Bundled offline presets:
     1. Classic Basic
     2. Vocabulary Pro (Word, POS, Meaning, Example, Audio)
     3. Reverse + Typing Answer
     4. Cloze Deletion
     5. Arabic ↔ English (Tashkeel & RTL)
     6. Medical / University Q&A
     7. Minimal High-Contrast
   - Full live preview and instant "Use Preset" creation.

8. **Deck Hierarchy & Details Screen (`src/app/decks/[id].tsx`)**:
   - Detailed deck screen showing New / Learn / Due counters.
   - Settings editor (New cards/day, Max reviews/day, Description).
   - Delete deck with confirmation.

---

## 🧪 Testing Instructions

1. **Run Unit Tests**:
   ```bash
   npx jest __tests__/templateEngine.test.ts
   ```
2. **Test Note Types & Card Templates**:
   - Open Settings -> Tap `📋 Note Types`.
   - Tap `Preset Gallery` -> Select `Arabic ↔ English` -> Tap `Preview` -> Tap `Use Preset`.
   - Tap `Cards & Styling` on any note type -> Edit Front/Back HTML or CSS -> Tap `👁️ Live Preview` to see changes.
   - Tap `📜` in the top right to restore any of the last 10 versions.
3. **Test Deck Details**:
   - Open Decks tab -> Tap the sample deck -> Verify counters and settings.
