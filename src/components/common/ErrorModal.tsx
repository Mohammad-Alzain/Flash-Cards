import React, { useState } from 'react';
import { Modal, View, ScrollView, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { AppText, Row, Button, Card } from '../ui';
import { Illustration } from '../illustrations';
import { AppErrorDetails } from '../../core/utils/errorHandler';

interface ErrorModalProps {
  visible: boolean;
  error: AppErrorDetails | null;
  onClose: () => void;
}

const COPIED_RESET_MS = 2500;

/** Friendly error dialog with optional technical details and copy-to-clipboard. */
export const ErrorModal: React.FC<ErrorModalProps> = ({ visible, error, onClose }) => {
  const { colors, shape } = useTheme();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!visible || !error) return null;

  const copy = async () => {
    const fullText = [
      `Title: ${error.title}`,
      `Context: ${error.context || 'Unknown'}`,
      `Time: ${new Date(error.timestamp || Date.now()).toISOString()}`,
      `Message: ${error.message}`,
      error.stack ? `\nStack:\n${error.stack}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await Clipboard.setStringAsync(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (e) {
      console.warn('Failed to copy to clipboard:', e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,10,25,0.6)', justifyContent: 'center', padding: 20 }}>
        <Card style={{ borderRadius: shape.sheet, maxHeight: '85%' }}>
          <View style={{ alignItems: 'center' }}>
            <Illustration name="error" size={150} />
            <AppText variant="h3" align="center" numberOfLines={2}>
              {error.title}
            </AppText>
            {!!error.context && (
              <AppText variant="caption" color="textMuted" align="center">
                {error.context}
              </AppText>
            )}
          </View>

          <ScrollView style={{ maxHeight: 260, marginVertical: 12 }}>
            <AppText variant="body" color="textSecondary" align="center">
              {error.message}
            </AppText>
            {!!error.stack && (
              <>
                <Button
                  title={showDetails ? t('error_modal.hide_details') : t('error_modal.show_details')}
                  icon={showDetails ? 'chevron-up' : 'code-slash'}
                  variant="soft"
                  size="sm"
                  onPress={() => setShowDetails(!showDetails)}
                  style={{ alignSelf: 'center', marginTop: 12 }}
                />
                {showDetails && (
                  <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: colors.surface }}>
                    <AppText
                      size={11}
                      color="textSecondary"
                      align="left"
                      style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}
                    >
                      {error.stack}
                    </AppText>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <Row gap={10}>
            <Button title={copied ? t('error_modal.copied') : t('error_modal.copy')} icon={copied ? 'checkmark' : 'copy'} variant="ghost" onPress={copy} style={{ flex: 1 }} />
            <Button title={t('common.close')} onPress={onClose} style={{ flex: 1 }} />
          </Row>
        </Card>
      </View>
    </Modal>
  );
};
