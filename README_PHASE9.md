# Phase 9: Backup, Export & Offline Security System

## 1. Overview
Phase 9 delivers enterprise-grade data sovereignty, Anki-compatible multi-format export, atomic full-system backup and restore, and client-side cryptographic security, operating 100% offline with zero external cloud dependencies.

---

## 2. Core Implemented Systems

### 2.1 Multi-Format Exporters (`src/core/exporters/`)
- **Anki Package (`apkgExporter.ts`):**
  - Synthesizes a valid Anki 2.0/2.1 `collection.anki2` SQLite database with `col`, `notes`, `cards`, `revlog`, and `graves` tables.
  - Serializes model configurations, templates, and deck metadata into Anki-compliant JSON.
  - Scans note fields for referenced images (`<img src="...">`) and audio files (`[sound:...]`), bundling actual media binaries under numerical IDs (`0, 1, 2...`) accompanied by the standard `media` mapping file.
  - Zips everything into an `.apkg` archive using `JSZip`, directly openable by Anki Desktop, AnkiDroid, and AnkiMobile.
- **Excel Spreadsheet (`xlsxExporter.ts`):**
  - Generates `.xlsx` workbooks using SheetJS.
  - Creates dedicated sheets per deck or consolidated tables with auto-fitted column widths, RTL support, and full scheduling fields.
- **CSV & TSV Exporter (`csvExporter.ts`):**
  - RFC 4180 escaping for quotes, commas, and line breaks.
  - Prepends UTF-8 Byte Order Mark (`\uFEFF`) ensuring Microsoft Excel on Windows and macOS opens Arabic text seamlessly without garbled encoding.
  - Includes Anki `#separator:Tab` / `#separator:Comma` and `#html:true` header pragmas.
- **Export Coordinator & Native Sharing (`exportManager.ts`):**
  - Unified interface to generate exports into the cache directory and trigger OS-native sharing sheets (`expo-sharing`) for AirDrop, Files, Bluetooth, or local storage.

### 2.2 Complete Offline Backup & Atomic Restore (`src/core/backup/backupService.ts`)
- **Full Backup Packaging:**
  - WAL Checkpoint: executes `PRAGMA wal_checkpoint(TRUNCATE)` before reading the database to ensure all in-memory and write-ahead log transactions are flushed to disk.
  - Packages the entire SQLite database (`flashcards.db`), metadata manifesto (`meta.json`), and all audio/image files from `documentDirectory/media/` into a single `.zip` file.
  - Standardized naming: `backup_YYYY-MM-DD_HH-mm-ss.zip` stored under `documentDirectory/backups/`.
- **Atomic & Safe Restore:**
  - Validates zip structure and presence of `flashcards.db`.
  - Creates a safety checkpoint copy (`flashcards.db.pre_restore_bak`) of the current active database before touching files.
  - Closes active SQLite connection (`closeDatabase()`), replaces database file, unzips all media assets, and runs `PRAGMA integrity_check`.
  - Automatically rolls back to the safety copy in the event of any failure or archive corruption.
- **Rolling Backups:**
  - Retains the 5 most recent automated backups, automatically purging older archives to conserve disk space.
- **Document Picker Import:**
  - Allows picking existing `.zip` backups from the device storage (`expo-document-picker`) and restoring directly.

### 2.3 App Lock & Security System (`src/core/security/`)
- **Pure TypeScript SHA-256 (`sha256.ts`):**
  - Zero native-dependency cryptographic hashing. Tested against standard NIST test vectors.
- **PIN & Salt Security (`appLock.ts`):**
  - 32-character random hex cryptographic salt generated per PIN.
  - Salting and SHA-256 hashing before storing in local SQLite `settings` table. Plaintext PINs are never stored.
- **Brute-Force & Timing Protection:**
  - Failed attempt counter: after 5 consecutive incorrect attempts, triggers a 30-second cooldown timer.
- **Inactivity Timeout & AppState Monitoring:**
  - Configurable timeouts: Immediately, 1 minute, 5 minutes, 15 minutes.
  - Monitors `AppState` background/active transitions to lock automatically upon inactivity.
- **Interactive Chunky 3D Lock Screen (`LockOverlay.tsx`):**
  - Keypad with haptic feedback, PIN dot indicators, and lockout timer countdown.

---

## 3. User Interfaces
1. **Backup Screen (`src/app/settings/backup.tsx`):**
   - One-tap "Create Backup Now" with progress indication.
   - "Import Backup File" from file manager.
   - List of saved backups with creation time, size, and actions (Restore, Share, Delete).
2. **Export Screen (`src/app/settings/export.tsx`):**
   - Deck selector (Specific Deck or All Decks).
   - Format cards: APKG, XLSX, CSV, TSV.
   - Toggles for scheduling progress and media bundling.
3. **Security Screen (`src/app/settings/security.tsx`):**
   - Master App Lock toggle.
   - PIN setup & change modal with confirmation and length validation.
   - Inactivity timeout radio picker.
4. **Settings Navigation Integration (`src/app/(tabs)/settings.tsx` & `src/app/_layout.tsx`):**
   - Seamlessly integrated into Settings tab and root application stack.

---

## 4. Verification & Testing
- Unit tests in `__tests__/backupExportSecurity.test.ts` verify:
  - UTF-8 BOM encoding for Arabic CSV/TSV output.
  - Cell quoting and Anki headers.
  - SheetJS Base64 `.xlsx` generation.
  - SHA-256 standard vectors and salted PIN verification logic.
