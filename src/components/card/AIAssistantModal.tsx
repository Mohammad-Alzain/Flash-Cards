import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Button } from '../ui/Button';
import { cardExplainer } from '../../core/ai/cardExplainer';
import { cleanTextForQuiz } from '../../core/quiz/generator';

interface AIAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  cardId: string;
  front: string;
  back?: string;
  deckName?: string;
  noteTypeName?: string;
  fields?: Record<string, string>;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  visible,
  onClose,
  cardId,
  front,
  back,
  deckName,
  noteTypeName,
  fields,
}) => {
  const { colors, typography, spacing, radius } = useTheme();
  const rtl = isRTL();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cleanFront = cleanTextForQuiz(front);

  const fetchExplanation = async (forceRefresh = false) => {
    if (!cardId) return;
    setLoading(true);
    setError(null);

    try {
      const result = await cardExplainer.explainCard({
        cardId,
        front,
        back,
        deckName,
        noteTypeName,
        fields,
        forceRefresh,
      });
      setExplanation(result);
    } catch (err: any) {
      console.warn('[AIAssistantModal] Explanation error:', err);
      setError(err?.message || (rtl ? 'تعذر توليد الشرح حالياً.' : 'Failed to generate explanation.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && cardId) {
      setCopied(false);
      fetchExplanation(false);
    } else {
      setExplanation('');
      setError(null);
    }
  }, [visible, cardId]);

  const handleCopy = async () => {
    if (!explanation) return;
    try {
      await Clipboard.setStringAsync(explanation);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRegenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fetchExplanation(true);
  };

  const handleOpenSettings = () => {
    onClose();
    router.push('/settings/ai');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        {/* Header Bar */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
              flexDirection: rtl ? 'row-reverse' : 'row',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          {/* Title & Icon */}
          <View
            style={{
              flexDirection: rtl ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
              flex: 1,
            }}
          >
            <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.bold,
              }}
            >
              {rtl ? 'مساعد الدراسة الذكي' : 'AI Study Assistant'}
            </Text>
          </View>

          {/* Action Icons */}
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
            {explanation.length > 0 && (
              <>
                <TouchableOpacity
                  onPress={handleCopy}
                  hitSlop={8}
                  style={[
                    styles.headerIconBtn,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={copied ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleRegenerate}
                  hitSlop={8}
                  style={[
                    styles.headerIconBtn,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              style={[
                styles.headerIconBtn,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              ]}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Card Subject Banner */}
        {cleanFront ? (
          <View
            style={[
              styles.cardBanner,
              {
                backgroundColor: colors.surfaceRaised,
                borderBottomColor: colors.border,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              },
            ]}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: typography.weights.bold,
                textAlign: rtl ? 'right' : 'left',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
            >
              {rtl ? 'محتوى البطاقة:' : 'Card Prompt:'}
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.bold,
                textAlign: rtl ? 'right' : 'left',
              }}
              numberOfLines={2}
            >
              {cleanFront}
            </Text>
          </View>
        ) : null}

        {/* Content Area */}
        <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.md,
                  textAlign: 'center',
                }}
              >
                {rtl ? 'جاري تحليل البطاقة وصياغة الشرح الذكي...' : 'Analyzing card & drafting study details...'}
              </Text>
            </View>
          )}

          {!loading && error && (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.lg,
                },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={32} color={colors.warning} />
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.bold,
                  marginTop: spacing.sm,
                  textAlign: 'center',
                }}
              >
                {rtl ? 'تعذر جلب الشرح' : 'Explanation Unavailable'}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.sizes.sm,
                  marginTop: spacing.xs,
                  marginBottom: spacing.lg,
                  textAlign: 'center',
                  lineHeight: 20,
                }}
              >
                {error}
              </Text>

              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 10, width: '100%' }}>
                <Button
                  title={rtl ? 'إعادة المحاولة' : 'Try Again'}
                  variant="primary"
                  size="md"
                  onPress={() => fetchExplanation(true)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={rtl ? 'إعدادات الذكاء' : 'AI Settings'}
                  variant="secondary"
                  size="md"
                  onPress={handleOpenSettings}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}

          {!loading && !error && explanation.length > 0 && (
            <View style={{ width: '100%' }}>
              {explanation.split('\n').map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) {
                  return <View key={idx} style={{ height: 8 }} />;
                }

                // Check for Section Header
                const isSectionHeader =
                  trimmed.startsWith('#') ||
                  /^[0-9]+\.\s+/.test(trimmed) ||
                  trimmed.endsWith(':');

                if (isSectionHeader) {
                  const cleanTitle = trimmed.replace(/^#+\s*/, '');
                  return (
                    <Text
                      key={idx}
                      style={{
                        color: colors.primary,
                        fontSize: typography.sizes.md,
                        fontWeight: typography.weights.bold,
                        marginTop: 12,
                        marginBottom: 4,
                        textAlign: rtl ? 'right' : 'left',
                        lineHeight: 24,
                      }}
                    >
                      {cleanTitle}
                    </Text>
                  );
                }

                const isBullet =
                  trimmed.startsWith('- ') ||
                  trimmed.startsWith('• ') ||
                  trimmed.startsWith('* ');
                const cleanBullet = isBullet ? trimmed.replace(/^[-•*]\s*/, '') : trimmed;

                return (
                  <View
                    key={idx}
                    style={{
                      flexDirection: rtl ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginVertical: 2,
                    }}
                  >
                    {isBullet && (
                      <Text style={{ color: colors.primary, fontSize: 14, lineHeight: 22 }}>
                        •
                      </Text>
                    )}
                    <Text
                      style={{
                        flex: 1,
                        color: colors.text,
                        fontSize: typography.sizes.sm,
                        lineHeight: 22,
                        textAlign: rtl ? 'right' : 'left',
                      }}
                    >
                      {cleanBullet}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBanner: {
    borderBottomWidth: 1,
  },
  content: {
    paddingBottom: 40,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
