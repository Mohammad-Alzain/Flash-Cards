import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { isRTL } from '../../i18n';
import { Header } from '../../components/ui/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { aiKeyStorage } from '../../core/ai/aiKeyStorage';
import { aiService } from '../../core/ai/aiService';
import { aiCacheService } from '../../core/ai/aiCacheService';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';
import { AIProviderType } from '../../core/ai/types';

const GOOGLE_AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';
const ANTHROPIC_CONSOLE_URL = 'https://console.anthropic.com/settings/keys';

export default function AISettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, typography, spacing, radius } = useTheme();
  const rtl = isRTL();

  const [aiEnabled, setAiEnabled] = useState(true);
  const [activeProvider, setActiveProvider] = useState<AIProviderType>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [savedKeyExists, setSavedKeyExists] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [tokensUsed, setTokensUsed] = useState('0');

  // Preferences
  const [explainLang, setExplainLang] = useState('ar');
  const [userLevel, setUserLevel] = useState('intermediate');
  const [responseLength, setResponseLength] = useState('concise');

  const loadSettings = async () => {
    const enabled = await aiService.isEnabled();
    setAiEnabled(enabled);

    const provider = await aiService.getActiveProviderType();
    setActiveProvider(provider);

    const key = await aiKeyStorage.getApiKey(provider);
    if (key) {
      setApiKey(key);
      setSavedKeyExists(true);
    } else {
      setApiKey('');
      setSavedKeyExists(false);
    }

    const cCount = await aiCacheService.getCacheCount();
    setCacheCount(cCount);

    const tokens = await settingsRepository.get('ai_tokens_used', '0');
    setTokensUsed(tokens);

    const lang = await settingsRepository.get('ai_explain_lang', 'ar');
    setExplainLang(lang);

    const lvl = await settingsRepository.get('ai_user_level', 'intermediate');
    setUserLevel(lvl);

    const len = await settingsRepository.get('ai_response_length', 'concise');
    setResponseLength(len);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleToggleEnabled = async (val: boolean) => {
    setAiEnabled(val);
    await aiService.setEnabled(val);
  };

  const handleSelectProvider = async (provider: AIProviderType) => {
    setActiveProvider(provider);
    await aiService.setActiveProviderType(provider);

    const key = await aiKeyStorage.getApiKey(provider);
    if (key) {
      setApiKey(key);
      setSavedKeyExists(true);
    } else {
      setApiKey('');
      setSavedKeyExists(false);
    }
  };

  const handleOpenStudio = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const url = activeProvider === 'gemini' ? GOOGLE_AI_STUDIO_URL : ANTHROPIC_CONSOLE_URL;
      await Linking.openURL(url);
    } catch {
      CustomAlert.alert(
        rtl ? 'خطأ في فتح الرابط' : 'Error Opening Link',
        rtl
          ? 'تعذر فتح المتصفح تلقائياً. يمكنك زيارة الرابط التالي:\nhttps://aistudio.google.com/app/apikey'
          : 'Could not open browser. Please visit:\nhttps://aistudio.google.com/app/apikey'
      );
    }
  };

  const handlePasteKey = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        setApiKey(text.trim());
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        CustomAlert.alert(
          rtl ? 'الحافظة فارغة' : 'Clipboard Empty',
          rtl ? 'لم يتم العثور على أي نص في الحافظة لنسخه.' : 'No text found in clipboard.'
        );
      }
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'فشل القراءة من الحافظة.');
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      CustomAlert.alert(t('common.error'), 'يرجى كتابة أو لصق مفتاح API أولاً.');
      return;
    }

    try {
      await aiKeyStorage.setApiKey(apiKey.trim(), activeProvider);
      setSavedKeyExists(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      CustomAlert.alert(
        rtl ? 'تم الحفظ بأمان' : 'Saved Securely',
        rtl
          ? `تم تخزين مفتاح ${activeProvider === 'gemini' ? 'Google Gemini' : 'Claude'} بأمان في وحدة التخزين المشفرة للجهاز.`
          : 'API key securely stored in hardware-backed storage.'
      );
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message || 'فشل حفظ المفتاح.');
    }
  };

  const handleDeleteKey = async () => {
    CustomAlert.alert(
      rtl ? 'حذف مفتاح API' : 'Delete API Key',
      rtl
        ? `هل أنت متأكد من رغبتك في حذف مفتاح ${activeProvider === 'gemini' ? 'Google Gemini' : 'Claude'} من جهازك نهائياً؟`
        : 'Are you sure you want to delete this key permanently from your device?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await aiKeyStorage.deleteApiKey(activeProvider);
            setApiKey('');
            setSavedKeyExists(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            CustomAlert.alert(
              rtl ? 'تم الحذف' : 'Deleted',
              rtl ? 'تم مسح مفتاح الـ API من التخزين الآمن.' : 'API key removed from secure storage.'
            );
          },
        },
      ]
    );
  };

  const handleTestConnection = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest) {
      CustomAlert.alert(t('common.error'), 'يرجى إدخال مفتاح API لاختباره.');
      return;
    }

    setTesting(true);
    try {
      // Temporarily ensure provider is active
      await aiKeyStorage.setApiKey(keyToTest, activeProvider);
      await aiService.setActiveProviderType(activeProvider);
      await aiService.testConnection(keyToTest);
      setSavedKeyExists(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      CustomAlert.alert(
        rtl ? 'الاتصال ناجح' : 'Connection Successful',
        rtl
          ? `تم التحقق من مفتاح ${activeProvider === 'gemini' ? 'Google Gemini المجاني' : 'Claude'} بنجاح! خدمة الذكاء الاصطناعي والتصحيح التلقائي جاهزة للعمل.`
          : 'AI service verified successfully and ready to use.'
      );
    } catch (e: any) {
      CustomAlert.alert(rtl ? 'فشل الاتصال' : 'Connection Failed', e.message || 'تعذر التحقق من المفتاح.');
    } finally {
      setTesting(false);
    }
  };

  const handleClearCache = async () => {
    CustomAlert.alert(
      rtl ? 'مسح التخزين المؤقت' : 'Clear AI Cache',
      rtl
        ? `هل تريد مسح جميع الإجابات والتقييمات المخزنة محلياً (${cacheCount} عنصر)؟`
        : `Delete all locally cached AI evaluations (${cacheCount} items)?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: rtl ? 'مسح الكاش' : 'Clear',
          style: 'destructive',
          onPress: async () => {
            await aiCacheService.clearCache();
            setCacheCount(0);
            CustomAlert.alert(
              rtl ? 'تم المسح' : 'Cleared',
              rtl ? 'تم تفريغ التخزين المؤقت للذكاء الاصطناعي.' : 'AI cache cleared.'
            );
          },
        },
      ]
    );
  };

  const handleSelectLang = async (lang: string) => {
    setExplainLang(lang);
    await settingsRepository.set('ai_explain_lang', lang);
  };

  const handleSelectLevel = async (lvl: string) => {
    setUserLevel(lvl);
    await settingsRepository.set('ai_user_level', lvl);
  };

  const handleSelectLength = async (len: string) => {
    setResponseLength(len);
    await settingsRepository.set('ai_response_length', len);
  };

  const isGemini = activeProvider === 'gemini';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={rtl ? 'مساعد الذكاء الاصطناعي' : 'AI Study Assistant'}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Master Toggle Banner */}
        <Card style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <View style={[styles.rowBetween, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1, paddingRight: rtl ? 0 : 12, paddingLeft: rtl ? 12 : 0 }}>
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
                  {rtl ? 'تفعيل الذكاء الاصطناعي' : 'Enable AI Assistant'}
                </Text>
              </View>
              <Text style={[styles.cardSub, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left', marginTop: 4 }]}>
                {rtl
                  ? 'تشغيل مساعد الدراسة الذكي والتصحيح التلقائي للاختبارات الكتابية'
                  : 'Power study explanations and AI-graded written quizzes'}
              </Text>
            </View>
            <Switch
              value={aiEnabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>

        {/* AI Provider Switcher */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'اختيار مزود الذكاء الاصطناعي' : 'Choose AI Provider'}
        </Text>

        <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 10, marginBottom: 4 }}>
          {/* Option: Google Gemini (Recommended & Free) */}
          <TouchableOpacity
            onPress={() => handleSelectProvider('gemini')}
            style={[
              styles.providerTab,
              {
                flex: 1,
                borderColor: isGemini ? colors.primary : colors.border,
                backgroundColor: isGemini ? colors.primaryLight : colors.surfaceRaised,
                borderRadius: radius.md,
                padding: spacing.md,
              },
            ]}
          >
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={isGemini ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={isGemini ? colors.primary : colors.textMuted}
              />
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                Google Gemini
              </Text>
            </View>
            <View style={{ marginTop: 4, flexDirection: rtl ? 'row-reverse' : 'row' }}>
              <Badge label={rtl ? 'مجاني بالكامل' : '100% Free'} variant="accent" size="sm" />
            </View>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                marginTop: 4,
                textAlign: rtl ? 'right' : 'left',
              }}
            >
              {rtl ? '1,500 طلب مجاناً يومياً بدون بطاقة ائتمان' : '1,500 free requests/day with no credit card'}
            </Text>
          </TouchableOpacity>

          {/* Option: Claude */}
          <TouchableOpacity
            onPress={() => handleSelectProvider('anthropic')}
            style={[
              styles.providerTab,
              {
                flex: 1,
                borderColor: !isGemini ? colors.primary : colors.border,
                backgroundColor: !isGemini ? colors.primaryLight : colors.surfaceRaised,
                borderRadius: radius.md,
                padding: spacing.md,
              },
            ]}
          >
            <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={!isGemini ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={!isGemini ? colors.primary : colors.textMuted}
              />
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                Claude (Anthropic)
              </Text>
            </View>
            <View style={{ marginTop: 4, flexDirection: rtl ? 'row-reverse' : 'row' }}>
              <Badge label={rtl ? 'يتطلب رصيد' : 'Requires Credits'} variant="neutral" size="sm" />
            </View>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                marginTop: 4,
                textAlign: rtl ? 'right' : 'left',
              }}
            >
              {rtl ? 'يتطلب شحن حسابك بمبلغ مدفوع' : 'Requires paid Anthropic credits'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* API Key Box */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? `مفتاح ${isGemini ? 'Google Gemini' : 'Anthropic Claude'}` : `${isGemini ? 'Google Gemini' : 'Anthropic Claude'} API Key`}
        </Text>

        <Card style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          {/* Direct Button to Open Google AI Studio / Anthropic Console */}
          <TouchableOpacity
            onPress={handleOpenStudio}
            activeOpacity={0.8}
            style={[
              styles.studioCtaBtn,
              {
                backgroundColor: isGemini ? '#1A73E8' : colors.accent,
                borderRadius: radius.md,
                flexDirection: rtl ? 'row-reverse' : 'row',
              },
            ]}
          >
            <Ionicons name="open-outline" size={20} color="#FFFFFF" />
            <Text style={styles.studioCtaText}>
              {isGemini
                ? (rtl ? 'فتح صفحة تسجيل الدخول وإنشاء مفتاح Gemini مجاناً' : 'Open Google AI Studio & Get Free Key')
                : (rtl ? 'فتح لوحة تحكم Anthropic للحصول على المفتاح' : 'Open Anthropic Console')}
            </Text>
          </TouchableOpacity>

          {/* Quick Steps Guide */}
          <View style={[styles.guideBox, { backgroundColor: colors.surface, borderRadius: radius.sm }]}>
            <Text style={[styles.guideTitle, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'كيف تحصل على المفتاح المجاني بدقيقة واحدة:' : 'How to get your free key in 1 minute:'}
            </Text>
            <Text style={[styles.guideStep, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl
                ? '1. اضغط الزر الأزرق أعلاه لفتح Google AI Studio وسجّل الدخول بحساب Google.'
                : '1. Tap the blue button above to open Google AI Studio and sign in with Google.'}
            </Text>
            <Text style={[styles.guideStep, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl
                ? '2. اضغط على "Create API key" ثم انسخ المفتاح المتولد.'
                : '2. Click "Create API key" and copy the generated key.'}
            </Text>
            <Text style={[styles.guideStep, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl
                ? '3. عُد هنا واضغط على زر «لصق من الحافظة» ثم «حفظ واختبار الاتصال».'
                : '3. Return here, tap "Paste from Clipboard", then Save & Test.'}
            </Text>
          </View>

          {/* Key Input Field */}
          <View
            style={[
              styles.inputContainer,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                flexDirection: rtl ? 'row-reverse' : 'row',
                borderRadius: radius.md,
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}
              placeholder={isGemini ? 'AIzaSy...' : 'sk-ant-api03-...'}
              placeholderTextColor={colors.textMuted}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowKey(!showKey)} style={styles.eyeBtn}>
              <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Paste & Action Buttons */}
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={handlePasteKey}
              style={[
                styles.pasteBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  flexDirection: rtl ? 'row-reverse' : 'row',
                  borderRadius: radius.sm,
                },
              ]}
            >
              <Ionicons name="clipboard-outline" size={17} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                {rtl ? 'لصق المفتاح من الحافظة' : 'Paste Key from Clipboard'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.actionsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <Button
                title={rtl ? 'حفظ المفتاح' : 'Save Key'}
                variant="primary"
                size="md"
                onPress={handleSaveKey}
                style={{ flex: 1 }}
              />

              <Button
                title={testing ? (rtl ? 'جاري الفحص...' : 'Testing...') : (rtl ? 'اختبار الاتصال' : 'Test')}
                variant="secondary"
                size="md"
                loading={testing}
                onPress={handleTestConnection}
                style={{ flex: 1 }}
              />

              {savedKeyExists && (
                <Button
                  title={rtl ? 'حذف' : 'Delete'}
                  variant="danger"
                  size="md"
                  onPress={handleDeleteKey}
                />
              )}
            </View>
          </View>
        </Card>

        {/* Preferences Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'تفضيلات الشرح والمستوى' : 'Preferences'}
        </Text>

        <Card style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          {/* Explanation Language */}
          <Text style={[styles.itemLabel, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
            {rtl ? 'لغة الشرح والتقييم' : 'Explanation Language'}
          </Text>
          <View style={[styles.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {[
              { id: 'ar', label: 'العربية (Arabic)' },
              { id: 'en', label: 'English' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: explainLang === item.id ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSelectLang(item.id)}
              >
                <Text style={{ color: explainLang === item.id ? '#FFFFFF' : colors.text, fontSize: 13, fontWeight: '700' }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* User Level */}
          <Text style={[styles.itemLabel, { color: colors.text, textAlign: rtl ? 'right' : 'left', marginTop: 14 }]}>
            {rtl ? 'المستوى الدراسي' : 'Proficiency Level'}
          </Text>
          <View style={[styles.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {[
              { id: 'beginner', label: rtl ? 'مبتدئ' : 'Beginner' },
              { id: 'intermediate', label: rtl ? 'متوسط' : 'Intermediate' },
              { id: 'advanced', label: rtl ? 'متقدم' : 'Advanced' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: userLevel === item.id ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSelectLevel(item.id)}
              >
                <Text style={{ color: userLevel === item.id ? '#FFFFFF' : colors.text, fontSize: 13, fontWeight: '700' }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Response Length */}
          <Text style={[styles.itemLabel, { color: colors.text, textAlign: rtl ? 'right' : 'left', marginTop: 14 }]}>
            {rtl ? 'طول الإجابة والتصحيح' : 'Response Length'}
          </Text>
          <View style={[styles.chipsRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {[
              { id: 'concise', label: rtl ? 'مختصر ومركز' : 'Concise' },
              { id: 'detailed', label: rtl ? 'مفصل وشامل' : 'Detailed' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: responseLength === item.id ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSelectLength(item.id)}
              >
                <Text style={{ color: responseLength === item.id ? '#FFFFFF' : colors.text, fontSize: 13, fontWeight: '700' }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Privacy, Cost & Cache */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
          {rtl ? 'الخصوصية والتكلفة والتخزين' : 'Privacy, Usage & Cache'}
        </Text>

        <Card style={[styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {rtl ? 'إجمالي الرموز المستهلكة (Tokens):' : 'Estimated Tokens Used:'}
            </Text>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '800' }}>
              {tokensUsed}
            </Text>
          </View>

          <View style={[styles.statRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: 8 }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {rtl ? 'عناصر التخزين المؤقت المحلي (الكاش):' : 'Local Cached Responses:'}
            </Text>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800' }}>
              {cacheCount}
            </Text>
          </View>

          <Text style={[styles.privacyNote, { color: colors.textMuted, textAlign: rtl ? 'right' : 'left', marginTop: 12 }]}>
            {rtl
              ? '🔒 مبدأ الخصوصية: يُرسل نص السؤال والجواب للبطاقة المحددة فقط عند الطلب، ولا يتم رفع الرزم كاملة ولا الوسائط والصور الشخصية أبداً.'
              : '🔒 Privacy Notice: Only individual card text is sent when requested. Whole decks and media are never transmitted.'}
          </Text>

          {cacheCount > 0 && (
            <Button
              title={rtl ? 'مسح التخزين المؤقت للذكاء الاصطناعي' : 'Clear AI Cache'}
              variant="ghost"
              size="sm"
              onPress={handleClearCache}
              style={{ marginTop: 12 }}
            />
          )}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowBetween: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardSub: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 2,
  },
  providerTab: {
    borderWidth: 1.5,
  },
  studioCtaBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  studioCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  guideBox: {
    padding: 12,
    marginBottom: 12,
  },
  guideTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  guideStep: {
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 3,
  },
  inputContainer: {
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 13,
  },
  eyeBtn: {
    padding: 6,
  },
  pasteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
  },
  actionsRow: {
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  chipsRow: {
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  statRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privacyNote: {
    fontSize: 11,
    lineHeight: 16,
  },
});
