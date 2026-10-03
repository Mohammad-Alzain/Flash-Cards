# Phase 4: Import System (Feature 1, Section 4)

## 📋 What was built in Phase 4

1. **Text & CSV Importer (`src/core/importers/textImporter.ts`)**:
   - Auto-detection of delimiters (Tab, Comma, Semicolon, Pipe).
   - Anki text-export headers: `#separator:tab`, `#html:true`, `#tags column:`, `#deck column:`.
   - **Quizlet-style text paste**: Automatically parses pasted lists with `term <TAB> definition`, `term - definition`, or `term : definition`.
   - Generates live preview of first 20 rows.
   - Column mapping engine (maps index -> Front / Back / Extra / Tags / Deck / Ignore).

2. **Excel (.xlsx / .xls) Importer (`src/core/importers/xlsxImporter.ts`)**:
   - Built with SheetJS (`xlsx`) for local offline spreadsheet reading.
   - Discovers workbook sheets and previews rows.
   - Extracts rows with column mapping into card candidates.

3. **Anki Package (.apkg / .colpkg) Importer (`src/core/importers/apkgImporter.ts`)**:
   - Unzips `.apkg` packages with `JSZip`.
   - Reads Anki SQLite collection database (`collection.anki2` / `collection.anki21`).
   - Extracts decks (with `::` hierarchy), note models, fields, cloze rules, templates (`qfmt`/`afmt`), and CSS.
   - Converts Anki scheduling info (due date offset from `col.crt`, interval, ease factor, learning cards epoch seconds).
   - Option: **"Keep original scheduling progress"** vs **"Reset all as new cards"**.
   - **Media extraction**: Unzips and maps numbered media files from the `media` JSON into the app's `media/` folder and rewrites references.
   - **New Anki Format Fallback (Section 4.2.8)**: Detects `collection.anki21b` and presents the friendly fallback prompt.

4. **Transactional Import Manager (`src/core/importers/importManager.ts`)**:
   - Runs imports in transactional batches (250 items/batch).
   - **Duplicate handling options**:
     - *Skip duplicates*: Ignores cards if `guid` or checksum/sort-field already exists.
     - *Update existing*: Updates fields and tags of matching cards.
     - *Import as new*: Always creates fresh cards.
   - Logs session in SQLite `import_history` table.
   - **Undo Import**: One-tap rollback that removes cards created during that specific import batch.

5. **Import Wizard Screen (`src/app/import/index.tsx`)**:
   - Tabs: **Select File** | **Paste Text**.
   - File picker supporting `.apkg`, `.colpkg`, `.csv`, `.tsv`, `.txt`, `.xlsx`, `.xls`.
   - Live Preview & summary statistics (estimated rows, detected delimiter, decks found).
   - Target Deck and Note Type selectors.
   - Duplicate strategy chips.
   - Keep scheduling switch for Anki packages.
   - Progress bar during import.
   - Detailed summary report on completion.

6. **Import History & Undo Screen (`src/app/import/history.tsx`)**:
   - Displays all previous imports with timestamp, file name, and counts.
   - One-tap "Undo This Import" button with instant database cleanup.

---

## 🧪 Testing Instructions

1. **Run Unit Tests**:
   ```bash
   npx jest __tests__/importer.test.ts
   ```
2. **Test Quizlet Paste**:
   - Open Decks tab -> Tap `📥` (Import) in top header.
   - Switch to **"Paste Text"** tab.
   - Paste:
     ```text
     Serendipity - Finding value by chance
     Resilience - Ability to recover quickly
     Eloquent - Fluent and persuasive
     ```
   - Tap "Start Import" -> Verify 3 cards added.
   - Return to Decks or Home to see the new cards.
3. **Test Undo Import**:
   - In Import screen, tap `📜 History`.
   - Tap "Undo This Import" on the latest import -> Confirm -> Verify notes are removed cleanly.
