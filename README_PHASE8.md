# Phase 8: Card Browser, Advanced Search & Maintenance Tools

## 1. Overview
Phase 8 delivers a comprehensive, desktop-class Card Browser and Database Maintenance toolkit matching and surpassing AnkiDroid's capabilities, tailored for mobile with full RTL/LTR support, chunky 3D aesthetics, and high performance on tens of thousands of cards.

---

## 2. Implemented Components & Modules

### 2.1 Anki-Compatible Search Engine (`src/core/search/searchParser.ts`)
A complete Lexer & AST-to-SQL compiler supporting Anki's standard search query syntax:
- **Deck filtering:** `deck:"Medical School"` or `deck:Biology` (including child deck wildcards `deck:Lang*`).
- **Tag filtering:** `tag:important`, `tag:none`, `-tag:easy`.
- **Card States:** `is:new`, `is:learn`, `is:review`, `is:suspended`, `is:buried`, `is:due`.
- **Card Flags:** `flag:0` (none) through `flag:7` (colors: red, orange, green, blue, pink, turquoise, purple).
- **Interval & Repetition criteria:** `prop:ivl>=21`, `prop:reps<3`, `prop:lapses>0`, `prop:ease<2.5`.
- **Note Type filtering:** `note:"Basic"`, `note:Cloze`.
- **Field-specific search:** `Front:mitochondria`, `Arabic:سلام`.
- **Boolean Operators & Negation:**
  - Implicit `AND`
  - Explicit `OR` grouping
  - Negation with `-` (e.g. `-tag:marked`, `-is:suspended`)
  - Quoted phrases with spaces: `"heart disease"`
- **Parameterized SQL Generation:** Compiles queries directly into safe, SQL-injection-proof parameterized `WHERE` clauses with prepared statement bindings.

### 2.2 Browser Repository (`src/core/db/repositories/browserRepository.ts`)
Optimized SQLite queries providing:
- **Card Search (`searchCards`):** Paginated search over cards, notes, decks, and templates with joined metadata and field values.
- **Bulk Operations:**
  - `bulkChangeDeck`: Move hundreds of cards to another deck in one transaction.
  - `bulkSetSuspended`: Suspend / Unsuspend selected cards.
  - `bulkResetProgress`: Reset learning progress back to New state (0 interval, 0 reps).
  - `bulkDeleteCards`: Safely delete cards and orphan notes with foreign key integrity.
  - `bulkAddTag` & `bulkRemoveTag`: Multi-card batch tag assignment and removal.
  - `bulkSetFlag`: Set colored flag (0-7) across selected items.
- **Maintenance & Integrity Utilities:**
  - `findEmptyCards`: Identify cards with blank front fields or unrendered cloze deletions.
  - `findDuplicates`: Find notes sharing duplicate field values (e.g., duplicate vocabulary words).
  - `findAndReplace`: Global or field-scoped regex/text find and replace across all notes.
  - `getMediaUsageStats`: Identify referenced media files vs missing files.
  - `checkDatabaseIntegrity`: Run `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
  - `vacuumDatabase`: Rebuild the database file and free unused space with `VACUUM`.
- **Tag Management:**
  - `getAllTagsWithCounts`: Inspect all tags across the collection with real-time card counts.
  - `renameTag`: Rename a tag everywhere across all notes.
  - `deleteTag`: Remove a tag from all notes.

### 2.3 User Interface
1. **Card Browser (`src/app/browser/index.tsx`):**
   - Instant search bar with search syntax helper hints.
   - Quick Filter Chips: "All", "Due", "New", "Learning", "Suspended", "Flagged".
   - Selection Mode with counter banner: select individual, select all, or clear.
   - Multi-action bottom action bar: Move Deck, Change Tag, Flag, Suspend, Reset, Delete.
   - Rich card row with deck name, tag badges, state badge, flag indicator, and interval info.
2. **Maintenance Tools Hub (`src/app/tools/index.tsx`):**
   - One-tap Database Health Check (integrity + foreign key verification).
   - Find Duplicates modal with duplicate group inspection.
   - Empty Cards scanner with batch purge.
   - Global Find & Replace with case sensitivity and dry-run preview.
   - Media integrity inspection.
   - SQLite Database Vacuum & Optimization.
3. **Tags Manager (`src/app/tools/tags.tsx`):**
   - Alphabetical tag list with card count indicators.
   - Inline tag renaming dialog with automatic note updates.
   - Single and batch tag deletion.
   - Tap tag to jump directly into the Card Browser pre-filtered for that tag.

---

## 3. Verification & Tests
- Full unit test coverage in `__tests__/searchParser.test.ts` verifying:
  - Text search terms and phrase quoting.
  - State filters (`is:due`, `is:suspended`, `is:new`).
  - Flag filters (`flag:1`).
  - Deck and Tag filters with negation (`-tag:leech`).
  - Property operators (`prop:ivl>=10`, `prop:reps>5`).
  - Combined compound queries with boolean precedence.
