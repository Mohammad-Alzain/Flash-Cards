import React, { useState, useEffect } from 'react';
import { Modal, View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Header, IconButton, Button, Card, Row, AppText, IconTile } from '../ui';
import { Illustration, Mascot } from '../illustrations';
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

const COPIED_RESET_MS = 2000;

/** Renders the model's lightweight markdown (headings / bullets / paragraphs). */
const Explanation: React.FC<{ text: string }> = ({ text }) => {
  const { colors } = useTheme();
  return (
    <View>
      {text.split('\n').map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <View key={idx} style={{ height: 8 }} />;
        const isHeading = trimmed.startsWith('#') || /^[0-9]+\.\s+/.test(trimmed) || trimmed.endsWith(':');
        if (isHeading) {
          return (
            <Row key={idx} gap={8} style={{ marginTop: 14, marginBottom: 4 }}>
              <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.primary }} />
              <AppText variant="title" weight="extrabold" color="primary" style={{ flex: 1 }}>
                {trimmed.replace(/^#+\s*/, '')}
              </AppText>
            </Row>
          );
        }
        const isBullet = /^[-•*]\s/.test(trimmed);
        return (
          <Row key={idx} gap={8} align="flex-start" style={{ marginVertical: 2 }}>
            {isBullet && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 9 }} />}
            <AppText variant="body" style={{ flex: 1 }}>
              {isBullet ? trimmed.replace(/^[-•*]\s*/, '') : trimmed}
            </AppText>
          </Row>
        );
      })}
    </View>
  );
};

/** Full-screen AI explanation of the current card. */
export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ visible, onClose, cardId, front, back, deckName, noteTypeName, fields }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchExplanation = async (forceRefresh = false) => {
    if (!cardId) return;
    setLoading(true);
    setError(null);
    try {
      setExplanation(await cardExplainer.explainCard({ cardId, front, back, deckName, noteTypeName, fields, forceRefresh }));
    } catch (err: any) {
      console.warn('[AIAssistantModal] Explanation error:', err);
      setError(err?.message || t('ai_assistant.error_default'));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cardId]);

  const copy = async () => {
    if (!explanation) return;
    try {
      await Clipboard.setStringAsync(explanation);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {}
  };

  const regenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fetchExplanation(true);
  };

  const openSettings = () => {
    onClose();
    router.push('/settings/ai');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
        <Header
          title={t('ai_assistant.title')}
          icon="sparkles"
          iconTone="violet"
          rightElement={
            <>
              {!!explanation && !loading && (
                <>
                  <IconButton icon={copied ? 'checkmark' : 'copy'} variant="ghost" onPress={copy} accessibilityLabel={copied ? t('ai_assistant.copied') : t('ai_assistant.copy')} />
                  <IconButton icon="refresh" variant="ghost" onPress={regenerate} accessibilityLabel={t('ai_assistant.regenerate')} />
                </>
              )}
              <IconButton icon="close" onPress={onClose} accessibilityLabel={t('common.close')} />
            </>
          }
        />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Card variant="tinted" tone="violet" style={{ marginBottom: 16 }}>
            <Row gap={10}>
              <IconTile icon="document-text" tone="violet" size={36} variant="solid" />
              <View style={{ flex: 1 }}>
                <AppText variant="caption" weight="extrabold" color="textSecondary">
                  {t('ai_assistant.card_prompt')}
                </AppText>
                <AppText variant="h3">{cleanTextForQuiz(front)}</AppText>
              </View>
            </Row>
          </Card>

          {loading && (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Mascot size={110} expression="thinking" accessory="glasses" />
              <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
              <AppText variant="bodySm" color="textSecondary" align="center" style={{ marginTop: 10 }}>
                {t('ai_assistant.loading')}
              </AppText>
            </View>
          )}

          {!loading && !!error && (
            <View style={{ alignItems: 'center' }}>
              <Illustration name="error" size={170} />
              <AppText variant="h3" align="center">
                {t('ai_assistant.error_title')}
              </AppText>
              <AppText variant="bodySm" color="textSecondary" align="center" style={{ marginTop: 4, marginBottom: 16 }}>
                {error}
              </AppText>
              <Row gap={10} style={{ alignSelf: 'stretch' }}>
                <Button title={t('ai_assistant.try_again')} icon="refresh" onPress={() => fetchExplanation(true)} style={{ flex: 1 }} />
                <Button title={t('ai_assistant.settings')} icon="settings" variant="ghost" onPress={openSettings} style={{ flex: 1 }} />
              </Row>
            </View>
          )}

          {!loading && !error && explanation.length > 0 && (
            <Card>
              <Explanation text={explanation} />
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};
