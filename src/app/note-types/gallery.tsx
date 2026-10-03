import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, Badge } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { CardRenderer } from '../../components/card/CardRenderer';
import {
  TEMPLATE_GALLERY_PRESETS,
  TemplatePreset,
} from '../../core/render/templateGallery';
import { renderCard } from '../../core/render/templateEngine';
import { noteRepository } from '../../core/db/repositories/noteRepository';

export default function TemplateGalleryScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [selectedPreset, setSelectedPreset] = useState<TemplatePreset | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [installing, setInstalling] = useState(false);

  const handleUsePreset = async (preset: TemplatePreset) => {
    setInstalling(true);
    try {
      const created = await noteRepository.createNoteType({
        name: preset.name.replace(/^\d+\.\s*/, ''),
        fields: preset.fields,
        templates: preset.templates,
        css: preset.css,
        isCloze: preset.isCloze,
      });

      CustomAlert.alert(
        t('common.done'),
        `Created note type "${created.name}" from preset!`,
        [
          {
            text: t('common.done'),
            onPress: () => router.push(`/note-types/${created.id}/templates`),
          },
        ]
      );
    } catch (err: any) {
      CustomAlert.alert(t('common.error'), err.message);
    } finally {
      setInstalling(false);
    }
  };

  // Preview data
  let previewRendered = null;
  if (selectedPreset) {
    const sampleFields: Record<string, string> = {};
    selectedPreset.fields.forEach((f) => {
      if (f.name === 'Text') {
        sampleFields['Text'] = 'Cairo is the capital of {{c1::Egypt}} and largest city in the Arab world.';
      } else if (f.rtl) {
        sampleFields[f.name] = 'مفردات ونصوص باللغة العربية';
      } else {
        sampleFields[f.name] = `Sample ${f.name} value`;
      }
    });

    const activeTpl = selectedPreset.templates[0];
    previewRendered = renderCard({
      frontTemplate: activeTpl.front_html,
      backTemplate: activeTpl.back_html,
      fields: sampleFields,
      css: selectedPreset.css,
      templateOrd: 0,
    });
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('note_types.gallery_button')}
        subtitle="Bundled offline presets (Section 8A.6)"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {TEMPLATE_GALLERY_PRESETS.map((preset) => (
          <Card key={preset.id} style={[styles.presetCard, { marginBottom: spacing.md }]}>
            <View style={[styles.titleRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <Text
                style={[
                  styles.presetName,
                  {
                    color: colors.text,
                    fontSize: typography.sizes.md,
                    fontWeight: typography.weights.bold,
                    textAlign: rtl ? 'right' : 'left',
                    flex: 1,
                  },
                ]}
              >
                {preset.name}
              </Text>
              {preset.isCloze && (
                <Badge count="Cloze" variant="accent" size="sm" />
              )}
            </View>

            <Text
              style={[
                styles.presetDesc,
                {
                  color: colors.textSecondary,
                  fontSize: typography.sizes.xs,
                  textAlign: rtl ? 'right' : 'left',
                  marginTop: 4,
                  lineHeight: 18,
                },
              ]}
            >
              {preset.description}
            </Text>

            <View style={[styles.tagsRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: spacing.sm }]}>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                Fields: {preset.fields.map((f) => f.name).join(', ')}
              </Text>
            </View>

            <View style={[styles.btnRow, { flexDirection: rtl ? 'row-reverse' : 'row', marginTop: spacing.md }]}>
              <Button
                title="Preview"
                icon={<Ionicons name="eye-outline" size={16} color={colors.primary} />}
                variant="ghost"
                size="sm"
                onPress={() => {
                  setSelectedPreset(preset);
                  setPreviewSide('front');
                }}
                style={{ flex: 1, marginRight: rtl ? 0 : 8, marginLeft: rtl ? 8 : 0 }}
              />
              <Button
                title="Use Preset"
                variant="primary"
                size="sm"
                loading={installing}
                onPress={() => handleUsePreset(preset)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Preset Preview Modal */}
      <Modal
        visible={!!selectedPreset}
        animationType="slide"
        onRequestClose={() => setSelectedPreset(null)}
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
          <Header
            title={selectedPreset?.name || 'Preview'}
            subtitle={previewSide.toUpperCase()}
            onBack={() => setSelectedPreset(null)}
            rightElement={
              <Button
                title={previewSide === 'front' ? 'Show Back' : 'Show Front'}
                variant="ghost"
                size="sm"
                onPress={() => setPreviewSide(previewSide === 'front' ? 'back' : 'front')}
              />
            }
          />

          <View style={styles.previewContainer}>
            {selectedPreset && previewRendered && (
              <CardRenderer
                htmlContent={previewSide === 'front' ? previewRendered.frontHtml : previewRendered.backHtml}
                css={selectedPreset.css}
                templateOrd={0}
              />
            )}
          </View>

          {selectedPreset && (
            <View style={{ padding: 16 }}>
              <Button
                title={`Apply "${selectedPreset.name}"`}
                variant="primary"
                size="lg"
                onPress={() => {
                  const p = selectedPreset;
                  setSelectedPreset(null);
                  handleUsePreset(p);
                }}
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {},
  presetCard: {},
  titleRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetName: {},
  presetDesc: {},
  tagsRow: {},
  btnRow: {},
  modalSafe: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    padding: 16,
  },
});
