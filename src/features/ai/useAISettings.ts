import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { aiKeyStorage } from '../../core/ai/aiKeyStorage';
import { aiService } from '../../core/ai/aiService';
import { aiCacheService } from '../../core/ai/aiCacheService';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';
import { AIProviderType } from '../../core/ai/types';

const GOOGLE_AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';
const ANTHROPIC_CONSOLE_URL = 'https://console.anthropic.com/settings/keys';

export const providerName = (p: AIProviderType) => (p === 'gemini' ? 'Google Gemini' : 'Claude');

const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/** State and actions for the AI assistant settings screen. */
export const useAISettings = () => {
  const { t } = useTranslation();
  const [enabled, setEnabledState] = useState(true);
  const [provider, setProvider] = useState<AIProviderType>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [tokensUsed, setTokensUsed] = useState('0');

  const loadKey = async (p: AIProviderType) => {
    const key = await aiKeyStorage.getApiKey(p);
    setApiKey(key || '');
    setHasSavedKey(!!key);
  };

  useEffect(() => {
    (async () => {
      setEnabledState(await aiService.isEnabled());
      const p = await aiService.getActiveProviderType();
      setProvider(p);
      await loadKey(p);
      setCacheCount(await aiCacheService.getCacheCount());
      setTokensUsed(await settingsRepository.get('ai_tokens_used', '0'));
    })();
  }, []);

  const name = providerName(provider);

  const setEnabled = async (v: boolean) => {
    setEnabledState(v);
    await aiService.setEnabled(v);
  };

  const selectProvider = async (p: AIProviderType) => {
    setProvider(p);
    await aiService.setActiveProviderType(p);
    await loadKey(p);
  };

  const openConsole = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Linking.openURL(provider === 'gemini' ? GOOGLE_AI_STUDIO_URL : ANTHROPIC_CONSOLE_URL);
    } catch {
      CustomAlert.alert(t('ai_settings.link_error_title'), t('ai_settings.link_error_msg'));
    }
  };

  const pasteKey = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        setApiKey(text.trim());
        success();
      } else {
        CustomAlert.alert(t('ai_settings.clipboard_empty_title'), t('ai_settings.clipboard_empty_msg'));
      }
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || t('ai_settings.clipboard_failed'));
    }
  };

  const saveKey = async () => {
    if (!apiKey.trim()) {
      CustomAlert.alert(t('common.error'), t('ai_settings.key_required'));
      return;
    }
    try {
      await aiKeyStorage.setApiKey(apiKey.trim(), provider);
      setHasSavedKey(true);
      success();
      CustomAlert.alert(t('ai_settings.saved_title'), t('ai_settings.saved_msg', { provider: name }));
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || t('ai_settings.save_failed'));
    }
  };

  const deleteKey = () =>
    CustomAlert.alert(t('ai_settings.delete_title'), t('ai_settings.delete_msg', { provider: name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await aiKeyStorage.deleteApiKey(provider);
          setApiKey('');
          setHasSavedKey(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          CustomAlert.alert(t('ai_settings.deleted_title'), t('ai_settings.deleted_msg'));
        },
      },
    ]);

  const testConnection = async () => {
    const key = apiKey.trim();
    if (!key) {
      CustomAlert.alert(t('common.error'), t('ai_settings.key_required'));
      return;
    }
    setTesting(true);
    try {
      await aiKeyStorage.setApiKey(key, provider);
      await aiService.setActiveProviderType(provider);
      await aiService.testConnection(key);
      setHasSavedKey(true);
      success();
      CustomAlert.alert(t('ai_settings.test_ok_title'), t('ai_settings.test_ok_msg', { provider: name }));
    } catch (e: any) {
      CustomAlert.alert(t('ai_settings.test_fail_title'), e.message || t('ai_settings.test_fail_msg'));
    } finally {
      setTesting(false);
    }
  };

  const clearCache = () =>
    CustomAlert.alert(t('ai_settings.clear_title'), t('ai_settings.clear_msg', { count: cacheCount }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ai_settings.clear_yes'),
        style: 'destructive',
        onPress: async () => {
          await aiCacheService.clearCache();
          setCacheCount(0);
          CustomAlert.alert(t('ai_settings.cleared_title'), t('ai_settings.cleared_msg'));
        },
      },
    ]);

  return {
    enabled,
    setEnabled,
    provider,
    providerName: name,
    selectProvider,
    apiKey,
    setApiKey,
    hasSavedKey,
    testing,
    cacheCount,
    tokensUsed,
    openConsole,
    pasteKey,
    saveKey,
    deleteKey,
    testConnection,
    clearCache,
  };
};
