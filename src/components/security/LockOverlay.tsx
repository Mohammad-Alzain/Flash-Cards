import React, { useState, useEffect } from 'react';
import { View, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { AppLockManager } from '../../core/security/appLock';
import { AppText, Row, PressableScale } from '../ui';
import { Illustration } from '../illustrations';

const MIN_PIN = 4;
const MAX_PIN = 6;
const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'delete'],
];

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/** Full-screen PIN pad shown while the app is locked. */
export const LockOverlay: React.FC<{ visible: boolean; onUnlocked: () => void }> = ({ visible, onUnlocked }) => {
  const { t } = useTranslation();
  const { colors, shadow } = useTheme();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutSec, setLockoutSec] = useState(0);

  // Count down an active brute-force lockout.
  useEffect(() => {
    if (lockoutSec <= 0) return;
    const timer = setInterval(() => {
      setLockoutSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSec]);

  const pressDigit = async (digit: string) => {
    if (lockoutSec > 0 || pin.length >= MAX_PIN) return;
    tap();
    const next = pin + digit;
    setPin(next);
    setErrorMsg('');
    if (next.length < MIN_PIN) return;

    // Verify from 4 digits on; a wrong 6-digit entry resets.
    const res = await AppLockManager.verifyPin(next);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPin('');
      setErrorMsg('');
      onUnlocked();
    } else if (res.lockedOut) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setLockoutSec(res.remainingSec);
      setPin('');
      setErrorMsg(t('security.lockedOut', { seconds: res.remainingSec }));
    } else if (next.length === MAX_PIN) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPin('');
      setErrorMsg(t('security.wrongPin'));
    }
  };

  const del = () => {
    if (!pin.length) return;
    tap();
    setPin(pin.slice(0, -1));
    setErrorMsg('');
  };

  if (!visible) return null;

  const message = lockoutSec > 0 ? t('security.lockedOut', { seconds: lockoutSec }) : errorMsg;
  const dots = Math.max(MIN_PIN, pin.length);

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Illustration name="locked" size={190} />
        <AppText variant="h2" align="center">
          {t('security.appLocked')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: 4 }}>
          {t('security.enterPin')}
        </AppText>

        <Row gap={14} style={{ marginVertical: 24 }}>
          {Array.from({ length: dots }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <View
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: message ? colors.error : colors.primary,
                  backgroundColor: filled ? (message ? colors.error : colors.primary) : 'transparent',
                  transform: [{ scale: filled ? 1.1 : 1 }],
                }}
              />
            );
          })}
        </Row>

        <AppText variant="bodySm" weight="bold" color="error" align="center" style={{ minHeight: 22, marginBottom: 12 }}>
          {message}
        </AppText>

        <View style={{ gap: 14 }}>
          {KEYS.map((row, r) => (
            <Row key={r} gap={18}>
              {row.map((key, c) => {
                if (!key) return <View key={c} style={{ width: 74, height: 74 }} />;
                const isDelete = key === 'delete';
                return (
                  <PressableScale
                    key={c}
                    onPress={() => (isDelete ? del() : pressDigit(key))}
                    activeScale={0.9}
                    accessibilityLabel={isDelete ? t('common.delete') : key}
                    style={[
                      {
                        width: 74,
                        height: 74,
                        borderRadius: 37,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isDelete ? 'transparent' : colors.surfaceRaised,
                        borderWidth: isDelete ? 0 : 1,
                        borderColor: colors.border,
                      },
                      isDelete ? null : shadow(1),
                    ]}
                  >
                    {isDelete ? (
                      <Ionicons name="backspace" size={28} color={colors.textSecondary} />
                    ) : (
                      <AppText size={28} weight="extrabold" align="center">
                        {key}
                      </AppText>
                    )}
                  </PressableScale>
                );
              })}
            </Row>
          ))}
        </View>
      </View>
    </Modal>
  );
};
