# Import Guide: Anki `.apkg` / `.colpkg`, Text/CSV, Excel → React Native (Expo) App

> Implementation guide for the AI coding agent. Scope: **import only**. Items marked **⚠️ VERIFY** come from reverse-engineered/secondary sources: validate them against real fixture files (Section 12) before trusting them.

Stack assumed: Expo (dev build) + TypeScript + `expo-sqlite` + `expo-file-system` + `expo-document-picker`.
Extra libs: `react-native-zip-archive` (native unzip), `jszip` (small files only), `fzstd` (zstd, optional), `expo-crypto` (SHA-1), `papaparse` (CSV), `xlsx` (SheetJS).

---

## 1. What an Anki package really is

- `.apkg` / `.colpkg` = a plain **ZIP**, all entries in the **archive root** (no folders).
- `.apkg` = one or more decks. `.colpkg` = a whole collection (Anki replaces its collection on import). **In this app never delete existing data silently**: import the decks as new decks, or ask for confirmation.
- There are **three variants**. Ignoring this is the #1 reason implementations fail:

| | Legacy 1 | Legacy 2 | Latest |
|---|---|---|---|
| Produced by | Anki 2.0 / old shared decks | Anki 2.1 export with **"Support older Anki versions"** ticked | Anki 2.1.50+ default export |
| Real DB file | `collection.anki2` | `collection.anki21` | `collection.anki21b` (**zstd-compressed** SQLite) |
| Other files | — | dummy `collection.anki2` (one fake note: *"Please update to the latest Anki version…"*) + `meta` | dummy `collection.anki2` + `meta` |
| DB schema | v11 | v11 | v18 |
| Config storage | JSON in TEXT columns of `col` | JSON in `col` | Protobuf BLOBs in side tables |
| `media` file | JSON | JSON | Protobuf (media files individually zstd-compressed ⚠️ VERIFY) |
| `meta` | none | protobuf `version = 2` | protobuf `version = 3` |

---

## 2. Format detection (use exactly this order)

```ts
const names = new Set(zipEntryNames());          // root entries
let kind: 'LEGACY_1' | 'LEGACY_2' | 'LATEST', dbEntry: string;
if (names.has('collection.anki21b'))      { kind = 'LATEST';   dbEntry = 'collection.anki21b'; }
else if (names.has('collection.anki21'))  { kind = 'LEGACY_2'; dbEntry = 'collection.anki21'; }
else if (names.has('collection.anki2'))   { kind = 'LEGACY_1'; dbEntry = 'collection.anki2'; }
else throw new ImportError('NOT_AN_ANKI_PACKAGE');
// NEVER read collection.anki2 when anki21 / anki21b exists: it is a dummy with one "please update" note.
```

- `meta` (if present) is a protobuf message with one field, `version` (field 1, varint): `2` = Legacy 2, `3` = Latest. Parse it as a **varint after the tag byte `0x08`**, not as "byte number 1". File names decide; `meta` is only a tie-breaker.
- After opening the DB run `SELECT ver FROM col` → `11` (legacy) or `18` (latest).
- If the DB contains exactly one note starting with "Please update to the latest Anki version" → show the re-export message (Section 7), do not import it.

---

## 3. Import pipeline (chunked, never load everything in memory)

1. **Pick file:** `expo-document-picker` with `copyToCacheDirectory: true`. Show a progress screen with a Cancel button.
2. **Unzip** to `cache/import_<timestamp>/`. For packages larger than ~50 MB use a **native unzip** (`react-native-zip-archive`). Do **not** read a big zip into a base64 string and open it with JSZip (out of memory). JSZip is fine for small files.
3. **Detect** the format (Section 2). Latest → decompress DB first (Section 7). Legacy → use the file as is.
4. **Open the DB:** copy/move it into `FileSystem.documentDirectory + 'SQLite/'` with a temp name (e.g. `import_tmp.db`) and open with `SQLite.openDatabaseAsync('import_tmp.db')` (the function also accepts a `directory` argument; check the current expo-sqlite docs). Use it **read-only**.
5. **Read `col`** (single row): `crt`, `models`, `decks`, `dconf`, `conf` (legacy) or the side tables (latest).
6. **Read `notes`, `cards`, `revlog` in pages** (e.g. `WHERE rowid > ? ORDER BY rowid LIMIT 1000`). Never `SELECT *` into one big array.
7. **Write into the app DB** with one transaction per chunk (500–1000 rows) and prepared statements.
8. **Copy media** (Section 6).
9. **Cleanup** temp DB and temp folder in a `finally` block (also on error/cancel).
10. **Report:** added / updated / skipped / failed counts + error log; save in `import_history`.

