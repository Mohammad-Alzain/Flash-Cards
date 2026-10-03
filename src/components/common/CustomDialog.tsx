import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';

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
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
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

export const CustomDialogContainer: React.FC = () => {
  const { colors, isDark, typography, radius, spacing } = useTheme();
  const rtl = isRTL();

  const [config, setConfig] = useState<DialogConfig | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0.85));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    dialogManager.setListener((newConfig) => {
      if (newConfig) {
        setConfig(newConfig);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }).start(() => setConfig(null));
      }
    });

    return () => {
      dialogManager.setListener(null);
    };
  }, [fadeAnim, scaleAnim]);

  if (!config) return null;

  const handleDismiss = () => {
    dialogManager.hide();
  };

  const handleButtonPress = (btn: DialogButton) => {
    dialogManager.hide();
    if (btn.onPress) {
      setTimeout(() => {
        btn.onPress!();
      }, 50);
    }
  };

  // Determine icon & color scheme
  let iconName: keyof typeof Ionicons.glyphMap = 'information-circle-outline';
  let iconColor = colors.primary;
  let iconBg = colors.primary + '18';

  const type = config.type || 'info';

  if (type === 'delete') {
    iconName = 'trash-outline';
    iconColor = colors.error || '#FF4B4B';
    iconBg = '#FF4B4B22';
  } else if (type === 'error') {
    iconName = 'alert-circle-outline';
    iconColor = colors.error || '#FF4B4B';
    iconBg = '#FF4B4B22';
  } else if (type === 'warning') {
    iconName = 'warning-outline';
    iconColor = colors.warning || '#FF9F1C';
    iconBg = '#FF9F1C22';
  } else if (type === 'success') {
    iconName = 'checkmark-circle-outline';
    iconColor = '#2EC4B6';
    iconBg = '#2EC4B622';
  } else if (type === 'confirm') {
    iconName = 'help-circle-outline';
    iconColor = colors.primary;
    iconBg = colors.primary + '18';
  }

  if (config.icon) {
    iconName = config.icon;
  }
  if (config.iconColor) {
    iconColor = config.iconColor;
  }
  if (config.iconBg) {
    iconBg = config.iconBg;
  }

  const buttons = config.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const isMultiButton = buttons.length > 1;

  return (
    <Modal
      transparent
      visible={true}
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View style={[styles.backdropBg, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.dialogCard,
            {
              backgroundColor: colors.surfaceRaised || (isDark ? '#1F2E35' : '#FFFFFF'),
              borderColor: colors.border,
              borderRadius: radius.xl || 24,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Decorative Icon */}
          <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={32} color={iconColor} />
          </View>

          {/* Title */}
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: typography.sizes.lg || 18,
                fontWeight: typography.weights.bold,
                textAlign: 'center',
              },
            ]}
          >
            {config.title}
          </Text>

          {/* Message */}
          {config.message ? (
            <Text
              style={[
                styles.message,
                {
                  color: colors.textSecondary,
                  fontSize: typography.sizes.sm || 14,
                  textAlign: 'center',
                  lineHeight: 20,
                },
              ]}
            >
              {config.message}
            </Text>
          ) : null}

          {/* Action Buttons */}
          <View
            style={[
              styles.buttonRow,
              {
                flexDirection: isMultiButton && !rtl ? 'row' : isMultiButton && rtl ? 'row-reverse' : 'column',
              },
            ]}
          >
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnBg = colors.primary;
              let btnText = '#FFFFFF';
              let btnBorder = 'transparent';

              if (isCancel) {
                btnBg = isDark ? '#263842' : '#F3F4F6';
                btnText = colors.text;
                btnBorder = colors.border;
              } else if (isDestructive) {
                btnBg = '#DC2626';
                btnText = '#FFFFFF';
                btnBorder = '#B91C1C';
              }

              return (
                <Pressable
                  key={index}
                  onPress={() => handleButtonPress(btn)}
                  style={({ pressed }) => [
                    styles.button,
                    isMultiButton && styles.flexButton,
                    {
                      backgroundColor: pressed ? btnBg + 'CC' : btnBg,
                      borderColor: btnBorder,
                      borderRadius: radius.md || 12,
                      marginLeft: isMultiButton && index > 0 && !rtl ? 10 : 0,
                      marginRight: isMultiButton && index > 0 && rtl ? 10 : 0,
                      marginTop: !isMultiButton && index > 0 ? 8 : 0,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: btnText,
                        fontWeight: isCancel ? '600' : '700',
                        fontSize: typography.sizes.sm || 14,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
    paddingHorizontal: 28,
  },
  backdropBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    padding: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  message: {
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  buttonRow: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 46,
    width: '100%',
  },
  flexButton: {
    flex: 1,
    width: undefined,
  },
  buttonText: {
    textAlign: 'center',
  },
});
