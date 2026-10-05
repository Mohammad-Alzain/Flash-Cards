import React, { useState } from 'react';
import { View, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, toneForKey } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Card, Row, AppText, Badge, Button, IconTile, Chip } from '../../components/ui';
import { CardRenderer } from '../../components/card/CardRenderer';
import { TEMPLATE_GALLERY_PRESETS, TemplatePreset } from '../../core/render/templateGallery';
import { renderCard } from '../../core/render/templateEngine';
import { noteRepository } from '../../core/db/repositories/noteRepository';

/** Cloze sample kept out of i18n because i18next would treat {{…}} as interpolation. */
const CLOZE_SAMPLE = 'Cairo is the capital of {{c1::Egypt}} and largest city in the Arab world.';

export default function TemplateGalleryScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [preview, setPreview] = useState<TemplatePreset | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [installing, setInstalling] = useState<string | null>(null);

  const usePreset = async (preset: TemplatePreset) => {
    setInstalling(preset.id);
    try {
      const created = await noteRepository.createNoteType({
        name: preset.name.replace(/^\d+\.\s*/, ''),
        fields: preset.fields,
        templates: preset.templates,
        css: preset.css,
        isCloze: preset.isCloze,
      });
      CustomAlert.alert(t('common.done'), t('note_types.created_from_preset', { name: created.name }), [
        { text: t('common.done'), onPress: () => router.push(`/note-types/${created.id}/templates`) },
      ]);
    } catch (err: any) {
      CustomAlert.alert(t('common.error'), err.message);
    } finally {
      setInstalling(null);
    }
  };

  const rendered = preview
    ? renderCard({
        frontTemplate: preview.templates[0].front_html,
        backTemplate: preview.templates[0].back_html,
        fields: Object.fromEntries(
          preview.fields.map((f) => [
            f.name,
            f.name === 'Text' ? CLOZE_SAMPLE : f.rtl ? t('note_types.sample_arabic') : t('note_types.sample_value', { name: f.name }),
          ])
        ),
        css: preview.css,
        templateOrd: 0,
      })
    : null;

  return (
    <Screen
      decor
      header={<Header title={t('note_types.gallery_button')} subtitle={t('note_types.gallery_subtitle')} icon="images" iconTone="pink" onBack={() => router.back()} />}
      overlay={
        <Modal visible={!!preview} animationType="slide" onRequestClose={() => setPreview(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
            <Header
              title={preview?.name ?? ''}
              subtitle={side === 'front' ? t('note_types.tab_front') : t('note_types.tab_back')}
              icon="eye"
              iconTone="sky"
              onBack={() => setPreview(null)}
              rightElement={
                <Chip
                  label={side === 'front' ? t('note_types.show_back') : t('note_types.show_front')}
                  icon="swap-horizontal"
                  onPress={() => setSide(side === 'front' ? 'back' : 'front')}
                />
              }
            />
            {preview && rendered && (
              <>
                <Card padding={0} style={{ flex: 1, margin: 16, overflow: 'hidden' }}>
                  <CardRenderer htmlContent={side === 'front' ? rendered.frontHtml : rendered.backHtml} css={preview.css} templateOrd={0} />
                </Card>
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <Button title={t('note_types.use_preset')} icon="download" size="lg" fullWidth loading={installing === preview.id} onPress={() => usePreset(preview)} />
                </View>
              </>
            )}
          </SafeAreaView>
        </Modal>
      }
    >
      {TEMPLATE_GALLERY_PRESETS.map((preset) => (
        <Card key={preset.id} style={{ marginBottom: 12 }}>
          <Row gap={12} align="flex-start">
            <IconTile icon={preset.isCloze ? 'code-slash' : 'color-palette'} tone={toneForKey(preset.id)} size={46} variant="solid" />
            <View style={{ flex: 1 }}>
              <Row gap={6}>
                <AppText variant="title" weight="extrabold" style={{ flex: 1 }}>
                  {preset.name}
                </AppText>
                {preset.isCloze && <Badge size="sm" variant="accent" label={t('note_types.cloze')} />}
              </Row>
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                {preset.description}
              </AppText>
              <AppText variant="caption" color="textMuted" style={{ marginTop: 6 }}>
                {t('note_types.fields_list', { list: preset.fields.map((f) => f.name).join(', ') })}
              </AppText>
            </View>
          </Row>
          <Row gap={8} style={{ marginTop: 12 }}>
            <Button
              title={t('note_types.preview')}
              icon="eye"
              variant="ghost"
              size="sm"
              onPress={() => {
                setPreview(preset);
                setSide('front');
              }}
              style={{ flex: 1 }}
            />
            <Button title={t('note_types.use_preset')} icon="download" size="sm" loading={installing === preset.id} onPress={() => usePreset(preset)} style={{ flex: 1 }} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