---

## 4. Legacy (schema v11) tables: exact meaning and units

```sql
col    (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
notes  (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
cards  (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
revlog (id, cid, usn, ease, ivl, lastIvl, factor, time, type)
graves (usn, oid, type)
```

| Field | Meaning / unit |
|---|---|
| `col.crt` | collection creation, **unix SECONDS** (04:00 local). Base for review-card due days |
| `col.mod`, `col.scm` | **milliseconds** |
| `col.models` | JSON **object** keyed by model id → note types |
| `col.decks` | JSON object keyed by deck id → decks. Children are named `Parent::Child`. Default deck id = `1` |
| `col.dconf` | JSON object of deck option presets |
| `notes.id`, `cards.id`, `revlog.id` | creation time in **ms**, used as ids |
| `notes.mod`, `cards.mod` | last modified, **seconds** |
| `notes.mid` | note type (model) id |
| `notes.guid` | globally unique id → **use it for de-duplication, and store it** |
| `notes.tags` | space-separated, stored as `" a b "` → trim, split on whitespace |
| `notes.flds` | all fields joined by **`\x1f` (U+001F)**, in the model's field order |
| `notes.sfld` | sort field, HTML-stripped |
| `notes.csum` | integer from the first 8 hex digits of SHA-1 of the HTML-stripped first field |
| `cards.nid / did / ord` | note / deck / template index. **Cloze:** `ord = clozeNumber − 1` |
| `cards.type` | 0 new, 1 learning, 2 review, 3 relearning |
| `cards.queue` | 0 new, 1 learning, 2 review, 3 day-learning, 4 preview, **−1 suspended, −2 buried (scheduler), −3 buried (user)** |
| `cards.due` | **depends on queue:** new → position; learning (queue 1) → **unix seconds**; review/day-learn (queue 2/3) → **days since `col.crt`** |
| `cards.ivl` | interval in days; **negative = seconds** (intraday learning) |
| `cards.factor` | ease × 10 (2500 = 250 %); 0 for new cards |
| `cards.odue / odid` | original due / original deck for cards sitting in a **filtered deck** |
| `cards.flags` | colour flag in the low 3 bits (`flags & 7`): 1 red, 2 orange, 3 green, 4 blue, 5 pink, 6 turquoise, 7 purple |
| `revlog.ease` | 1 again, 2 hard, 3 good, 4 easy |
| `revlog.time` | ms |
| `revlog.type` | 0 learn, 1 review, 2 relearn, 3 filtered/cram, 4 manual, 5 rescheduled |

Note-type JSON (`models[mid]`): `name`, `type` (0 normal, 1 cloze), `sortf`, `css`, `flds[] {name, ord, rtl, font, size, sticky, …}`, `tmpls[] {name, ord, qfmt, afmt, bqfmt, bafmt, did}`.

---

## 5. Mapping rules

**Fields**
- `flds.split('\u001f')` and map to the note type's fields by `ord`. Field content is **HTML**: keep it as HTML (don't strip, don't escape).
- Identify fields/templates by **`ord`**, never by their JSON `id`. Those ids can exceed JS safe integers (~19 digits) and silently lose precision in `JSON.parse`. Note/card/deck/model ids are 13-digit ms timestamps and are safe.

