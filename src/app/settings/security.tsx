import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
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
import { AppLockManager, SecurityConfig, LockType } from '../../core/security/appLock';

export default function SecurityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();

  const [config, setConfig] = useState<SecurityConfig>({
    enabled: false,
    lockType: 'none',
    timeoutSeconds: 0,
    hasPin: false,
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const loadConfig = async () => {
    const c = await AppLockManager.getConfig();
    setConfig(c);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleToggleLock = async (enabled: boolean) => {
    if (enabled) {
      if (!config.hasPin) {
        setShowPinModal(true);
      } else {
        await AppLockManager.setPin(newPin || '1234', 'pin');
        await loadConfig();
      }
    } else {
      CustomAlert.alert(t('security.disableConfirmTitle'), t('security.disableConfirmDesc'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('security.disable'),
          style: 'destructive',
          onPress: async () => {
            await AppLockManager.disableLock();
            await loadConfig();
          },
        },
      ]);
    }
  };

  const handleSavePin = async () => {
    if (newPin.length < 4) {
      setPinError(t('security.pinMinLength'));
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(t('security.pinMismatch'));
      return;
    }

    try {
      await AppLockManager.setPin(newPin, 'pin');
      setShowPinModal(false);
      setNewPin('');
      setConfirmPin('');
      setPinError('');
      await loadConfig();
      CustomAlert.alert(t('common.success'), t('security.pinSetSuccess'));
    } catch (e: any) {
      setPinError(e.message || 'Error saving PIN');
    }
  };

  const handleSelectTimeout = async (seconds: number) => {
    await AppLockManager.setTimeoutSeconds(seconds);
    await loadConfig();
  };

  const timeoutOptions = [
    { label: t('security.timeoutImmediate'), value: 0 },
    { label: t('security.timeout1Min'), value: 60 },
    { label: t('security.timeout5Min'), value: 300 },
    { label: t('security.timeout15Min'), value: 900 },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('security.title')}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed" size={28} color={theme.colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                {t('security.offlineSecurityTitle')}
              </Text>
              <Text style={[styles.infoSubtitle, { color: theme.colors.textMuted }]}>
                {t('security.offlineSecurityDesc')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Master Switch */}
        <Card style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {t('security.enableLock')}
              </Text>
              <Text style={[styles.cardDesc, { color: theme.colors.textMuted }]}>
                {t('security.enableLockDesc')}
              </Text>
            </View>
            <Switch
              value={config.enabled}
              onValueChange={handleToggleLock}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>
        </Card>

        {config.enabled && (
          <>
            {/* PIN Settings */}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('security.pinSettings')}
            </Text>
            <Card style={styles.card}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setNewPin('');
                  setConfirmPin('');
                  setPinError('');
                  setShowPinModal(true);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                    {config.hasPin ? t('security.changePin') : t('security.setPin')}
                  </Text>
                  <Text style={[styles.cardDesc, { color: theme.colors.textMuted }]}>
                    {config.hasPin ? t('security.pinConfigured') : t('security.pinNotSet')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </Card>

            {/* Inactivity Timeout */}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('security.timeout')}
            </Text>
            <Card style={styles.card}>
              {timeoutOptions.map((opt, i) => {
                const isSelected = config.timeoutSeconds === opt.value;
                return (
                  <React.Fragment key={opt.value}>
                    <TouchableOpacity
                      style={styles.timeoutRow}
                      onPress={() => handleSelectTimeout(opt.value)}
                    >
                      <Text
                        style={[
                          styles.timeoutLabel,
                          { color: isSelected ? theme.colors.primary : theme.colors.text },
                          isSelected && { fontWeight: '700' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                    {i < timeoutOptions.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    )}
                  </React.Fragment>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Set PIN Modal */}
      <Modal visible={showPinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {config.hasPin ? t('security.changePin') : t('security.setPin')}
            </Text>

            <Text style={[styles.inputLabel, { color: theme.colors.textMuted }]}>
              {t('security.enterNewPin')}
            </Text>
            <TextInput
              style={[styles.pinInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              value={newPin}
              onChangeText={setNewPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="••••"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textMuted, marginTop: 12 }]}>
              {t('security.confirmNewPin')}
            </Text>
            <TextInput
              style={[styles.pinInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="••••"
              placeholderTextColor={theme.colors.textMuted}
            />

            {pinError ? (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {pinError}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Button
                title={t('common.cancel')}
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setShowPinModal(false)}
              />
              <Button
                title={t('common.save')}
                variant="primary"
                style={{ flex: 1 }}
                onPress={handleSavePin}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 14,
  },
  card: {
    padding: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
  },
  timeoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  timeoutLabel: {
    fontSize: 14,
  },
  divider: {
    height: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 2,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  pinInput: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
});
