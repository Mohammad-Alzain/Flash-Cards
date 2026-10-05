import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { brandColors } from '../../theme/brand';
import { isRTL } from '../../i18n';
import { ProgressRing } from '../ui/ProgressRing';
import { ProgressBar } from '../ui/ProgressBar';
import { VaultBackupIllustration, SessionCompleteIllustration } from '../brand';
import { BackupProgress, BackupStage } from '../../core/backup/backupService';

interface BackupProgressModalProps {
  visible: boolean;
  progress: BackupProgress | null;
}

interface StepItem {
  id: BackupStage;
  labelAr: string;
  labelEn: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: StepItem[] = [
  { id: 'database', labelAr: 'البيانات', labelEn: 'Database', icon: 'server-outline' },
  { id: 'media', labelAr: 'الوسائط', labelEn: 'Media', icon: 'images-outline' },
  { id: 'compressing', labelAr: 'الضغط', labelEn: 'Compress', icon: 'archive-outline' },
  { id: 'saving', labelAr: 'الحفظ', labelEn: 'Vault', icon: 'shield-checkmark-outline' },
];

export const BackupProgressModal: React.FC<BackupProgressModalProps> = ({
  visible,
  progress,
}) => {
  const { colors, isDark } = useTheme();
  const rtl = isRTL();

  if (!visible) return null;

  const currentPercent = progress?.percent ?? 0;
  const currentStage = progress?.stage ?? 'preparing';
  const isDone = currentPercent >= 100 || currentStage === 'complete';

  const getStepStatus = (stepId: BackupStage): 'done' | 'active' | 'pending' => {
    const order: BackupStage[] = ['preparing', 'database', 'media', 'compressing', 'saving', 'complete'];
    const currentIndex = order.indexOf(currentStage);
    const stepIndex = order.indexOf(stepId);

    if (isDone || currentIndex > stepIndex) return 'done';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
              borderColor: isDark ? '#1E293B' : '#E0E7FF',
            },
          ]}
        >
          {/* Header Title */}
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: isDark ? '#F8FAFC' : '#0F172A', textAlign: 'center' },
              ]}
            >
              {rtl ? 'جاري تأمين النسخة الاحتياطية' : 'Creating Secure Backup'}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center' },
              ]}
            >
              {rtl
                ? 'حفظ مشفر محلي بالكامل دون اتصال بالإنترنت'
                : '100% Offline Local Encrypted Vault'}
            </Text>
          </View>

          {/* Artistic Centerpiece: ProgressRing + Illustration */}
          <View style={styles.visualContainer}>
            <View style={styles.ringWrapper}>
              <ProgressRing
                progress={currentPercent / 100}
                size={164}
                strokeWidth={7}
                color={isDone ? brandColors.success : brandColors.accent}
                trackColor={isDark ? '#1E293B' : '#EEF2FF'}
                label=""
              />
              <View style={styles.illustrationOverlay}>
                {isDone ? (
                  <SessionCompleteIllustration size={105} />
                ) : (
                  <VaultBackupIllustration size={95} />
                )}
              </View>
            </View>

            {/* Glowing Percent Badge */}
            <View
              style={[
                styles.percentBadge,
                {
                  backgroundColor: isDone ? '#10B98115' : brandColors.primaryLight,
                  borderColor: isDone ? brandColors.success : brandColors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.percentText,
                  { color: isDone ? brandColors.success : brandColors.primary },
                ]}
              >
                {currentPercent}%
              </Text>
            </View>
          </View>

          {/* Stage Headline & Detail */}
          <View style={styles.messageBox}>
            <Text
              style={[
                styles.mainMessage,
                { color: isDark ? '#F1F5F9' : '#1E293B', textAlign: 'center' },
              ]}
            >
              {progress?.message || (rtl ? 'جاري تجهيز النسخة...' : 'Preparing backup...')}
            </Text>
            {progress?.detail && (
              <Text
                style={[
                  styles.detailMessage,
                  { color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center' },
                ]}
              >
                {progress.detail}
              </Text>
            )}
          </View>

          {/* Stepper Milestones */}
          <View style={[styles.stepperRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {STEPS.map((step, idx) => {
              const status = getStepStatus(step.id);
              const isStepDone = status === 'done';
              const isStepActive = status === 'active';

              return (
                <View key={step.id} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      isStepDone && {
                        backgroundColor: brandColors.success,
                        borderColor: brandColors.success,
                      },
                      isStepActive && {
                        backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
                        borderColor: brandColors.primary,
                        borderWidth: 2,
                      },
                      status === 'pending' && {
                        backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                      },
                    ]}
                  >
                    {isStepDone ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : (
                      <Ionicons
                        name={step.icon}
                        size={14}
                        color={isStepActive ? brandColors.primary : (isDark ? '#64748B' : '#94A3B8')}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: isStepDone
                          ? (isDark ? '#E2E8F0' : '#334155')
                          : isStepActive
                          ? brandColors.primary
                          : (isDark ? '#64748B' : '#94A3B8'),
                        fontWeight: isStepActive || isStepDone ? '700' : '500',
                      },
                    ]}
                  >
                    {rtl ? step.labelAr : step.labelEn}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Linear Glowing Progress Track */}
          <View style={styles.progressTrackWrapper}>
            <ProgressBar
              progress={currentPercent / 100}
              height={7}
              color={isDone ? brandColors.success : brandColors.primary}
            />
          </View>

          {/* Data Counts Pill */}
          {(progress?.cardCount !== undefined || progress?.mediaCount !== undefined) && (
            <View
              style={[
                styles.countsPill,
                {
                  backgroundColor: isDark ? '#111827' : '#F8FAFC',
                  borderColor: isDark ? '#1E293B' : '#E2E8F0',
                },
              ]}
            >
              <Ionicons name="layers-outline" size={13} color={brandColors.primary} />
              <Text
                style={[
                  styles.countsText,
                  { color: isDark ? '#94A3B8' : '#64748B' },
                ]}
              >
                {rtl
                  ? `${progress?.cardCount || 0} بطاقة • ${progress?.mediaCount || 0} وسائط`
                  : `${progress?.cardCount || 0} Cards • ${progress?.mediaCount || 0} Media`}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: Math.min(width - 40, 360),
    borderRadius: 28,
    borderWidth: 1.5,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 12,
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  visualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  ringWrapper: {
    width: 164,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  illustrationOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentBadge: {
    position: 'absolute',
    bottom: -8,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  messageBox: {
    marginTop: 18,
    marginBottom: 14,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  mainMessage: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  detailMessage: {
    fontSize: 12,
    fontWeight: '500',
  },
  stepperRow: {
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  progressTrackWrapper: {
    width: '100%',
    marginBottom: 12,
  },
  countsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  countsText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
