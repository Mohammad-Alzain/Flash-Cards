import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Card, Row, AppText, Badge, Button, IconTile, EmptyState, IconName } from '../../components/ui';
import { importManager } from '../../core/importers/importManager';
import { useFocusData } from '../../hooks/useFocusData';

const SOURCE_ICON: Record<string, IconName> = {
  apkg: 'cube',
  csv: 'document-text',
  txt: 'reader',
  xlsx: 'grid',
  paste: 'clipboard',
};

export default function ImportHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: history, reload } = useFocusData<any[]>(() => importManager.getHistory(), [], 'import history');

  const undo = (item: any) =>
    CustomAlert.alert(t('import_wizard.undo_button'), t('import_history.undo_msg', { name: item.filename, count: item.notes_added }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (await importManager.undoImport(item.id)) {
            CustomAlert.alert(t('common.done'), t('import_history.undo_done'));
            await reload();
          } else {
            CustomAlert.alert(t('common.error'), t('import_history.undo_failed'));
          }
        },
      },
    ]);

  return (
    <Screen decor header={<Header title={t('import_wizard.history')} subtitle={t('import_history.subtitle')} icon="time" iconTone="teal" onBack={() => router.back()} />}>
      {history.length === 0 ? (
        <EmptyState illustration="import" title={t('import_history.empty_title')} description={t('import_history.empty_desc')} />
      ) : (
        history.map((item) => (
          <Card key={item.id} style={{ marginBottom: 12 }}>
            <Row gap={12}>
              <IconTile icon={SOURCE_ICON[item.source_type] ?? 'document'} tone="teal" size={44} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.filename}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {new Date(item.imported_at).toLocaleString()}
                </AppText>
              </View>
              <Badge size="sm" variant="accent" label={String(item.source_type).toUpperCase()} />
            </Row>
            <Row gap={8} style={{ marginTop: 12 }}>
              <Badge variant="success" icon="add-circle" label={t('import_history.added', { count: item.notes_added })} />
              {item.notes_skipped > 0 && <Badge variant="neutral" label={t('import_history.skipped', { count: item.notes_skipped })} />}
              <View style={{ flex: 1 }} />
              <Button title={t('import_wizard.undo_button')} icon="arrow-undo" variant="dangerSoft" size="sm" onPress={() => undo(item)} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
