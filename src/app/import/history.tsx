import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, Badge } from '../../components/ui';
import { importManager } from '../../core/importers/importManager';

export default function ImportHistoryScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    const data = await importManager.getHistory();
    setHistory(data);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleUndo = (item: any) => {
    CustomAlert.alert(
      t('import_wizard.undo_button'),
      rtl
        ? `هل تريد التراجع عن استيراد "${item.filename}"؟ سيتم حذف جميع البطاقات (${item.notes_added}) المضافة في هذا الاستيراد.`
        : `Undo import for "${item.filename}"? All ${item.notes_added} notes imported in this batch will be removed.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const success = await importManager.undoImport(item.id);
            if (success) {
              CustomAlert.alert(t('common.done'), rtl ? 'تم التراجع عن الاستيراد بنجاح.' : 'Import successfully reverted.');
              await loadHistory();
            } else {
              CustomAlert.alert(t('common.error'), rtl ? 'تعذر التراجع عن هذا الاستيراد.' : 'Could not undo this import.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('import_wizard.history')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {history.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
            No past imports found.
          </Text>
        ) : (
          history.map((item) => (
            <Card key={item.id} style={[styles.historyCard, { marginBottom: spacing.md }]}>
              <View style={[styles.row, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <View style={styles.infoCol}>
                  <Text
                    style={[
                      styles.fileName,
                      {
                        color: colors.text,
                        fontSize: typography.sizes.md,
                        fontWeight: typography.weights.bold,
                        textAlign: rtl ? 'right' : 'left',
                      },
                    ]}
                  >
                    {item.filename}
                  </Text>
                  <Text
                    style={[
                      styles.dateText,
                      {
                        color: colors.textSecondary,
                        fontSize: typography.sizes.xs,
                        textAlign: rtl ? 'right' : 'left',
                        marginTop: 2,
                      },
                    ]}
                  >
                    {new Date(item.imported_at).toLocaleString()}
                  </Text>
                </View>

                <Badge count={item.source_type.toUpperCase()} variant="accent" size="sm" />
              </View>

              <View
                style={[
                  styles.detailsRow,
                  {
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    borderTopColor: colors.border,
                    marginTop: spacing.sm,
                    paddingTop: spacing.sm,
                  },
                ]}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: 'bold' }}>
                  +{item.notes_added} added
                </Text>
                {item.notes_skipped > 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    ({item.notes_skipped} skipped)
                  </Text>
                )}

                <Button
                  title={t('import_wizard.undo_button')}
                  variant="danger"
                  size="sm"
                  onPress={() => handleUndo(item)}
                />
              </View>
            </Card>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  historyCard: {},
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  fileName: {},
  dateText: {},
  detailsRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
});
