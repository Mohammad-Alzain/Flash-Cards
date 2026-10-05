import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Switch,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { CustomAlert } from '../common/CustomDialog';
import { ExportManager } from '../../core/exporters/exportManager';
import { ExportFormat, ExportProgress, ExportResult } from '../../core/exporters/types';
import { isRTL } from '../../i18n';

interface ExportModalProps {
  visible: boolean;
  deckId?: string;
  deckName?: string;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  deckId,
  deckName,
  onClose,
}) => {
  const { colors, typography, spacing } = useTheme();
  const rtl = isRTL();

  const [format, setFormat] = useState<ExportFormat>('apkg');
  const [includeScheduling, setIncludeScheduling] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [savingToDevice, setSavingToDevice] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setExporting(false);
    setSavingToDevice(false);
    setSavedSuccessfully(false);
    setProgress(null);
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    if (exporting || savingToDevice) return; // Prevent closing mid-export or mid-save
    resetState();
    onClose();
  };

  const handleStartExport = async () => {
    try {
      setExporting(true);
      setError(null);
      setSavedSuccessfully(false);
      setProgress({
        stage: 'inspect',
        percent: 5,
        current: 0,
        total: 100,
        message: rtl ? 'بدء عملية التصدير...' : 'Starting export...',
      });

      const res = await ExportManager.export(format, {
        deckId,
        includeScheduling,
        includeMedia,
        onProgress: (p) => setProgress(p),
      });

      setResult(res);
      setExporting(false);
    } catch (err: any) {
      setError(err?.message || (rtl ? 'فشل التصدير' : 'Export failed'));
      setExporting(false);
    }
  };

  const handleSaveToDevice = async () => {
    if (!result) return;
    try {
      setSavingToDevice(true);
      setError(null);
      const saveRes = await ExportManager.saveToDevice(result.filePath, result.fileName);
      if (saveRes.success) {
        setSavedSuccessfully(true);
        CustomAlert.alert(
          rtl ? 'تم الحفظ بنجاح' : 'Saved Successfully',
          rtl
            ? `تم حفظ الملف (${result.fileName}) في جهازك بنجاح.`
            : `File (${result.fileName}) was successfully saved to your device.`
        );
      }
    } catch (err: any) {
      setError(err?.message || (rtl ? 'فشل حفظ الملف في الجهاز' : 'Failed to save file to device'));
    } finally {
      setSavingToDevice(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    try {
      setError(null);
      await ExportManager.share(result.filePath);
    } catch (err: any) {
      setError(err?.message || (rtl ? 'فشل مشاركة الملف' : 'Could not share file'));
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formats: { id: ExportFormat; title: string; subtitle: string; icon: string }[] = [
    {
      id: 'apkg',
      title: 'Anki Package (.apkg)',
      subtitle: rtl ? 'حزمة أنكي الأصلية مع الوسائط وجدول المراجعة' : 'Native Anki collection with media & scheduling',
      icon: 'cube-outline',
    },
    {
      id: 'csv',
      title: 'CSV (.csv)',
      subtitle: rtl ? 'ملف نصي مفصول بفواصل' : 'Comma-separated text table',
      icon: 'document-text-outline',
    },
    {
      id: 'xlsx',
      title: 'Excel (.xlsx)',
      subtitle: rtl ? 'جدول بيانات إكسل منسق' : 'Formatted Microsoft Excel spreadsheet',
      icon: 'grid-outline',
    },
    {
      id: 'tsv',
      title: 'TSV (.txt)',
      subtitle: rtl ? 'نص مفصول بعلامات تبويب' : 'Tab-separated plain text file',
      icon: 'reader-outline',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Card style={[styles.card, { backgroundColor: colors.surfaceRaised }]}>
          {/* Header */}
          <View style={[styles.headerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.title,
                  { color: colors.text, textAlign: rtl ? 'right' : 'left' },
                ]}
              >
                {rtl ? 'تصدير الرزمة' : 'Export Deck'}
              </Text>
              {deckName && (
                <Text
                  style={[
                    styles.subtitle,
                    { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' },
                  ]}
                >
                  {deckName}
                </Text>
              )}
            </View>
            {!exporting && !savingToDevice && (
              <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* If export succeeded: Result View */}
            {result ? (
              <View style={styles.resultContainer}>
                <View style={[styles.successIconCircle, { backgroundColor: `${(colors as any).success || colors.dueCards || '#58CC02'}20` }]}>
                  <Ionicons name="checkmark-circle" size={48} color={(colors as any).success || colors.dueCards || '#58CC02'} />
                </View>
                <Text style={[styles.resultTitle, { color: colors.text }]}>
                  {rtl ? 'تم تجهيز ملف التصدير بنجاح!' : 'Export Completed Successfully!'}
                </Text>
                <Text style={[styles.resultFileName, { color: colors.textSecondary }]}>
                  {result.fileName}
                </Text>

                <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                    <Text style={{ color: colors.textSecondary }}>{rtl ? 'عدد البطاقات:' : 'Total Cards:'}</Text>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{result.cardCount}</Text>
                  </View>
                  <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                    <Text style={{ color: colors.textSecondary }}>{rtl ? 'عدد الملاحظات:' : 'Total Notes:'}</Text>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{result.noteCount}</Text>
                  </View>
                  {result.mediaCount > 0 && (
                    <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                      <Text style={{ color: colors.textSecondary }}>{rtl ? 'ملفات الوسائط والصوتيات:' : 'Media & Audio Files:'}</Text>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{result.mediaCount}</Text>
                    </View>
                  )}
                  <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                    <Text style={{ color: colors.textSecondary }}>{rtl ? 'حجم الملف:' : 'File Size:'}</Text>
                    <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatSize(result.sizeBytes)}</Text>
                  </View>
                </View>

                {savedSuccessfully && (
                  <View style={[styles.savedSuccessBanner, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}>
                    <Ionicons name="checkmark-done-circle-outline" size={20} color={colors.primary} style={{ marginHorizontal: 6 }} />
                    <Text style={[styles.savedSuccessText, { color: colors.primary, textAlign: rtl ? 'right' : 'left' }]}>
                      {rtl ? 'تم حفظ الملف في جهازك بنجاح' : 'File saved to device successfully'}
                    </Text>
                  </View>
                )}

                {error && (
                  <View style={[styles.errorBox, { backgroundColor: `${colors.error}18`, borderColor: colors.error, marginBottom: 16, width: '100%' }]}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.error} style={{ marginHorizontal: 4 }} />
                    <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                  </View>
                )}

                <View style={styles.resultActions}>
                  <Button
                    title={savingToDevice ? (rtl ? 'جارٍ الحفظ في الجهاز...' : 'Saving to Device...') : (rtl ? 'حفظ في الجهاز' : 'Save to Device')}
                    icon={<Ionicons name="download-outline" size={18} color="#FFFFFF" />}
                    variant="primary"
                    size="md"
                    loading={savingToDevice}
                    disabled={savingToDevice}
                    onPress={handleSaveToDevice}
                    style={{ marginBottom: 10 }}
                  />
                  <Button
                    title={rtl ? 'مشاركة الملف' : 'Share File'}
                    icon={<Ionicons name="share-social-outline" size={18} color={colors.text} />}
                    variant="secondary"
                    size="md"
                    disabled={savingToDevice}
                    onPress={handleShare}
                    style={{ marginBottom: 8 }}
                  />
                  <Button
                    title={rtl ? 'إغلاق' : 'Close'}
                    variant="ghost"
                    size="sm"
                    disabled={savingToDevice}
                    onPress={handleClose}
                  />
                </View>
              </View>
            ) : exporting ? (
              /* Live Progress View */
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 16 }} />
                <Text style={[styles.progressStatusText, { color: colors.text }]}>
                  {progress?.message || (rtl ? 'جاري التصدير...' : 'Exporting...')}
                </Text>
                <View style={styles.progressBarWrapper}>
                  <ProgressBar progress={(progress?.percent || 0) / 100} height={10} color={colors.primary} />
                </View>
                <Text style={[styles.progressPercentText, { color: colors.primary }]}>
                  {progress?.percent || 0}%
                </Text>
              </View>
            ) : (
              /* Configuration Options */
              <View>
                {/* Format selection */}
                <Text style={[styles.sectionHeading, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'صيغة التصدير' : 'Export Format'}
                </Text>

                {formats.map((fmt) => {
                  const isSelected = format === fmt.id;
                  return (
                    <Pressable
                      key={fmt.id}
                      onPress={() => setFormat(fmt.id)}
                      style={[
                        styles.formatItem,
                        {
                          backgroundColor: isSelected ? `${colors.primary}12` : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          flexDirection: rtl ? 'row-reverse' : 'row',
                        },
                      ]}
                    >
                      <Ionicons
                        name={fmt.icon as any}
                        size={24}
                        color={isSelected ? colors.primary : colors.textSecondary}
                        style={{ marginHorizontal: 8 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.formatTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                          {fmt.title}
                        </Text>
                        <Text style={[styles.formatSubtitle, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                          {fmt.subtitle}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                    </Pressable>
                  );
                })}

                {/* Toggles */}
                <View style={[styles.toggleContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.toggleRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                      <Text style={[styles.toggleTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                        {rtl ? 'تضمين جدول المراجعة والتكرار' : 'Include Scheduling Info'}
                      </Text>
                      <Text style={[styles.toggleSubtitle, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                        {rtl ? 'حفظ فترات التكرار المتباعد ومواعيد الاستحقاق' : 'Keep intervals, due dates, and repetitions'}
                      </Text>
                    </View>
                    <Switch
                      value={includeScheduling}
                      onValueChange={setIncludeScheduling}
                      trackColor={{ false: colors.border, true: colors.primary }}
                    />
                  </View>

                  {format === 'apkg' && (
                    <>
                      <View style={[styles.toggleDivider, { backgroundColor: colors.border }]} />
                      <View style={[styles.toggleRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                          <Text style={[styles.toggleTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                            {rtl ? 'تضمين الوسائط والصوتيات' : 'Include Media & Audio'}
                          </Text>
                          <Text style={[styles.toggleSubtitle, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
                            {rtl ? 'حزم الصور والتسجيلات الصوتية داخل ملف .apkg' : 'Package images, audio, and videos into the .apkg'}
                          </Text>
                        </View>
                        <Switch
                          value={includeMedia}
                          onValueChange={setIncludeMedia}
                          trackColor={{ false: colors.border, true: colors.primary }}
                        />
                      </View>
                    </>
                  )}
                </View>

                {error && (
                  <View style={[styles.errorBox, { backgroundColor: `${colors.error}18`, borderColor: colors.error }]}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.error} style={{ marginHorizontal: 4 }} />
                    <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={[styles.actionRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <Button
                    title={rtl ? 'إلغاء' : 'Cancel'}
                    variant="ghost"
                    size="md"
                    onPress={handleClose}
                    style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
                  />
                  <Button
                    title={rtl ? 'تصدير الآن' : 'Export Now'}
                    icon={<Ionicons name="download-outline" size={18} color="#FFFFFF" />}
                    variant="primary"
                    size="md"
                    onPress={handleStartExport}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 20,
    padding: 20,
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    maxHeight: 520,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  formatItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  formatTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  formatSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  toggleContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  toggleRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleDivider: {
    height: 1,
    marginVertical: 8,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  actionRow: {
    marginTop: 8,
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  progressStatusText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarWrapper: {
    width: '100%',
    marginBottom: 8,
  },
  progressPercentText: {
    fontSize: 18,
    fontWeight: '800',
  },
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultFileName: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  statsCard: {
    width: '100%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  statRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultActions: {
    width: '100%',
  },
  savedSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
  },
  savedSuccessText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
