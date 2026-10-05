import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { AppLockManager } from '../../core/security/appLock';
import { Logo } from '../brand/Logo';

interface LockOverlayProps {
  visible: boolean;
  onUnlocked: () => void;
}

export const LockOverlay: React.FC<LockOverlayProps> = ({ visible, onUnlocked }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutSec, setLockoutSec] = useState(0);

  useEffect(() => {
    let timer: any = null;
    if (lockoutSec > 0) {
      timer = setInterval(() => {
        setLockoutSec(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutSec]);

  const handlePressDigit = async (digit: string) => {
    if (lockoutSec > 0) return;
    if (pin.length >= 6) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const newPin = pin + digit;
    setPin(newPin);
    setErrorMsg('');

    if (newPin.length >= 4) {
      // Auto verify at 4 digits, or if user reaches 6
      const res = await AppLockManager.verifyPin(newPin);
      if (res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setPin('');
        setErrorMsg('');
        onUnlocked();
      } else if (res.lockedOut) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
        setLockoutSec(res.remainingSec);
        setPin('');
        setErrorMsg(t('security.lockedOut', { seconds: res.remainingSec }));
      } else if (newPin.length === 6) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
        setPin('');
        setErrorMsg(t('security.wrongPin'));
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <Logo variant="mark" size={64} style={{ marginBottom: 16 }} />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('security.appLocked')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {t('security.enterPin')}
          </Text>
        </View>

        {/* PIN Indicators */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map(idx => {
            const isFilled = idx < pin.length;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: isFilled ? theme.colors.primary : 'transparent',
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Error or Lockout Message */}
        {lockoutSec > 0 ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {t('security.lockedOut', { seconds: lockoutSec })}
          </Text>
        ) : errorMsg ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errorMsg}
          </Text>
        ) : null}

        {/* Numeric Keypad */}
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', 'delete'],
          ].map((row, rIdx) => (
            <View key={rIdx} style={styles.row}>
              {row.map((item, cIdx) => {
                if (item === '') {
                  return <View key={cIdx} style={styles.keyEmpty} />;
                }
                if (item === 'delete') {
                  return (
                    <TouchableOpacity
                      key={cIdx}
                      style={[
                        styles.key,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                          borderBottomColor: theme.colors.borderDarker,
                        },
                      ]}
                      onPress={handleDelete}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.keyText, { color: theme.colors.text }]}>⌫</Text>
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={cIdx}
                    style={[
                      styles.key,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderBottomColor: theme.colors.borderDarker,
                      },
                    ]}
                    onPress={() => handlePressDigit(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.keyText, { color: theme.colors.text }]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  lockIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  key: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {
    flex: 1,
    height: 64,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
  },
});
