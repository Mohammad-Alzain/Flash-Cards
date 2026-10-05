import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import {
  Header,
  Card,
  Button,
  Badge,
  TextField,
  Chip,
  ProgressBar,
} from '../../components/ui';
import { textImporter } from '../../core/importers/textImporter';
import { xlsxImporter } from '../../core/importers/xlsxImporter';
import { apkgImporter } from '../../core/importers/apkgImporter';
import { importManager } from '../../core/importers/importManager';
import {
  ImportPreviewResult,
  ParsedCardCandidate,
  ImportOptions,
  ImportSummary,
  ImportProgress,
} from '../../core/importers/types';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { NoteType } from '../../core/types/models';
import { fileReader } from '../../core/utils/fileReader';
import { ErrorModal } from '../../components/common/ErrorModal';
import { reportError, AppErrorDetails } from '../../core/utils/errorHandler';
import { setImportingState } from '../../core/db/connection';

export default function ImportWizardScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');

  // Decks & Note types for mapping
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [selectedNoteTypeId, setSelectedNoteTypeId] = useState<string>('');

  // Selected file & preview
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [pastedText, setPastedText] = useState('');

  // Cached file memory content to prevent re-reading
  const [fileArrayBuffer, setFileArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [fileTextContent, setFileTextContent] = useState<string | null>(null);
  const [fileBase64Content, setFileBase64Content] = useState<string | null>(null);
  const [parsingFile, setParsingFile] = useState(false);

  // Options
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'new'>('skip');
  const [keepScheduling, setKeepScheduling] = useState(true);
  const [hasHeader, setHasHeader] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({ 0: 'Front', 1: 'Back' });

  // Import Execution & Progress State
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [activeError, setActiveError] = useState<AppErrorDetails | null>(null);
  const stagedFileUriRef = React.useRef<string | null>(null);

  useEffect(() => {
    Promise.all([
      deckRepository.getAllWithCounts(),
      noteRepository.getAllNoteTypes(),
    ]).then(([d, nt]) => {
      setDecks(d);
      setNoteTypes(nt);
      if (d.length > 0) setSelectedDeckId(d[0].id);
      if (nt.length > 0) setSelectedNoteTypeId(nt[0].id);
    });

    return () => {
      if (stagedFileUriRef.current) {
        FileSystem.deleteAsync(stagedFileUriRef.current, { idempotent: true }).catch(() => {});
      }
    };
  }, []);

  const handlePickFile = async () => {
    try {
      // On Android, copyToCacheDirectory: false returns a content:// URI which bypasses Expo Go's forbidden host cache path.
      // On iOS, copyToCacheDirectory: true copies the file directly into the app sandbox.
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: Platform.OS === 'ios',
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setParsingFile(true);
        setSelectedFileName(file.name);
        setImportSummary(null);
        setPreview(null);
        setFileArrayBuffer(null);
        setFileTextContent(null);
        setFileBase64Content(null);

        // Delete any previously staged temporary file
        if (stagedFileUriRef.current && stagedFileUriRef.current !== file.uri) {
          FileSystem.deleteAsync(stagedFileUriRef.current, { idempotent: true }).catch(() => {});
          stagedFileUriRef.current = null;
        }

        // On Native: if URI is content://, stage it to cacheDirectory to ensure full read/seek permissions
        let workingUri = file.uri;
        if (Platform.OS !== 'web' && file.uri.startsWith('content://')) {
          const cleanExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.tmp';
          const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          const target = `${FileSystem.cacheDirectory}staged_import_${Date.now()}_${cleanBase}${cleanExt}`;
          await FileSystem.copyAsync({
            from: file.uri,
            to: target,
          });
          workingUri = target;
          stagedFileUriRef.current = target;
        }

        setSelectedFileUri(workingUri);

        // Detect type & parse preview safely using universal fileReader
        const nameLower = file.name.toLowerCase();
        if (nameLower.endsWith('.csv') || nameLower.endsWith('.txt') || nameLower.endsWith('.tsv')) {
          const content = await fileReader.readAsText(workingUri);
          setFileTextContent(content);
          const prev = textImporter.generatePreview(content, file.name);
          setPreview(prev);
        } else if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
          const base64 = await fileReader.readAsBase64(workingUri);
          setFileBase64Content(base64);
          const prev = xlsxImporter.generatePreview(base64, file.name);
          setPreview(prev);
        } else if (nameLower.endsWith('.apkg') || nameLower.endsWith('.colpkg')) {
          // Pass workingUri directly to prevent OutOfMemory crashes on large archives
          const prev = await apkgImporter.generatePreview(workingUri, file.name);
          setPreview(prev);
        } else {
          CustomAlert.alert(t('common.warning'), t('import_wizard.unsupported_file'));
        }
      }
    } catch (err: any) {
      console.error('[Import Wizard] File Picker Error:', err);
      if (err?.message === 'ANKI_LATEST_REEXPORT_REQUIRED') {
        CustomAlert.alert(
          rtl ? 'تنسيق الحزمة يتطلب خيار التوافق' : 'Anki Format Requires Compatibility Option',
          rtl
            ? 'تم تصدير هذه الرزمة بالتنسيق الجديد لـ Anki دون تفعيل التوافق مع الإصدارات السابقة.\n\nيرجى فتح Anki على الكمبيوتر أو AnkiDroid، وإعادة تصدير الرزمة مع التأكد من تفعيل الخيار:\n"دعم إصدارات Anki القديمة" (Support older Anki versions)\nثم أعد استيراد الملف الناتج.'
            : 'This package was exported with Anki\'s new format without backwards compatibility.\n\nIn Anki / AnkiDroid, please export it again and tick "Support older Anki versions", then re-import the file.'
        );
      } else {
        CustomAlert.alert(t('common.error'), err.message || 'Could not access selected file.');
      }
    } finally {
      setParsingFile(false);
    }
  };

  const handleExecuteImport = async () => {
    const isApkg = selectedFileName.toLowerCase().endsWith('.apkg') ||
                   selectedFileName.toLowerCase().endsWith('.colpkg') ||
                   preview?.sourceType === 'apkg';

    if (!isApkg && activeTab !== 'paste' && (!selectedDeckId || !selectedNoteTypeId)) {
      CustomAlert.alert(t('common.error'), t('import_wizard.select_deck_notetype'));
      return;
    }

    setImporting(true);
    setImportingState(true);
    setImportSummary(null);
    const startTime = Date.now();

    setImportProgress({
      stage: 'inspect',
      percent: 2,
      current: 0,
      total: 100,
      message: rtl ? 'جاري بدء الاستيراد...' : 'Starting import...',
    });

    const handleProgress = (prog: ImportProgress) => {
      let remainingSec: number | undefined = undefined;
      if (prog.percent > 4) {
        const elapsedSec = (Date.now() - startTime) / 1000;
        const totalEstimatedSec = elapsedSec / (prog.percent / 100);
        remainingSec = Math.max(1, Math.round(totalEstimatedSec - elapsedSec));
      }
      setImportProgress({
        ...prog,
        estimatedRemainingSeconds: remainingSec,
      });
    };

    const options: ImportOptions = {
      targetDeckId: selectedDeckId,
      noteTypeId: selectedNoteTypeId,
      duplicateStrategy,
      keepScheduling,
      columnMapping,
      hasHeader,
      onProgress: handleProgress,
    };

    try {
      let candidates: ParsedCardCandidate[] = [];
      let srcType = isApkg ? 'apkg' : (preview?.sourceType || 'txt');

      if (activeTab === 'paste') {
        candidates = textImporter.parsePastedText(pastedText);
        srcType = 'paste';
      } else if (selectedFileUri) {
        if (isApkg) {
          const collection = await apkgImporter.extractFullCollection(selectedFileUri, options);
          candidates = collection.cards;
        } else if (preview?.sourceType === 'csv' || preview?.sourceType === 'txt') {
          const content = fileTextContent || (await fileReader.readAsText(selectedFileUri));
          candidates = textImporter.parseFullContent(content, options);
        } else if (preview?.sourceType === 'xlsx') {
          const base64 = fileBase64Content || (await fileReader.readAsBase64(selectedFileUri));
          candidates = xlsxImporter.parseSheet(base64, preview?.sheets?.[0], options);
        }
      }

      if (candidates.length === 0) {
        CustomAlert.alert(t('common.warning'), t('import_wizard.no_cards_found'));
        setImporting(false);
        setImportProgress(null);
        return;
      }

      const summary = await importManager.executeImport(
        candidates,
        srcType,
        selectedFileName || 'pasted_text.txt',
        options
      );

      setImportSummary(summary);

      if (stagedFileUriRef.current) {
        FileSystem.deleteAsync(stagedFileUriRef.current, { idempotent: true }).catch(() => {});
        stagedFileUriRef.current = null;
      }
    } catch (e: any) {
      console.error('[Import Execution Error]', e);
      if (e?.message === 'ANKI_LATEST_REEXPORT_REQUIRED') {
        CustomAlert.alert(
          rtl ? 'تنسيق الحزمة يتطلب خيار التوافق' : 'Anki Format Requires Compatibility Option',
          rtl
            ? 'تم تصدير هذه الرزمة بالتنسيق الجديد لـ Anki دون تفعيل التوافق مع الإصدارات السابقة.\n\nيرجى فتح Anki على الكمبيوتر أو AnkiDroid، وإعادة تصدير الرزمة مع التأكد من تفعيل الخيار:\n"دعم إصدارات Anki القديمة" (Support older Anki versions)\nثم أعد استيراد الملف الناتج.'
            : 'This package was exported with Anki\'s new format without backwards compatibility.\n\nIn Anki / AnkiDroid, please export it again and tick "Support older Anki versions", then re-import the file.'
        );
      } else {
        const errDetails = reportError('Import Execution', e, t('import_wizard.import_failed'));
        setActiveError(errDetails);
      }
    } finally {
      setImportingState(false);
      setImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        logo
        title={t('import_wizard.title')}
        onBack={() => router.back()}
        rightElement={
          <Button
            title={t('import_wizard.history')}
            icon={<Ionicons name="time-outline" size={18} color={colors.primary} />}
            variant="ghost"
            size="sm"
            onPress={() => router.push('/import/history')}
          />
        }
      />

      {/* Tabs: Select File | Paste Text */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={() => setActiveTab('file')}
          style={[
            styles.tabItem,
            activeTab === 'file' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
        >
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons
              name="document-text-outline"
              size={18}
              color={activeTab === 'file' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={{
                color: activeTab === 'file' ? colors.primary : colors.textSecondary,
                fontWeight: activeTab === 'file' ? 'bold' : 'normal',
              }}
            >
              {t('import_wizard.tab_file')}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('paste')}
          style={[
            styles.tabItem,
            activeTab === 'paste' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
        >
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons
              name="clipboard-outline"
              size={18}
              color={activeTab === 'paste' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={{
                color: activeTab === 'paste' ? colors.primary : colors.textSecondary,
                fontWeight: activeTab === 'paste' ? 'bold' : 'normal',
              }}
            >
              {t('import_wizard.tab_paste')}
            </Text>
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* File Picker Section */}
        {activeTab === 'file' ? (
          <Card style={[styles.sectionCard, { marginBottom: spacing.lg }]}>
            <Button
              title={selectedFileName ? t('import_wizard.file_selected', { name: selectedFileName }) : t('import_wizard.pick_file')}
              icon={<Ionicons name="folder-open-outline" size={20} color={colors.primary} />}
              variant="secondary"
              size="lg"
              loading={parsingFile}
              onPress={handlePickFile}
            />

            {preview && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {t('import_wizard.total_rows', { count: preview.totalRows })}
                </Text>
                {preview.detectedDelimiter && (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Delimiter: {preview.detectedDelimiter}
                  </Text>
                )}
              </View>
            )}
          </Card>
        ) : (
          <Card style={[styles.sectionCard, { marginBottom: spacing.lg }]}>
            <TextField
              label={t('import_wizard.tab_paste')}
              placeholder={t('import_wizard.paste_placeholder')}
              value={pastedText}
              onChangeText={setPastedText}
              multiline
              numberOfLines={6}
            />
          </Card>
        )}

        {preview?.sourceType === 'apkg' ? (
          <Card style={[styles.sectionCard, { marginBottom: spacing.md, backgroundColor: colors.surfaceRaised }]}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons
                name="cube-outline"
                size={22}
                color={colors.primary}
                style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
              />
              <Text style={[styles.labelHeading, { color: colors.text, marginBottom: 0 }]}>
                {t('import_wizard.anki_detected', { defaultValue: 'Anki Package' })}
              </Text>
            </View>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                textAlign: rtl ? 'right' : 'left',
                lineHeight: 18,
              }}
            >
              {t('import_wizard.anki_auto_msg', {
                defaultValue:
                  'Decks, Card Types, Templates, and Audio/Images will be extracted and imported automatically.',
              })}
            </Text>
            {preview.decksFound && preview.decksFound.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    textAlign: rtl ? 'right' : 'left',
                  }}
                >
                  {t('decks.title')}: {preview.decksFound.join(', ')}
                </Text>
              </View>
            )}
          </Card>
        ) : (
          <>
            {/* Target Deck Picker */}
            <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons
                  name="albums-outline"
                  size={18}
                  color={colors.primary}
                  style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
                />
                <Text style={[styles.labelHeading, { color: colors.text, marginBottom: 0 }]}>
                  {t('add_note.deck')}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalChips}
              >
                {decks.map((deck) => (
                  <Chip
                    key={deck.id}
                    label={deck.name}
                    selected={selectedDeckId === deck.id}
                    onPress={() => setSelectedDeckId(deck.id)}
                  />
                ))}
              </ScrollView>
            </Card>

            {/* Note Type Picker */}
            <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.primary}
                  style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
                />
                <Text style={[styles.labelHeading, { color: colors.text, marginBottom: 0 }]}>
                  {t('add_note.card_type')}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalChips}
              >
                {noteTypes.map((nt) => (
                  <Chip
                    key={nt.id}
                    label={nt.name}
                    selected={selectedNoteTypeId === nt.id}
                    onPress={() => setSelectedNoteTypeId(nt.id)}
                  />
                ))}
              </ScrollView>
            </Card>
          </>
        )}

        {/* Duplicate Strategy & Options */}
        <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons
              name="options-outline"
              size={18}
              color={colors.primary}
              style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
            />
            <Text style={[styles.labelHeading, { color: colors.text, marginBottom: 0 }]}>
              {t('import_wizard.duplicate_strategy')}
            </Text>
          </View>

          <View style={[styles.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Chip
              label={t('import_wizard.dup_skip')}
              selected={duplicateStrategy === 'skip'}
              onPress={() => setDuplicateStrategy('skip')}
            />
            <Chip
              label={t('import_wizard.dup_update')}
              selected={duplicateStrategy === 'update'}
              onPress={() => setDuplicateStrategy('update')}
            />
            <Chip
              label={t('import_wizard.dup_new')}
              selected={duplicateStrategy === 'new'}
              onPress={() => setDuplicateStrategy('new')}
            />
          </View>

          {preview?.sourceType === 'apkg' && (
            <View style={[styles.optionSwitchRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 12 }]}>
              <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>
                {t('import_wizard.keep_scheduling')}
              </Text>
              <Switch
                value={keepScheduling}
                onValueChange={setKeepScheduling}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          )}
        </Card>

        {/* Import Progress Card / Start Button */}
        {importing && importProgress ? (
          <Card style={[styles.progressCard, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }} />
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>
                  {rtl ? 'جاري الاستيراد...' : 'Importing...'}
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold' }}>
                {importProgress.percent}%
              </Text>
            </View>

            <ProgressBar
              progress={Math.max(0.02, importProgress.percent / 100)}
              height={10}
              color={colors.primary}
            />

            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 10, textAlign: rtl ? 'right' : 'left' }}>
              {importProgress.message}
            </Text>

            {importProgress.estimatedRemainingSeconds !== undefined && importProgress.percent < 100 && (
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginTop: 8 }}>
                <Ionicons name="timer-outline" size={16} color={colors.textMuted} style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }} />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {rtl
                    ? `الوقت المتبقي المقدر: ~${importProgress.estimatedRemainingSeconds} ثانية`
                    : `Estimated time remaining: ~${importProgress.estimatedRemainingSeconds}s`}
                </Text>
              </View>
            )}

            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, fontStyle: 'italic', textAlign: rtl ? 'right' : 'left' }}>
              {rtl ? 'يرجى عدم إغلاق التطبيق أثناء اكتمال الاستيراد...' : 'Please do not close the app during import...'}
            </Text>
          </Card>
        ) : (
          <Button
            title={t('import_wizard.start_import')}
            variant="primary"
            size="lg"
            disabled={activeTab === 'file' ? !selectedFileUri : !pastedText.trim()}
            onPress={handleExecuteImport}
            style={{ marginVertical: spacing.md }}
          />
        )}

        {/* Import Report Summary */}
        {importSummary && (
          <Card style={[styles.summaryCard, { borderColor: colors.primary }]}>
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.primary}
                style={{ marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
              />
              <Text style={[styles.summaryHeading, { color: colors.primary, marginBottom: 0 }]}>
                {t('import_wizard.summary_title')}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 14, marginVertical: 2 }}>
              {t('import_wizard.added', { count: importSummary.added })}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginVertical: 2 }}>
              {t('import_wizard.updated', { count: importSummary.updated })}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginVertical: 2 }}>
              {t('import_wizard.skipped', { count: importSummary.skipped })}
            </Text>

            <Button
              title={t('import_wizard.view_decks')}
              variant="secondary"
              size="md"
              onPress={() => router.replace('/(tabs)/decks')}
              style={{ marginTop: 12 }}
            />
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ErrorModal
        visible={activeError !== null}
        error={activeError}
        onClose={() => setActiveError(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {},
  sectionCard: {},
  labelHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  horizontalChips: {
    flexDirection: 'row',
  },
  chipsRow: {
    flexWrap: 'wrap',
  },
  optionSwitchRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCard: {
    borderWidth: 2,
    padding: 20,
    marginTop: 12,
  },
  summaryHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressCard: {
    borderWidth: 1.5,
    padding: 18,
    marginVertical: 14,
  },
});
