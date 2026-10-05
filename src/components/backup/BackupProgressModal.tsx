import React from 'react';
import { View, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '../../theme';
import { AppText, Row, Card, ProgressRing, ProgressBar, IconName } from '../ui';
import { Mascot } from '../illustrations';
import { BackupProgress, BackupStage } from '../../core/backup/backupService';

interface BackupProgressModalProps {
  visible: boolean;
  progress: BackupProgress | null;
}

const ORDER: BackupStage[] = ['preparing', 'database', 'media', 'compressing', 'saving', 'complete'];
const STEPS: { id: BackupStage; icon: IconName }[] = [
  { id: 'database', icon: 'server' },
  { id: 'media', icon: 'images' },
  { id: 'compressing', icon: 'archive' },
  { id: 'saving', icon: 'shield-checkmark' },
];

/** Progress ring + stepper shown while a backup is being written. */
export const BackupProgressModal: React.FC<BackupProgressModalProps> = ({ visible, progress }) => {
  const { colors, tone, shape } = useTheme();
  const { t } = useTranslation();
  if (!visible) return null;

  const percent = progress?.percent ?? 0;
  const stage = progress?.stage ?? 'preparing';
  const done = percent >= 100 || stage === 'complete';
  const green = tone('green').fg;

  const statusOf = (id: BackupStage): 'done' | 'active' | 'pending' => {
    const current = ORDER.indexOf(stage);
    const step = ORDER.indexOf(id);
    if (done || current > step) return 'done';
    return current === step ? 'active' : 'pending';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,10,25,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Card style={{ width: '100%', maxWidth: 380, borderRadius: shape.sheet, alignItems: 'center', paddingVertical: 22 }}>
          <AppText variant="h3" align="center">
            {t('backup_progress.title')}
          </AppText>
          <AppText variant="caption" color="textMuted" align="center" style={{ marginBottom: 12 }}>
            {t('backup_progress.subtitle')}
          </AppText>

          <ProgressRing progress={percent / 100} size={170} strokeWidth={10} color={done ? green : colors.primary}>
            <Mascot size={96} expression={done ? 'excited' : 'happy'} pose={done ? 'cheer' : 'idle'} />
          </ProgressRing>

          <AppText variant="h2" color={done ? green : 'primary'} align="center" style={{ marginTop: 8 }}>
            {percent}%
          </AppText>
          <AppText variant="bodyStrong" align="center" style={{ marginTop: 4 }}>
            {progress?.message || t('backup_progress.preparing')}
          </AppText>
          {!!progress?.detail && (
            <AppText variant="caption" color="textSecondary" align="center">
              {progress.detail}
            </AppText>
          )}

          <Row justify="space-between" style={{ alignSelf: 'stretch', marginTop: 16, marginBottom: 12 }}>
            {STEPS.map((s) => {
              const st = statusOf(s.id);
              const color = st === 'done' ? green : st === 'active' ? colors.primary : colors.textMuted;
              return (
                <View key={s.id} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: st === 'done' ? green : alpha(color, 0.14),
                      borderWidth: st === 'active' ? 2 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    <Ionicons name={st === 'done' ? 'checkmark' : s.icon} size={16} color={st === 'done' ? '#FFFFFF' : color} />
                  </View>
                  <AppText variant="caption" size={11} weight={st === 'pending' ? 'semibold' : 'extrabold'} color={color} align="center">
                    {t(`backup_progress.step_${s.id}`)}
                  </AppText>
                </View>
              );
            })}
          </Row>
          <ProgressBar progress={percent / 100} height={8} color={done ? green : colors.primary} />

          {(progress?.cardCount !== undefined || progress?.mediaCount !== undefined) && (
            <Row gap={6} style={{ marginTop: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.surface }}>
              <Ionicons name="layers" size={13} color={colors.primary} />
              <AppText variant="caption" weight="bold" color="textSecondary">
                {t('backup_progress.counts', { cards: progress?.cardCount || 0, media: progress?.mediaCount || 0 })}
              </AppText>
            </Row>
          )}
        </Card>
      </View>
    </Modal>
  );
};
