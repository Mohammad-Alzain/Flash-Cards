import React, { useState, useEffect } from 'react';
import { Modal, View, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useTheme, alpha, ToneName } from '../../theme';
import { AppText, Row, Button } from '../ui';

export interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface DialogConfig {
  id?: string;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'delete';
  buttons?: DialogButton[];
}

type DialogListener = (config: DialogConfig | null) => void;

class DialogManager {
  private listener: DialogListener | null = null;

  setListener(fn: DialogListener | null) {
    this.listener = fn;
  }

  show(config: DialogConfig) {
    if (this.listener) {
      this.listener(config);
    }
  }

  hide() {
    if (this.listener) {
      this.listener(null);
    }
  }

  /**
   * Drop-in replacement for React Native's Alert.alert()
   * Automatically infers type and icon from title or button styles.
   */
  alert(
    title: string,
    message?: string,
    buttons?: DialogButton[],
    options?: { type?: DialogConfig['type']; icon?: keyof typeof Ionicons.glyphMap }
  ) {
    let inferredType: DialogConfig['type'] = options?.type || 'info';

    const lowerTitle = (title || '').toLowerCase();
    const hasDestructive = (buttons || []).some((b) => b.style === 'destructive');

    if (hasDestructive || lowerTitle.includes('delete') || lowerTitle.includes('حذف')) {
      inferredType = 'delete';
    } else if (lowerTitle.includes('error') || lowerTitle.includes('خطأ') || lowerTitle.includes('failed') || lowerTitle.includes('فشل')) {
      inferredType = 'error';
    } else if (lowerTitle.includes('warning') || lowerTitle.includes('تحذير')) {
      inferredType = 'warning';
    } else if (
      lowerTitle.includes('success') ||
      lowerTitle.includes('تم') ||
      lowerTitle.includes('نجاح') ||
      lowerTitle.includes('done') ||
      lowerTitle.includes('saved') ||
      lowerTitle.includes('restored')
    ) {
      inferredType = 'success';
    } else if (buttons && buttons.length > 1) {
      inferredType = 'confirm';
    }

    this.show({
      title,
      message,
      type: inferredType,
      icon: options?.icon,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: i18n.t('common.ok'), style: 'default' }],
    });
  }
}

export const dialogManager = new DialogManager();

export const showCustomAlert = (
  title: string,
  message?: string,
  buttons?: DialogButton[],
  options?: { type?: DialogConfig['type']; icon?: keyof typeof Ionicons.glyphMap }
) => {
  dialogManager.alert(title, message, buttons, options);
};

export const CustomAlert = {
  alert: (
    title: string,
    message?: string,
    buttons?: DialogButton[],
    options?: { type?: DialogConfig['type']; icon?: keyof typeof Ionicons.glyphMap }
  ) => {
    dialogManager.alert(title, message, buttons, options);
  },
};

const TYPE_STYLE: Record<NonNullable<DialogConfig['type']>, { icon: keyof typeof Ionicons.glyphMap; tone: ToneName }> = {
  info: { icon: 'information-circle', tone: 'indigo' },
  confirm: { icon: 'help-circle', tone: 'indigo' },
  success: { icon: 'checkmark-circle', tone: 'green' },
  warning: { icon: 'warning', tone: 'amber' },
  error: { icon: 'alert-circle', tone: 'rose' },
  delete: { icon: 'trash', tone: 'rose' },
};

export const CustomDialogContainer: React.FC = () => {
  const { colors, shape, shadow, tone } = useTheme();
  const { t } = useTranslation();
  const [config, setConfig] = useState<DialogConfig | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0.85));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    dialogManager.setListener((next) => {
      if (next) {
        setConfig(next);
        scaleAnim.setValue(0.85);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
          Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => setConfig(null));
      }
    });
    return () => dialogManager.setListener(null);
  }, [fadeAnim, scaleAnim]);

  if (!config) return null;

  const handleButtonPress = (btn: DialogButton) => {
    dialogManager.hide();
    if (btn.onPress) setTimeout(() => btn.onPress!(), 50);
  };

  const style = TYPE_STYLE[config.type || 'info'];
  const tn = tone(style.tone);
  const iconName = config.icon ?? style.icon;
  const iconColor = config.iconColor ?? tn.fg;
  const iconBg = config.iconBg ?? tn.bg;
  const buttons: DialogButton[] =
    config.buttons && config.buttons.length > 0 ? config.buttons : [{ text: t('common.ok'), style: 'default' }];
  // Two buttons sit side by side; one or three+ stack vertically.
  const sideBySide = buttons.length === 2;
  const ordered = sideBySide ? [...buttons].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel')) : buttons;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => dialogManager.hide()} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,10,25,0.6)', opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => dialogManager.hide()} />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              borderRadius: shape.sheet,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
            shadow(3),
          ]}
        >
          <View style={[styles.halo, { backgroundColor: alpha(iconColor, 0.08) }]}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name={iconName} size={34} color={iconColor} />
            </View>
          </View>

          <AppText variant="h3" align="center" style={{ marginBottom: 6, paddingHorizontal: 8 }}>
            {config.title}
          </AppText>
          {!!config.message && (
            <AppText variant="body" color="textSecondary" align="center" style={{ marginBottom: 20, paddingHorizontal: 4 }}>
              {config.message}
            </AppText>
          )}
          {!config.message && <View style={{ height: 14 }} />}

          {sideBySide ? (
            <Row gap={10} style={{ width: '100%' }}>
              {ordered.map((btn, index) => (
                <Button
                  key={index}
                  title={btn.text}
                  variant={btn.style === 'cancel' ? 'ghost' : btn.style === 'destructive' ? 'danger' : 'primary'}
                  onPress={() => handleButtonPress(btn)}
                  style={{ flex: 1 }}
                />
              ))}
            </Row>
          ) : (
            <View style={{ width: '100%', gap: 10 }}>
              {ordered.map((btn, index) => (
                <Button
                  key={index}
                  title={btn.text}
                  variant={btn.style === 'cancel' ? 'ghost' : btn.style === 'destructive' ? 'danger' : 'primary'}
                  onPress={() => handleButtonPress(btn)}
                  fullWidth
                />
              ))}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: 22,
    paddingTop: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  halo: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
