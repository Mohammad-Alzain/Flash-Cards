import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { Header } from '../../components/ui/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackupService, BackupInfo } from '../../core/backup/backupService';

export default function BackupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const list = await BackupService.listBackups();
      setBackups(list);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Failed to list backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      const res = await BackupService.createBackup();
      CustomAlert.alert(
        t('backup.createSuccessTitle'),
        t('backup.createSuccessDesc', {
          count: res.metadata?.cardCount || 0,
          media: res.metadata?.mediaCount || 0,
        })
      );
      await loadBackups();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleImportBackup = async () => {
    try {
      const imported = await BackupService.importBackupFromDocumentPicker();
      if (imported) {
        CustomAlert.alert(t('common.success'), t('backup.importSuccess'));
        await loadBackups();
      }
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Failed to import backup');
    }
  };

  const handleRestore = (backup: BackupInfo) => {
    CustomAlert.alert(
      t('backup.restoreConfirmTitle'),
      t('backup.restoreConfirmDesc', { name: backup.fileName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('backup.restore'),
          style: 'destructive',
          onPress: async () => {
            try {
              setRestoring(true);
              const result = await BackupService.restoreBackup(backup.filePath);
              CustomAlert.alert(
                t('common.success'),
                t('backup.restoreSuccessDesc', {
                  cards: result.cardCount || 0,
                  decks: result.deckCount || 0,
                }),
                [{ text: t('common.ok'), onPress: () => router.replace('/(tabs)/decks') }]
              );
            } catch (err: any) {
              CustomAlert.alert(t('common.error'), err.message || 'Failed to restore backup');
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (backup: BackupInfo) => {
    CustomAlert.alert(t('backup.deleteConfirmTitle'), t('backup.deleteConfirmDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await BackupService.deleteBackup(backup.fileName);
            await loadBackups();
          } catch (e: any) {
            CustomAlert.alert(t('common.error'), e.message || 'Failed to delete backup');
          }
        },
      },
    ]);
  };

  const handleShare = async (backup: BackupInfo) => {
    try {
      await BackupService.shareBackup(backup.fileName);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'Failed to share backup');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (ms: number): string => {
    const d = new Date(ms);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('backup.title')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={28} color={theme.colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                {t('backup.infoTitle')}
              </Text>
              <Text style={[styles.infoSubtitle, { color: theme.colors.textMuted }]}>
                {t('backup.infoDesc')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Button
            title={creating ? t('backup.creating') : t('backup.createNow')}
            variant="primary"
            style={{ flex: 1 }}
            onPress={handleCreateBackup}
            disabled={creating || restoring}
          />
          <Button
            title={t('backup.importFile')}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={handleImportBackup}
            disabled={creating || restoring}
          />
        </View>

        {/* Existing Backups List */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t('backup.savedBackups')} ({backups.length})
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : backups.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {t('backup.noBackupsFound')}
            </Text>
          </Card>
        ) : (
          backups.map(item => (
            <Card key={item.fileName} style={styles.backupCard}>
              <View style={styles.backupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.backupName, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Text style={[styles.backupMeta, { color: theme.colors.textMuted }]}>
                    {formatDate(item.createdAt)} • {formatBytes(item.sizeBytes)}
                  </Text>
                </View>
              </View>

              <View style={[styles.cardDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: theme.colors.border }]}
                  onPress={() => handleShare(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={16} color={theme.colors.text} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>
                    {t('common.share')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' }]}
                  onPress={() => handleRestore(item)}
                  activeOpacity={0.7}
                  disabled={restoring}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.primary, fontWeight: '700' }]}>
                    {t('backup.restore')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: theme.colors.error }]}
                  onPress={() => handleDelete(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>
                    {t('common.delete')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Restoring modal indicator */}
      {restoring && (
        <View style={styles.restoringOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.restoringText}>{t('backup.restoringMessage')}</Text>
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
  infoCard: {
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backupCard: {
    padding: 14,
    marginBottom: 12,
  },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backupName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  backupMeta: {
    fontSize: 12,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  restoringOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  restoringText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
