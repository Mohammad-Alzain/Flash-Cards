import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Card, Row, AppText, IconTile, ListGroup, ListItem, BottomSheet, TextField, Button } from '../../components/ui';
import { Illustration } from '../../components/illustrations';
import { AppLockManager, SecurityConfig } from '../../core/security/appLock';
import { useFocusData } from '../../hooks/useFocusData';

const MIN_PIN = 4;
const MAX_PIN = 6;

export default function SecurityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: config, reload } = useFocusData<SecurityConfig>(
    () => AppLockManager.getConfig(),
    { enabled: false, lockType: 'none', timeoutSeconds: 0, hasPin: false },
    'security'
  );

  const [pinSheet, setPinSheet] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const openPinSheet = () => {
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setPinSheet(true);
  };

  const toggleLock = (enabled: boolean) => {
    if (enabled) {
      // Enabling always asks for a PIN (never falls back to a default one).
      openPinSheet();
      return;
    }
    CustomAlert.alert(t('security.disableConfirmTitle'), t('security.disableConfirmDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('security.disable'),
        style: 'destructive',
        onPress: async () => {
          await AppLockManager.disableLock();
          await reload();
        },
      },
    ]);
  };

  const savePin = async () => {
    if (newPin.length < MIN_PIN) return setPinError(t('security.pinMinLength'));
    if (newPin !== confirmPin) return setPinError(t('security.pinMismatch'));
    try {
      await AppLockManager.setPin(newPin, 'pin');
      setPinSheet(false);
      await reload();
      CustomAlert.alert(t('common.success'), t('security.pinSetSuccess'));
    } catch (e: any) {
      setPinError(e.message || t('common.error'));
    }
  };

  const selectTimeout = async (seconds: number) => {
    await AppLockManager.setTimeoutSeconds(seconds);
    await reload();
  };

  const timeouts = [
    { label: t('security.timeoutImmediate'), value: 0, icon: 'flash' as const },
    { label: t('security.timeout1Min'), value: 60, icon: 'time' as const },
    { label: t('security.timeout5Min'), value: 300, icon: 'timer' as const },
    { label: t('security.timeout15Min'), value: 900, icon: 'hourglass' as const },
  ];

  return (
    <Screen
      decor
      header={<Header title={t('security.title')} subtitle={t('security.subtitle')} icon="lock-closed" iconTone="rose" onBack={() => router.back()} />}
      overlay={
        <BottomSheet
          visible={pinSheet}
          onClose={() => setPinSheet(false)}
          title={config.hasPin ? t('security.changePin') : t('security.setPin')}
          icon="keypad"
          tone="rose"
          footer={
            <Row gap={10}>
              <Button title={t('common.cancel')} variant="ghost" onPress={() => setPinSheet(false)} style={{ flex: 1 }} />
              <Button title={t('common.save')} icon="checkmark" onPress={savePin} style={{ flex: 1 }} />
            </Row>
          }
        >
          {[
            { label: t('security.enterNewPin'), value: newPin, set: setNewPin, auto: true },
            { label: t('security.confirmNewPin'), value: confirmPin, set: setConfirmPin, auto: false },
          ].map((f, i) => (
            <TextField
              key={i}
              label={f.label}
              value={f.value}
              onChangeText={(v) => {
                f.set(v.replace(/\D/g, ''));
                setPinError('');
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={MAX_PIN}
              placeholder="••••"
              icon="keypad"
              autoFocus={f.auto}
              inputStyle={{ fontSize: 22, letterSpacing: 8, textAlign: 'center' }}
              error={i === 1 ? pinError || undefined : undefined}
            />
          ))}
        </BottomSheet>
      }
    >
      <Card variant="tinted" tone="rose" style={{ marginBottom: 22 }}>
        <Row gap={10}>
          <Illustration name="locked" size={110} backdrop={false} />
          <AppText variant="bodySm" color="textSecondary" style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{t('security.offlineSecurityTitle')}{'\n'}</AppText>
            {t('security.offlineSecurityDesc')}
          </AppText>
        </Row>
      </Card>

      <ListGroup>
        <ListItem
          icon="lock-closed"
          tone="rose"
          title={t('security.enableLock')}
          subtitle={t('security.enableLockDesc')}
          switchValue={config.enabled}
          onSwitchChange={toggleLock}
        />
      </ListGroup>

      {config.enabled && (
        <>
          <ListGroup title={t('security.pinSettings')}>
            <ListItem
              icon="keypad"
              tone="indigo"
              title={config.hasPin ? t('security.changePin') : t('security.setPin')}
              subtitle={config.hasPin ? t('security.pinConfigured') : t('security.pinNotSet')}
              onPress={openPinSheet}
            />
          </ListGroup>
          <ListGroup title={t('security.timeout')}>
            {timeouts.map((opt) => {
              const selected = config.timeoutSeconds === opt.value;
              return (
                <ListItem
                  key={opt.value}
                  icon={opt.icon}
                  tone={selected ? 'indigo' : 'slate'}
                  title={opt.label}
                  onPress={() => selectTimeout(opt.value)}
                  showChevron={false}
                  trailing={selected ? <IconTile icon="checkmark" tone="green" size={26} shape="circle" variant="solid" /> : undefined}
                />
              );
            })}
          </ListGroup>
        </>
      )}
    </Screen>
  );
}
