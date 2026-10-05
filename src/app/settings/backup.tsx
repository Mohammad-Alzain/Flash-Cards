import React, { useState } from 'react';
import { View, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Card, Row, AppText, Button, IconTile, SectionHeader, Badge, EmptyState } from '../../components/ui';
import { Illustration } from '../../components/illustrations';
import { BackupService, BackupInfo, BackupProgress } from '../../core/backup/backupService';
import { BackupProgressModal } from '../../components/backup/BackupProgressModal';
import { useFocusData } from '../../hooks/useFocusData';
import { formatBytes, formatDateTime } from '../../core/utils/format';

/** Short pause so the user sees the completed progress ring. */
const COMPLETION_PAUSE_MS = 850;

export default function BackupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [restoring, setRestoring] = useState(false);

  const { data: backups, loading, reload } = useFocusData<BackupInfo[]>(
    async () => {
      try {
        return await BackupService.listBackups();
      } catch (e: any) {
        CustomAlert.alert(t('common.error'), e.message || t('backup.list_failed'));
        return [];
      }
    },
    [],
    'backups'
  );

  const create = async () => {
    try {
      setCreating(true);
      setProgress({ percent: 0, stage: 'preparing', message: t('backup.preparing') });
      await BackupService.createBackup(setProgress);
      await new Promise((r) => setTimeout(r, COMPLETION_PAUSE_MS));
      await reload();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || t('backup.create_failed'));
    } finally {
      setCreating(false);
      setProgress(null);
    }
  };

  const importFile = async () => {
    try {
      if (await BackupService.importBackupFromDocumentPicker()) {
        CustomAlert.alert(t('common.success'), t('backup.importSuccess'));
        await reload();
      }
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || t('backup.import_failed'));
    }
  };

  const restore = (b: BackupInfo) =>
    CustomAlert.alert(t('backup.restoreConfirmTitle'), t('backup.restoreConfirmDesc', { name: b.fileName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.restore'),
        style: 'destructive',
        onPress: async () => {
          try {
            setRestoring(true);
            const result = await BackupService.restoreBackup(b.filePath);
            CustomAlert.alert(
              t('common.success'),
              t('backup.restoreSuccessDesc', { cards: result.cardCount || 0, decks: result.deckCount || 0 }),
              [{ text: t('common.ok'), onPress: () => router.replace('/(tabs)/decks') }]
            );
          } catch (err: any) {
            CustomAlert.alert(t('common.error'), err.message || t('backup.restore_failed'));
          } finally {
            setRestoring(false);
          }
        },
      },
    ]);

  const remove = (b: BackupInfo) =>
    CustomAlert.alert(t('backup.deleteConfirmTitle'), t('backup.deleteConfirmDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await BackupService.deleteBackup(b.fileName);
            await reload();
          } catch (e: any) {
            CustomAlert.alert(t('common.error'), e.message || t('backup.delete_failed'));
          }
        },
      },
    ]);

  const share = async (b: BackupInfo) => {
    try {
      await BackupService.shareBackup(b.fileName);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || t('backup.share_failed'));
    }
  };

  const busy = creating || restoring;

  return (
    <Screen
      decor
      header={<Header title={t('backup.title')} subtitle={t('backup.subtitle')} icon="cloud-upload" iconTone="blue" onBack={() => router.back()} />}
      overlay={
        <>
          <BackupProgressModal visible={creating} progress={progress} />
          <Modal visible={restoring} transparent animationType="fade" statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: 'rgba(8,10,25,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Card style={{ alignItems: 'center', width: '100%' }}>
                <Illustration name="backup" size={170} />
                <ActivityIndicator color={colors.primary} />
                <AppText variant="title" align="center" style={{ marginTop: 10 }}>
                  {t('backup.restoringMessage')}
                </AppText>
              </Card>
            </View>
          </Modal>
        </>
      }
    >
      <Card variant="tinted" tone="blue" style={{ marginBottom: 14 }}>
        <Row gap={10}>
          <Illustration name="backup" size={110} backdrop={false} />
          <View style={{ flex: 1 }}>
            <AppText variant="title" weight="extrabold">
              {t('backup.infoTitle')}
            </AppText>
            <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              {t('backup.infoDesc')}
            </AppText>
          </View>
        </Row>
      </Card>

      <Row gap={10} style={{ marginBottom: 22 }}>
        <Button title={creating ? t('backup.creating') : t('backup.createNow')} icon="add-circle" onPress={create} disabled={busy} style={{ flex: 1 }} />
        <Button title={t('backup.importFile')} icon="folder-open" variant="ghost" onPress={importFile} disabled={busy} style={{ flex: 1 }} />
      </Row>

      <SectionHeader title={t('backup.savedBackups')} icon="archive" tone="indigo" trailing={<Badge size="sm" variant="primary" label={String(backups.length)} />} />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : backups.length === 0 ? (
        <EmptyState compact illustration="backup" title={t('backup.noBackupsFound')} description={t('backup.no_backups_desc')} />
      ) : (
        backups.map((b) => (
          <Card key={b.fileName} style={{ marginBottom: 12 }}>
            <Row gap={12}>
              <IconTile icon="archive" tone="blue" size={44} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {b.fileName}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {formatDateTime(b.createdAt)} · {formatBytes(b.sizeBytes)}
                </AppText>
              </View>
            </Row>
            <Row gap={8} style={{ marginTop: 12 }}>
              <Button title={t('common.share')} icon="share-social" variant="ghost" size="sm" onPress={() => share(b)} style={{ flex: 1 }} />
              <Button title={t('backup.restore')} icon="refresh" variant="soft" size="sm" onPress={() => restore(b)} disabled={restoring} style={{ flex: 1 }} />
              <Button title={t('common.delete')} icon="trash" variant="dangerSoft" size="sm" onPress={() => remove(b)} style={{ flex: 1 }} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
