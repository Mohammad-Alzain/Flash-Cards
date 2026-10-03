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
import { ExportFormat } from '../../core/exporters/types';

interface DeckOption {
  id: string;
  name: string;
}

export default function ExportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();

  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(params.deckId);
  const [format, setFormat] = useState<ExportFormat>('apkg');
  const [includeScheduling, setIncludeScheduling] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [exporting, setExporting] = useState(false);

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
      const res = await ExportManager.export(format, {
        deckId: selectedDeckId,
        includeScheduling,
        includeMedia,
      });

      // Open native sharing sheet
      await ExportManager.share(res.filePath);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Export failed');
    } finally {
      setExporting(false);
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
        title={t('export.title')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Deck Selection */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('export.selectDeck')}
        </Text>
        <Card style={styles.deckSelectorCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckChips}>
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
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('export.format')}
        </Text>
        <View style={styles.formatsContainer}>
          {formats.map(f => {
            const isSelected = format === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFormat(f.id)}
                activeOpacity={0.7}
              >
                <Card
                  style={[
                    styles.formatCard,
                    isSelected && {
                      borderColor: theme.colors.primary,
                      borderWidth: 2,
                      backgroundColor: theme.colors.primary + '08',
                    },
                  ]}
                >
                  <View style={styles.formatRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                        },
                      ]}
                    >
                      <Ionicons
                        name={f.icon as any}
                        size={24}
                        color={isSelected ? '#ffffff' : theme.colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.formatTitle, { color: theme.colors.text }]}>
                        {f.title}
                      </Text>
                      <Text style={[styles.formatSubtitle, { color: theme.colors.textMuted }]}>
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
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Options */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('export.options')}
        </Text>
        <Card style={styles.optionsCard}>
          <View style={styles.optionRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
                {t('export.includeScheduling')}
              </Text>
              <Text style={[styles.optionDesc, { color: theme.colors.textMuted }]}>
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
              <View style={styles.optionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
                    {t('export.includeMedia')}
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.colors.textMuted }]}>
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

      {/* Exporting Loading Overlay */}
      {exporting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.overlayText}>{t('export.preparingPackage')}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
