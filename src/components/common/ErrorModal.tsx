import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { AppErrorDetails } from '../../core/utils/errorHandler';

interface ErrorModalProps {
  visible: boolean;
  error: AppErrorDetails | null;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ visible, error, onClose }) => {
  const { colors, spacing, typography } = useTheme();
  const rtl = isRTL();
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!visible || !error) return null;

  const handleCopy = async () => {
    const fullText = [
      `Title: ${error.title}`,
      `Context: ${error.context || 'Unknown'}`,
      `Time: ${new Date(error.timestamp || Date.now()).toISOString()}`,
      `Message: ${error.message}`,
      error.stack ? `\nStack:\n${error.stack}` : '',
    ].filter(Boolean).join('\n');

    try {
      await Clipboard.setStringAsync(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Failed to copy to clipboard:', e);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Header Icon + Title */}
          <View style={[styles.header, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Ionicons name="alert-circle" size={28} color="#ef4444" />
            </View>
            <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
              <Text
                style={[
                  styles.title,
                  {
                    color: colors.text,
                    textAlign: rtl ? 'right' : 'left',
                  },
                ]}
                numberOfLines={2}
              >
                {error.title}
              </Text>
              {error.context && (
                <Text
                  style={[
                    styles.context,
                    {
                      color: colors.textSecondary,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {error.context}
                </Text>
              )}
            </View>
          </View>

          {/* User-facing Message */}
          <ScrollView style={styles.messageScroll} contentContainerStyle={{ paddingVertical: 4 }}>
            <Text
              style={[
                styles.message,
                {
                  color: colors.text,
                  textAlign: rtl ? 'right' : 'left',
                },
              ]}
            >
              {error.message}
            </Text>

            {/* Collapsible Stack / Technical Details */}
            {error.stack && (
              <View style={{ marginTop: spacing.md }}>
                <Pressable
                  onPress={() => setShowDetails(!showDetails)}
                  style={[styles.toggleBtn, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons
                    name={showDetails ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={{ color: colors.primary, fontSize: 13, marginHorizontal: 6 }}>
                    {showDetails
                      ? (rtl ? 'إخفاء التفاصيل التقنية' : 'Hide Technical Details')
                      : (rtl ? 'عرض التفاصيل التقنية' : 'Show Technical Details')}
                  </Text>
                </Pressable>

                {showDetails && (
                  <View
                    style={[
                      styles.stackContainer,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <ScrollView horizontal nestedScrollEnabled>
                      <Text style={[styles.stackText, { color: colors.textSecondary }]}>
                        {error.stack}
                      </Text>
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.actions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [
                styles.btn,
                styles.copyBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surface : 'transparent',
                },
              ]}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color={copied ? '#10b981' : colors.text}
                style={{ marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0 }}
              />
              <Text
                style={{
                  color: copied ? '#10b981' : colors.text,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                {copied
                  ? (rtl ? 'تم النسخ!' : 'Copied!')
                  : (rtl ? 'نسخ تفاصيل الخطأ' : 'Copy Error')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.btn,
                styles.closeBtn,
                {
                  backgroundColor: pressed ? '#dc2626' : '#ef4444',
                },
              ]}
            >
              <Text style={styles.closeText}>
                {rtl ? 'إغلاق' : 'Close'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  context: {
    fontSize: 12,
    marginTop: 2,
  },
  messageScroll: {
    maxHeight: 280,
    marginVertical: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  stackContainer: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 140,
  },
  stackText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    lineHeight: 15,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  copyBtn: {
    borderWidth: 1,
  },
  closeBtn: {},
  closeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
