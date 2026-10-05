import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/ui/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getDatabase } from '../../core/db/connection';
import { ExportManager } from '../../core/exporters/exportManager';
import { ExportFormat, ExportProgress } from '../../core/exporters/types';
import { ProgressBar } from '../../components/ui/ProgressBar';

import { isRTL } from '../../i18n';

interface DeckOption {
  id: string;
  name: string;
}

export default function ExportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const rtl = isRTL();

  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(params.deckId);
  const [format, setFormat] = useState<ExportFormat>('apkg');
  const [includeScheduling, setIncludeScheduling] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  useEffect(() => {
    async function loadDecks() {
      try {
        const db = await getDatabase();
        const list = await db.getAllAsync<DeckOption>('SELECT id, name FROM decks WHERE archived = 0 ORDER BY name ASC');
        setDecks(list);
      } catch (e) {
        console.warn('Failed to load decks for export:', e);
      }
    }
    loadDecks();
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      setProgress({
        stage: 'inspect',
        percent: 5,
        current: 0,
        total: 100,
        message: 'بدء تجهيز ملف التصدير...',
      });

      const res = await ExportManager.export(format, {
        deckId: selectedDeckId,
        includeScheduling,
        includeMedia,
        onProgress: (p) => setProgress(p),
      });

      // Open native sharing sheet
      await ExportManager.share(res.filePath);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Export failed');
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  const formats: { id: ExportFormat; title: string; subtitle: string; icon: string }[] = [
    {
      id: 'apkg',
      title: 'Anki Package (.apkg)',
      subtitle: t('export.apkgDesc'),
      icon: 'cube-outline',
    },
    {
      id: 'xlsx',
      title: 'Excel Workbook (.xlsx)',
      subtitle: t('export.xlsxDesc'),
      icon: 'grid-outline',
    },
    {
      id: 'csv',
      title: 'Comma-Separated (.csv)',
      subtitle: t('export.csvDesc'),
      icon: 'document-text-outline',
    },
    {
      id: 'tsv',
      title: 'Tab-Separated (.txt)',
      subtitle: t('export.tsvDesc'),
      icon: 'reader-outline',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        logo
        title={t('export.title')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Deck Selection */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {t('export.selectDeck')}
        </Text>
        <Card style={styles.deckSelectorCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.deckChips, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: !selectedDeckId ? theme.colors.primary : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setSelectedDeckId(undefined)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: !selectedDeckId ? '#ffffff' : theme.colors.text, fontWeight: '700' },
                ]}
              >
                {t('export.allDecks')}
              </Text>
            </TouchableOpacity>

            {decks.map(d => {
              const isSelected = selectedDeckId === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => setSelectedDeckId(d.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? '#ffffff' : theme.colors.text, fontWeight: isSelected ? '700' : '500' },
                    ]}
                  >
                    {d.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Card>

        {/* Format Selection */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {t('export.format')}
        </Text>
        <View style={styles.formatsContainer}>
          {formats.map(f => {
            const isSelected = format === f.id;
            return (
              <Card
                key={f.id}
                onPress={() => setFormat(f.id)}
                elevated={!isSelected}
                style={[
                  styles.formatCard,
                  {
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    backgroundColor: isSelected
                      ? (theme.isDark ? theme.colors.surfaceRaised : '#EEF2FF')
                      : theme.colors.surfaceRaised,
                  },
                ]}
              >
                <View style={[styles.formatRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : (theme.isDark ? theme.colors.surface : '#F1F5F9'),
                      },
                    ]}
                  >
                    <Ionicons
                      name={f.icon as any}
                      size={24}
                      color={isSelected ? '#ffffff' : theme.colors.primary}
                    />
                  </View>
                  <View
                    style={{
                      flex: 1,
                      marginHorizontal: 12,
                      alignItems: rtl ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Text
                      style={[
                        styles.formatTitle,
                        {
                          color: isSelected && !theme.isDark ? '#312E81' : theme.colors.text,
                          textAlign: rtl ? 'right' : 'left',
                        },
                      ]}
                    >
                      {f.title}
                    </Text>
                    <Text
                      style={[
                        styles.formatSubtitle,
                        {
                          color: isSelected && !theme.isDark ? '#4338CA' : theme.colors.textMuted,
                          textAlign: rtl ? 'right' : 'left',
                        },
                      ]}
                    >
                      {f.subtitle}
                    </Text>
                  </View>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                  />
                </View>
              </Card>
            );
          })}
        </View>

        {/* Options */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign: rtl ? 'right' : 'left' }]}>
          {t('export.options')}
        </Text>
        <Card style={styles.optionsCard}>
          <View style={[styles.optionRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
              <Text style={[styles.optionLabel, { color: theme.colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                {t('export.includeScheduling')}
              </Text>
              <Text style={[styles.optionDesc, { color: theme.colors.textMuted, textAlign: rtl ? 'right' : 'left' }]}>
                {t('export.includeSchedulingDesc')}
              </Text>
            </View>
            <Switch
              value={includeScheduling}
              onValueChange={setIncludeScheduling}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          {format === 'apkg' && (
            <>
              <View style={[styles.cardDivider, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.optionRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={{ flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
                  <Text style={[styles.optionLabel, { color: theme.colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                    {t('export.includeMedia')}
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.colors.textMuted, textAlign: rtl ? 'right' : 'left' }]}>
                    {t('export.includeMediaDesc')}
                  </Text>
                </View>
                <Switch
                  value={includeMedia}
                  onValueChange={setIncludeMedia}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
            </>
          )}
        </Card>

        {/* Export Button */}
        <Button
          title={exporting ? t('export.generating') : t('export.exportAndShare')}
          variant="primary"
          size="lg"
          style={styles.exportButton}
          onPress={handleExport}
          disabled={exporting}
        />
      </ScrollView>

      {/* Exporting Loading Overlay with Live Progress */}
      {exporting && (
        <View style={styles.overlay}>
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 12 }} />
            <Text style={[styles.overlayText, { color: theme.colors.text }]}>
              {progress?.message || t('export.preparingPackage')}
            </Text>
            <View style={{ width: '100%', marginVertical: 12 }}>
              <ProgressBar progress={(progress?.percent || 0) / 100} height={8} color={theme.colors.primary} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.primary }}>
              {progress?.percent || 0}%
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 14,
  },
  deckSelectorCard: {
    padding: 12,
  },
  deckChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
  },
  formatsContainer: {
    gap: 10,
  },
  formatCard: {
    padding: 14,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formatTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  formatSubtitle: {
    fontSize: 12,
  },
  optionsCard: {
    padding: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
  },
  cardDivider: {
    height: 1,
    marginVertical: 10,
  },
  exportButton: {
    marginTop: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  progressCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  overlayText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