**Cards**
- **Do not regenerate cards.** Import the rows of `cards` exactly as they are (this keeps cloze, optional-reverse cards and scheduling correct). Generate new cards only when the user later edits notes/templates inside the app.
- **Filtered decks:** if `odid != 0`, the card belongs to deck `odid` and its real due is `odue`. Flatten it into the original deck.

**Decks / tags**
- Split deck names on `::` to build the tree; create parents first. Skip the empty "Default" deck unless it has cards.
- Keep tag hierarchy (`::`). The tags `marked` and `leech` are meaningful.

**State conversion** (option "Keep original progress"):

| Anki | App |
|---|---|
| `queue = 0` | New; keep order by `due` |
| `queue = 1` | Learning; `due_ms = due × 1000` |
| `queue = 3` | Day-learning; `due_ms = (crt + due × 86400) × 1000` |
| `queue = 2` | Review; `due_ms = (crt + due × 86400) × 1000` (align to the app's rollover hour); `interval = ivl`; `ease = factor / 10 %` |
| `queue = −1` | Suspended |
| `queue = −2 / −3` | Import as not buried (or buried until tomorrow) |

Option "Reset progress": all cards become New, keeping relative order, `reps = lapses = 0`.

**FSRS data ⚠️ VERIFY:** collections that used FSRS may store per-card memory state as JSON in `cards.data` (keys such as `s` = stability, `d` = difficulty). If present, read it. If absent and the app uses FSRS, either initialise from SM-2 (`stability ≈ ivl`, difficulty from ease) or replay `revlog` through `ts-fsrs`. State which one you implemented.

**Review history** (toggle "Import review history"): `revlog` → `review_logs`; ignore types 4 and 5 in accuracy statistics.

**Unit helpers (write + unit-test them):** `secToMs`, `msToSec`, `dayNumberToMs(crtSec, dueDays)`. Mixing seconds and milliseconds causes the classic "all cards due in 1970 / year 57000" bug.

```ts
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
  /* + decode other entities */.trim();
// csum (for duplicate checks): parseInt(sha1Hex(stripHtml(firstField)).slice(0, 8), 16)
const dayNumberToMs = (crtSec: number, dueDays: number) => (crtSec + dueDays * 86400) * 1000;
```

---

## 6. Media (images, audio, fonts)

**Legacy:** `media` is a UTF-8 JSON object `{"0": "photo.jpg", "1": "word.mp3"}`. The ZIP entry named `"0"` is the real file for `photo.jpg`. Copy each to `documentDirectory/media/<original name>`. The `media` file is always present (`{}` if empty). Entries that are listed but missing in the ZIP: skip and report, not fatal.

**Latest ⚠️ VERIFY:** `media` is a **protobuf** `MediaEntries { repeated MediaEntry entries = 1 }` with `MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; optional uint32 legacy_zip_filename = 255 }`. The ZIP entry name is the **index** in the list (or `legacy_zip_filename` if set). The `media` file and each media file may be **zstd-compressed**: detect the zstd magic bytes `28 B5 2F FD`, decompress only if present, otherwise treat as raw.

**Filenames**
- Normalise to Unicode **NFC**. References inside HTML may be percent-encoded (`src="my%20pic.png"`) or contain HTML entities → match on the decoded, NFC-normalised name.
- **Zip-slip protection:** reject names containing `/`, `\` or `..`.

**References to detect** (needed for missing/unused-media tools): `<img src="…">` (double, single or no quotes), `[sound:file.mp3]`, `<audio src>`, `<source src>`, `<video src>`, and `url(...)` / `@font-face` in the note type CSS. Files starting with `_` are intentionally kept even if unused (e.g. `_myfont.ttf`).

**Rendering:** do **not** rewrite filenames in fields. Keep references as they are and let the card WebView resolve them against the media folder (set the WebView base URL to the media directory).

**Collisions:** same name + different SHA-1 → store as `name_<hash8>.ext` and rewrite references only inside the notes being imported.

Copy files with the file-system API. Never base64 whole media files in JS memory.

---

## 7. Latest format (`collection.anki21b`)

**Priority order:** (1) Legacy 1/2 fully working and tested → (2) **mandatory friendly fallback** for Latest → (3) real Latest support (optional, do last).

**Mandatory fallback message** (Arabic + English), shown whenever Latest can't be read:
> *"This package was exported with Anki's new format. In Anki / AnkiDroid export it again and tick **'Support older Anki versions'**."*
> with a "How?" help screen. (This is the standard advice from the Anki community, and several open-source readers do exactly this.)

**Real support (phase "4b"):**
1. Decompress `collection.anki21b` (a single zstd frame) with **`fzstd`** (pure JS, ~8 kB, works in Hermes) or a native binding such as `react-native-zstd` if it proves reliable. For very large DBs use fzstd's streaming `Decompress` and write chunks to a file.
2. Open the result as SQLite **schema v18**. Tables: `col`, `notetypes`, `fields`, `templates`, `decks`, `deck_config`, `config`, `tags`, `notes`, `cards`, `revlog`, `graves`. In v18 the `col.models/decks/dconf/conf` columns are **empty**; read the side tables instead. `notes`, `cards`, `revlog` keep the v11 columns, so the same mapping code applies.
3. Configs are **protobuf BLOBs**. Write a tiny reader (varint + length-delimited) that extracts only what you need. **⚠️ VERIFY these field numbers against a real file:**
   - `templates.config`: `q_format = 1`, `a_format = 2`, `q_format_browser = 3`, `a_format_browser = 4`, `target_deck_id = 5`
   - `notetypes.config`: `kind = 1` (0 normal, 1 cloze), `sort_field_idx = 2`, `css = 3`
   - `fields.config`: `sticky = 1`, `rtl = 2`, `font_name = 3`, `font_size = 4`, `description = 5`
   - `decks.name`: the hierarchy separator may be **U+001F** instead of `::` → replace with `::`. The `decks.kind` blob distinguishes normal vs filtered decks.
4. If any step fails → show the fallback message. Never crash.

---

## 8. Duplicates, updates, ordering

- **Import order:** note types → decks (parents first) → notes → cards → revlog → media.
- Match existing notes by `guid`. Options: **Skip**, **Update if incoming is newer (`mod`)**, **Import as new**.
- Match note types by **name + identical field list**. Same name but different fields → create `"<name> (imported)"`.
- Store Anki identifiers in the app DB for a lossless future export: `note_types.anki_id`, `decks.anki_id`, `notes.guid`, `cards.anki_card_id`.
- Provide **"Undo import"** using the `import_history` id.

---

## 9. Text / CSV import (`.txt`, `.tsv`, `.csv`)

- Detect **encoding** (UTF-8, UTF-8 BOM, UTF-16) and **delimiter** (tab, comma, semicolon, pipe) with manual override. Use `papaparse` (handles quotes and embedded newlines).
- **Anki header lines** (Anki 2.1.54+): lines at the top starting with `#`, each **alone on its line** (spreadsheet exports that add trailing commas/tabs, e.g. `#separator:Comma,,,,`, are *not* recognised):
  - `#separator:tab|comma|semicolon|pipe|space|colon`
  - `#html:true|false`
  - `#tags:<tags added to every note>`
  - `#deck:<name>`, `#notetype:<name>`
  - `#guid column:N`, `#notetype column:N`, `#deck column:N`, `#tags column:N` (**N is 1-based**)
- Without headers, Anki guesses the separator and uses the **first field as the uniqueness key**: do the same for duplicate detection.
- `#html:false` → escape `<`, `>`, `&` and convert line breaks to `<br>`. `#html:true` → keep as is.
- **Column mapping UI:** each column → Front / Back / Extra field / Tags / Deck / Ignore; "first row is header" toggle; live preview of the resulting card; choose target deck + note type.
- Also support **Quizlet-style paste** (`term<TAB>definition` per line, or `term - definition`).

## 10. Excel import (`.xlsx`, `.xls`)

- Read with SheetJS. Let the user choose the **sheet** (or "one deck per sheet").
- Same mapping UI as text import; support many columns (word / meaning / example / pronunciation / part of speech …).
- Handle merged cells, empty rows, numeric cells (convert to strings), dates.

---

## 11. Mistakes that make agents fail (avoid all)

1. Reading `collection.anki2` when `anki21` / `anki21b` exists → imports one fake "please update" card.
2. Not handling `anki21b` (zstd) → crash. At minimum show the re-export message.
3. Splitting `flds` by tab/comma instead of `\x1f`.
4. Mixing **seconds and milliseconds**; treating review `due` as a timestamp (it is *days since `col.crt`*) or learning `due` as days (it is *seconds*).
5. Treating `ivl < 0` as days (negative = seconds) and `factor` as a percentage (it is ×10).
6. Regenerating cards instead of importing the `cards` rows (breaks cloze, optional-reverse and scheduling).
7. Using template/field JSON `id` instead of `ord` (precision loss).
8. Ignoring `odid/odue` (cards of filtered decks land in the wrong deck / wrong due).
9. Media: reversing the map direction, assuming every listed file exists, not decoding `%20`/entities, no NFC normalisation, no zip-slip check, base64-ing huge files.
10. Loading whole tables or the whole zip into memory (OOM) instead of paging / native unzip.
11. Not cleaning temp files; running import on the UI thread; no progress/cancel.
12. Dropping `guid` → re-importing creates duplicates.

---

## 12. Fixtures and tests (required)

**Ask the user for real sample files** (small, 10–50 cards each), put them in `__fixtures__/`:
- **(a)** exported *with* "Support older Anki versions" (Legacy 2)
- **(b)** exported *without* it (Latest)
- **(c)** a deck with images + audio + cloze + nested decks + scheduling
- **(d)** an old shared deck from AnkiWeb (Legacy 1)
- **(e)** an Anki-exported `.txt`, and an `.xlsx`

**Unit tests:** format detection (all three + the dummy-note case), `flds` split, `csum`/`sfld`, unit conversions, state-mapping table, media map parsing (legacy + latest), NFC / percent-decoding, zip-slip rejection, cloze `ord` handling, filtered-deck flattening, text headers parsing.

**Integration tests:** import each fixture → assert expected deck/note/card/media counts, field content, tags, due dates (not 1970), and that the fake "Please update" note is never imported.

**Acceptance:**
- [ ] A real AnkiDroid-exported `.apkg` (with images/audio, nested decks, cloze) imports with correct counts, fields, tags, media and (optionally) scheduling.
- [ ] Re-importing the same file creates no duplicates with "Skip duplicates".
- [ ] A Latest-format file shows the friendly re-export message (or imports, if phase 4b is done).
- [ ] Corrupt / non-Anki files give a clear message, never a crash.
- [ ] 10,000-card import finishes in reasonable time with a responsive UI and a working Cancel.

---

## 13. Sources

- Eiko Wagenknecht, *Understanding the Anki APKG Format* (overview + Legacy 2): https://eikowagenknecht.com/posts/understanding-the-anki-apkg-format/ and https://eikowagenknecht.com/posts/understanding-the-anki-apkg-format-legacy-2/
- Anki manual, Exporting / Text files: https://docs.ankiweb.net/exporting.html , https://docs.ankiweb.net/importing/text-files.html
- AnkiDroid wiki, Database structure: https://github.com/ankidroid/Anki-Android/wiki/Database-Structure
- Anki source (schema, package meta, protobuf): https://github.com/ankitects/anki (`rslib/src/storage/schema11.sql`, `rslib/src/import_export/package/meta.rs`, `proto/anki/import_export.proto`)
- `react-native-anki-reader` (Legacy only, documents the `anki21b` limitation): https://github.com/nodescraper/react-native-anki-reader
- `fzstd`: https://github.com/101arrowz/fzstd ; `react-native-zstd`: https://www.npmjs.com/package/react-native-zstd
- Expo SQLite docs: https://docs.expo.dev/versions/latest/sdk/sqlite/