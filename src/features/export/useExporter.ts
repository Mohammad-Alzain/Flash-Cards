import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { ExportManager } from '../../core/exporters/exportManager';
import { ExportFormat, ExportProgress, ExportResult } from '../../core/exporters/types';

export type ExportBusy = 'export' | 'save' | 'share' | null;

/** Export configuration + run/save/share actions shared by the export screen and modal. */
export const useExporter = () => {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('apkg');
  const [includeScheduling, setIncludeScheduling] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [busy, setBusy] = useState<ExportBusy>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setProgress(null);
    setBusy(null);
    setResult(null);
    setSaved(false);
    setError(null);
  };

  /** Builds the export file; returns null (and sets `error`) on failure. */
  const runExport = async (deckId?: string): Promise<ExportResult | null> => {
    try {
      setBusy('export');
      setError(null);
      setSaved(false);
      setProgress({ stage: 'inspect', percent: 5, current: 0, total: 100, message: t('export.starting') });
      const res = await ExportManager.export(format, { deckId, includeScheduling, includeMedia, onProgress: setProgress });
      setResult(res);
      return res;
    } catch (e: any) {
      setError(e?.message || t('export.failed'));
      return null;
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const save = async (res: ExportResult) => {
    try {
      setBusy('save');
      setError(null);
      const out = await ExportManager.saveToDevice(res.filePath, res.fileName);
      if (out.success) {
        setSaved(true);
        CustomAlert.alert(t('export.savedSuccessfully'), t('export.fileSavedDesc', { fileName: res.fileName }));
      }
    } catch (e: any) {
      setError(e?.message || t('export.save_failed'));
    } finally {
      setBusy(null);
    }
  };

  const share = async (res: ExportResult) => {
    try {
      setBusy('share');
      setError(null);
      await ExportManager.share(res.filePath);
    } catch (e: any) {
      setError(e?.message || t('export.share_failed'));
    } finally {
      setBusy(null);
    }
  };

  return {
    format,
    setFormat,
    includeScheduling,
    setIncludeScheduling,
    includeMedia,
    setIncludeMedia,
    progress,
    busy,
    result,
    saved,
    error,
    reset,
    runExport,
    save,
    share,
  };
};

export type Exporter = ReturnType<typeof useExporter>;
