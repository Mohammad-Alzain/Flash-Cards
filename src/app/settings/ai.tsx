import React, { useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useDirection, alpha } from '../../theme';
import { Screen, Header, Card, Row, AppText, Badge, Button, IconTile, ListGroup, ListItem, ChoiceChips, PressableScale, SectionHeader } from '../../components/ui';
import { Illustration } from '../../components/illustrations';
import { useAISettings } from '../../features/ai/useAISettings';
import { useSetting } from '../../hooks/useSetting';
import { AIProviderType } from '../../core/ai/types';

export default function AISettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, shape, tone } = useTheme();
  const dir = useDirection();
  const ai = useAISettings();
  const [showKey, setShowKey] = useState(false);
  const [explainLang, setExplainLang] = useSetting('ai_explain_lang', 'ar');
  const [level, setLevel] = useSetting('ai_user_level', 'intermediate');
  const [length, setLength] = useSetting('ai_response_length', 'concise');
  const isGemini = ai.provider === 'gemini';

  const providers: { id: AIProviderType; name: string; badge: string; desc: string; free: boolean }[] = [
    { id: 'gemini', name: 'Google Gemini', badge: t('ai_settings.free_badge'), desc: t('ai_settings.free_desc'), free: true },
    { id: 'anthropic', name: 'Claude (Anthropic)', badge: t('ai_settings.paid_badge'), desc: t('ai_settings.paid_desc'), free: false },
  ];

  return (
    <Screen decor header={<Header title={t('ai_settings.title')} subtitle={t('ai_settings.subtitle')} icon="sparkles" iconTone="violet" onBack={() => router.back()} />}>
      <Card variant="gradient" padding={16} style={{ marginBottom: 14 }}>
        <Row gap={10}>
          <Illustration name="ai" size={110} backdrop={false} onColor />
          <View style={{ flex: 1 }}>
            <AppText variant="h3" color="#FFFFFF">
              {t('ai_settings.enable')}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 2 }}>
              {t('ai_settings.enable_desc')}
            </AppText>
          </View>
        </Row>
      </Card>
      <ListGroup>
        <ListItem icon="sparkles" tone="violet" title={t('ai_settings.enable')} switchValue={ai.enabled} onSwitchChange={ai.setEnabled} />
      </ListGroup>

      {/* Provider */}
      <SectionHeader title={t('ai_settings.provider_title')} icon="cloud" tone="sky" />
      <Row gap={10} align="stretch" style={{ marginBottom: 22 }}>
        {providers.map((p) => {
          const selected = ai.provider === p.id;
          return (
            <PressableScale
              key={p.id}
              onPress={() => ai.selectProvider(p.id)}
              haptic
              style={{
                flex: 1,
                padding: 12,
                borderRadius: shape.card,
                borderWidth: 2,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? alpha(colors.primary, 0.07) : colors.surfaceRaised,
              }}
            >
              <Row gap={6} justify="space-between">
                <IconTile icon={p.free ? 'logo-google' : 'chatbubbles'} tone={p.free ? 'blue' : 'orange'} size={36} />
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.textMuted} />
              </Row>
              <AppText variant="bodyStrong" style={{ marginTop: 8 }}>
                {p.name}
              </AppText>
              <Badge size="sm" variant={p.free ? 'success' : 'neutral'} label={p.badge} style={{ marginTop: 4, alignSelf: dir.alignStart }} />
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                {p.desc}
              </AppText>
            </PressableScale>
          );
        })}
      </Row>

      {/* Key */}
      <SectionHeader title={t('ai_settings.key_title', { provider: ai.providerName })} icon="key" tone="amber" />
      <Card style={{ marginBottom: 22 }}>
        <Button
          title={isGemini ? t('ai_settings.open_gemini') : t('ai_settings.open_anthropic')}
          icon="open"
          color={isGemini ? '#1A73E8' : tone('orange').solid}
          fullWidth
          onPress={ai.openConsole}
          style={{ marginBottom: 12 }}
        />
        {isGemini && (
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: colors.surface, marginBottom: 12, gap: 6 }}>
            <AppText variant="bodySm" weight="extrabold">
              {t('ai_settings.guide_title')}
            </AppText>
            {[t('ai_settings.guide_1'), t('ai_settings.guide_2'), t('ai_settings.guide_3')].map((step, i) => (
              <Row key={i} gap={8} align="flex-start">
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: alpha(colors.primary, 0.15), alignItems: 'center', justifyContent: 'center' }}>
                  <AppText variant="caption" size={11} weight="black" color="primary" align="center">
                    {i + 1}
                  </AppText>
                </View>
                <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
                  {step}
                </AppText>
              </Row>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: shape.input, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, marginBottom: 10, gap: 10 }}>
          <Ionicons name="key" size={18} color={colors.textMuted} />
          <TextInput
            value={ai.apiKey}
            onChangeText={ai.setApiKey}
            placeholder={isGemini ? 'AIzaSy…' : 'sk-ant-api03-…'}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            underlineColorAndroid="transparent"
            style={{ flex: 1, color: colors.text, fontSize: 15, textAlign: 'left' }}
          />
          <Pressable onPress={() => setShowKey(!showKey)} hitSlop={10}>
            <Ionicons name={showKey ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Button title={t('ai_settings.paste')} icon="clipboard" variant="soft" fullWidth onPress={ai.pasteKey} style={{ marginBottom: 10 }} />
        <Row gap={8}>
          <Button title={t('ai_settings.save_key')} icon="save" onPress={ai.saveKey} style={{ flex: 1 }} />
          <Button title={ai.testing ? t('ai_settings.testing') : t('ai_settings.test')} icon="pulse" variant="ghost" loading={ai.testing} onPress={ai.testConnection} style={{ flex: 1 }} />
          {ai.hasSavedKey && <Button icon="trash" variant="dangerSoft" onPress={ai.deleteKey} />}
        </Row>
      </Card>

      {/* Preferences */}
      <SectionHeader title={t('ai_settings.prefs_title')} icon="options" tone="pink" />
      <Card style={{ marginBottom: 22, paddingBottom: 2 }}>
        <ChoiceChips
          label={t('ai_settings.explain_lang')}
          labelIcon="language"
          options={[
            { value: 'ar', label: 'العربية' },
            { value: 'en', label: 'English' },
          ]}
          value={explainLang}
          onChange={setExplainLang}
        />
        <ChoiceChips
          label={t('ai_settings.level')}
          labelIcon="school"
          options={[
            { value: 'beginner', label: t('ai_settings.beginner') },
            { value: 'intermediate', label: t('ai_settings.intermediate') },
            { value: 'advanced', label: t('ai_settings.advanced') },
          ]}
          value={level}
          onChange={setLevel}
        />
        <ChoiceChips
          label={t('ai_settings.length')}
          labelIcon="text"
          options={[
            { value: 'concise', label: t('ai_settings.concise') },
            { value: 'detailed', label: t('ai_settings.detailed') },
          ]}
          value={length}
          onChange={setLength}
        />
      </Card>

      {/* Usage */}
      <ListGroup title={t('ai_settings.usage_title')} footer={t('ai_settings.privacy')}>
        <ListItem icon="speedometer" tone="indigo" title={t('ai_settings.tokens')} value={ai.tokensUsed} />
        <ListItem icon="file-tray-full" tone="teal" title={t('ai_settings.cached')} value={String(ai.cacheCount)} />
        {ai.cacheCount > 0 && <ListItem icon="trash" destructive title={t('ai_settings.clear_cache')} onPress={ai.clearCache} />}
      </ListGroup>
    </Screen>
  );
}
