import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { textImporter } from '../../core/importers/textImporter';
import { xlsxImporter } from '../../core/importers/xlsxImporter';
import { apkgImporter } from '../../core/importers/apkgImporter';
import { importManager } from '../../core/importers/importManager';
import { ImportPreviewResult, ParsedCardCandidate, ImportOptions, ImportSummary, ImportProgress, ImportSourceType } from '../../core/importers/types';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { NoteType } from '../../core/types/models';
import { fileReader } from '../../core/utils/fileReader';
import { reportError, AppErrorDetails } from '../../core/utils/errorHandler';
import { setImportingState } from '../../core/db/connection';

export type ImportTab = 'file' | 'paste';
export type DuplicateStrategy = 'skip' | 'update' | 'new';

const ANKI_REEXPORT_ERROR = 'ANKI_LATEST_REEXPORT_REQUIRED';
/** Below this percentage the ETA is too noisy to show. */
const ETA_MIN_PERCENT = 4;

const isApkgName = (name: string) => /\.(apkg|colpkg)$/i.test(name);

/** Import wizard state machine: pick/paste → preview → configure → import → summary. */
export const useImportWizard = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ImportTab>('file');
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [deckId, setDeckId] = useState('');
  const [noteTypeId, setNoteTypeId] = useState('');

  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [pastedText, setPastedText] = useState('');
  // Cached file contents so the import doesn't re-read the file.
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [keepScheduling, setKeepScheduling] = useState(true);
  const [hasHeader] = useState(false);
  const [columnMapping] = useState<Record<number, string>>({ 0: 'Front', 1: 'Back' });

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<AppErrorDetails | null>(null);
  const stagedFileRef = useRef<string | null>(null);

  const deleteStaged = () => {
    if (stagedFileRef.current) {
      FileSystem.deleteAsync(stagedFileRef.current, { idempotent: true }).catch(() => {});
      stagedFileRef.current = null;
    }
  };

  useEffect(() => {
    Promise.all([deckRepository.getAllWithCounts(), noteRepository.getAllNoteTypes()]).then(([d, nt]) => {
      setDecks(d);
      setNoteTypes(nt);
      if (d.length > 0) setDeckId(d[0].id);
      if (nt.length > 0) setNoteTypeId(nt[0].id);
    });
    return deleteStaged;
  }, []);

  const showCompatError = () => CustomAlert.alert(t('import_wizard.compat_title'), t('import_wizard.compat_msg'));

  const pickFile = async () => {
    try {
      // Android: content:// URIs avoid Expo Go's forbidden cache path; iOS copies into the sandbox.
      const res = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: Platform.OS === 'ios' });
      if (res.canceled || !res.assets?.length) return;
      const file = res.assets[0];
      setParsing(true);
      setFileName(file.name);
      setSummary(null);
      setPreview(null);
      setFileText(null);
      setFileBase64(null);

      if (stagedFileRef.current && stagedFileRef.current !== file.uri) deleteStaged();

      // Stage content:// files in the cache directory for full read/seek access.
      let workingUri = file.uri;
      if (Platform.OS !== 'web' && file.uri.startsWith('content://')) {
        const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.tmp';
        const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const target = `${FileSystem.cacheDirectory}staged_import_${Date.now()}_${base}${ext}`;
        await FileSystem.copyAsync({ from: file.uri, to: target });
        workingUri = target;
        stagedFileRef.current = target;
      }
      setFileUri(workingUri);

      const lower = file.name.toLowerCase();
      if (/\.(csv|txt|tsv)$/.test(lower)) {
        const content = await fileReader.readAsText(workingUri);
        setFileText(content);
        setPreview(textImporter.generatePreview(content, file.name));
      } else if (/\.(xlsx|xls)$/.test(lower)) {
        const base64 = await fileReader.readAsBase64(workingUri);
        setFileBase64(base64);
        setPreview(xlsxImporter.generatePreview(base64, file.name));
      } else if (isApkgName(lower)) {
        // Pass the URI (not bytes) so large archives don't run out of memory.
        setPreview(await apkgImporter.generatePreview(workingUri, file.name));
      } else {
        CustomAlert.alert(t('common.warning'), t('import_wizard.unsupported_file'));
      }
    } catch (err: any) {
      console.error('[Import Wizard] File Picker Error:', err);
      if (err?.message === ANKI_REEXPORT_ERROR) showCompatError();
      else CustomAlert.alert(t('common.error'), err.message || t('import_wizard.pick_failed'));
    } finally {
      setParsing(false);
    }
  };

  const isApkg = isApkgName(fileName) || preview?.sourceType === 'apkg';
  const canStart = tab === 'file' ? !!fileUri : !!pastedText.trim();

  const runImport = async () => {
    if (!isApkg && tab !== 'paste' && (!deckId || !noteTypeId)) {
      CustomAlert.alert(t('common.error'), t('import_wizard.select_deck_notetype'));
      return;
    }
    setImporting(true);
    setImportingState(true);
    setSummary(null);
    const startTime = Date.now();
    setProgress({ stage: 'inspect', percent: 2, current: 0, total: 100, message: t('import_wizard.starting') });

    const onProgress = (p: ImportProgress) => {
      let remaining: number | undefined;
      if (p.percent > ETA_MIN_PERCENT) {
        const elapsed = (Date.now() - startTime) / 1000;
        remaining = Math.max(1, Math.round(elapsed / (p.percent / 100) - elapsed));
      }
      setProgress({ ...p, estimatedRemainingSeconds: remaining });
    };

    const options: ImportOptions = {
      targetDeckId: deckId,
      noteTypeId,
      duplicateStrategy,
      keepScheduling,
      columnMapping,
      hasHeader,
      onProgress,
    };

    try {
      let candidates: ParsedCardCandidate[] = [];
      let srcType: ImportSourceType = isApkg ? 'apkg' : preview?.sourceType || 'txt';
      if (tab === 'paste') {
        candidates = textImporter.parsePastedText(pastedText);
        srcType = 'paste';
      } else if (fileUri) {
        if (isApkg) {
          candidates = (await apkgImporter.extractFullCollection(fileUri, options)).cards;
        } else if (preview?.sourceType === 'csv' || preview?.sourceType === 'txt') {
          candidates = textImporter.parseFullContent(fileText || (await fileReader.readAsText(fileUri)), options);
        } else if (preview?.sourceType === 'xlsx') {
          candidates = xlsxImporter.parseSheet(fileBase64 || (await fileReader.readAsBase64(fileUri)), preview?.sheets?.[0], options);
        }
      }

      if (candidates.length === 0) {
        CustomAlert.alert(t('common.warning'), t('import_wizard.no_cards_found'));
        return;
      }

      setSummary(await importManager.executeImport(candidates, srcType, fileName || 'pasted_text.txt', options));
      deleteStaged();
    } catch (e: any) {
      console.error('[Import Execution Error]', e);
      if (e?.message === ANKI_REEXPORT_ERROR) showCompatError();
      else setError(reportError('Import Execution', e, t('import_wizard.import_failed')));
    } finally {
      setImportingState(false);
      setImporting(false);
      setProgress(null);
    }
  };

  return {
    tab,
    setTab,
    decks,
    noteTypes,
    deckId,
    setDeckId,
    noteTypeId,
    setNoteTypeId,
    fileName,
    preview,
    pastedText,
    setPastedText,
    parsing,
    pickFile,
    isApkg,
    canStart,
    duplicateStrategy,
    setDuplicateStrategy,
    keepScheduling,
    setKeepScheduling,
    importing,
    progress,
    summary,
    runImport,
    error,
    clearError: () => setError(null),
  };
};
