import React, { useState, useEffect } from 'react';
import { View, TextInput, Modal, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { CustomAlert } from '../../../components/common/CustomDialog';
import { Header, Button, IconButton, SegmentedControl, ChipPicker, Chip, Row, AppText, BottomSheet, Card, EmptyState } from '../../../components/ui';
import { CardRenderer } from '../../../components/card/CardRenderer';
import { noteRepository } from '../../../core/db/repositories/noteRepository';
import { NoteType, CardTemplateDef, NoteFieldDef, NoteTypeVersion } from '../../../core/types/models';
import { renderCard } from '../../../core/render/templateEngine';

type EditorTab = 'front' | 'back' | 'css';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const EMPTY_TEMPLATE: CardTemplateDef = { id: 't_default', name: 'Card 1', order: 0, front_html: '', back_html: '' };

export default function TemplatesEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [noteType, setNoteType] = useState<NoteType | null>(null);
  const [fields, setFields] = useState<NoteFieldDef[]>([]);
  const [templates, setTemplates] = useState<CardTemplateDef[]>([]);
  const [css, setCss] = useState('');
  const [tplIdx, setTplIdx] = useState(0);
  const [tab, setTab] = useState<EditorTab>('front');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [previewNight, setPreviewNight] = useState(isDark);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<NoteTypeVersion[]>([]);
  const [saving, setSaving] = useState(false);

  const applyNoteType = (nt: NoteType) => {
    try {
      setFields(JSON.parse(nt.fields_json || '[]'));
    } catch {
      setFields([]);
    }
    try {
      setTemplates(JSON.parse(nt.templates_json || '[]'));
    } catch {
      setTemplates([]);
    }
    setCss(nt.css || '');
  };

  useEffect(() => {
    if (!id) return;
    noteRepository.getNoteTypeById(id).then((nt) => {
      if (nt) {
        setNoteType(nt);
        applyNoteType(nt);
      }
    });
  }, [id]);

  const active = templates[tplIdx] || EMPTY_TEMPLATE;

  const patchActive = (patch: Partial<CardTemplateDef>) =>
    setTemplates(templates.map((tpl, i) => (i === tplIdx ? { ...tpl, ...patch } : tpl)));

  const insertField = (name: string) => {
    const tag = `{{${name}}}`;
    if (tab === 'front') patchActive({ front_html: `${active.front_html} ${tag}` });
    else if (tab === 'back') patchActive({ back_html: `${active.back_html} ${tag}` });
  };

  const save = async () => {
    if (!noteType) return;
    setSaving(true);
    try {
      await noteRepository.updateNoteType(noteType.id, { templates, css });
      CustomAlert.alert(t('common.done'), t('note_types.saved_msg'));
      router.back();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const openVersions = async () => {
    if (!noteType) return;
    setVersions(await noteRepository.getVersions(noteType.id));
    setVersionsOpen(true);
  };

  const restore = async (versionId: string) => {
    try {
      await noteRepository.restoreVersion(versionId);
      CustomAlert.alert(t('common.done'), t('note_types.restored_msg'));
      setVersionsOpen(false);
      const reloaded = await noteRepository.getNoteTypeById(noteType!.id);
      if (reloaded) applyNoteType(reloaded);
    } catch (err: any) {
      CustomAlert.alert(t('common.error'), err.message);
    }
  };

  if (!noteType) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const sampleFields = Object.fromEntries(
    fields.map((f) => [f.name, f.rtl ? t('note_types.sample_rtl') : t('note_types.sample_ltr', { name: f.name })])
  );
  const rendered = renderCard({
    frontTemplate: active.front_html,
    backTemplate: active.back_html,
    fields: sampleFields,
    css,
    templateOrd: tplIdx,
    templateName: active.name,
    noteTypeName: noteType.name || 'Basic',
    isNightMode: previewNight,
  });

  const editorValue = tab === 'front' ? active.front_html : tab === 'back' ? active.back_html : css;
  const onEditorChange = (text: string) =>
    tab === 'front' ? patchActive({ front_html: text }) : tab === 'back' ? patchActive({ back_html: text }) : setCss(text);
  const placeholder =
    tab === 'front' ? '<div>{{Front}}</div>' : tab === 'back' ? "{{FrontSide}}<hr id='answer'><div>{{Back}}</div>" : '.card { font-size: 20px; }';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <Header
        title={t('note_types.templates_title')}
        subtitle={noteType.name}
        icon="color-palette"
        iconTone="violet"
        onBack={() => router.back()}
        rightElement={
          <>
            <IconButton icon="time" onPress={openVersions} accessibilityLabel={t('note_types.history')} />
            <Button title={t('common.save')} icon="checkmark" size="sm" loading={saving} onPress={save} />
          </>
        }
      />

      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 10 }}>
        {templates.length > 1 && (
          <ChipPicker items={templates.map((tpl, i) => ({ id: String(i), name: tpl.name }))} selectedId={String(tplIdx)} onSelect={(v) => setTplIdx(Number(v))} getId={(x) => x.id} getLabel={(x) => x.name} icon="albums" />
        )}
        <SegmentedControl<EditorTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'front', label: t('note_types.tab_front'), icon: 'arrow-forward-circle' },
            { value: 'back', label: t('note_types.tab_back'), icon: 'arrow-back-circle' },
            { value: 'css', label: t('note_types.tab_css'), icon: 'brush' },
          ]}
        />
      </View>

      {/* Code editor */}
      <View style={{ flex: 1, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: isDark ? '#0B0E1A' : '#1E2235' }}>
        <Row gap={6} style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <View key={c} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
          ))}
          <AppText variant="caption" color="rgba(255,255,255,0.6)" style={{ marginStart: 6 }}>
            {tab === 'css' ? 'style.css' : `${active.name} · ${tab}.html`}
          </AppText>
        </Row>
        <TextInput
          value={editorValue}
          onChangeText={onEditorChange}
          multiline
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
          style={{ flex: 1, padding: 14, color: '#E6EDF7', fontFamily: MONO, fontSize: 13.5, lineHeight: 20, textAlign: 'left', writingDirection: 'ltr' }}
        />
      </View>

      {/* Field insertion toolbar */}
      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 }}>
        <Row justify="space-between" style={{ marginBottom: 8 }}>
          <AppText variant="bodySm" weight="bold" color="textSecondary">
            {t('note_types.insert_field')}
          </AppText>
          <Button title={t('note_types.preview')} icon="eye" variant="soft" size="sm" onPress={() => setPreviewOpen(true)} />
        </Row>
        <ChipPicker
          items={[...fields.map((f) => ({ id: f.id, name: f.name })), ...(tab === 'back' ? [{ id: '__front_side', name: 'FrontSide' }] : [])]}
          selectedId=""
          onSelect={(fid) => insertField(fid === '__front_side' ? 'FrontSide' : fields.find((f) => f.id === fid)?.name ?? '')}
          getId={(x) => x.id}
          getLabel={(x) => `{{${x.name}}}`}
          icon="add"
        />
      </SafeAreaView>

      {/* Live preview */}
      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
          <Header
            title={t('note_types.preview')}
            subtitle={`${active.name} · ${previewSide === 'front' ? t('note_types.tab_front') : t('note_types.tab_back')}`}
            icon="eye"
            iconTone="sky"
            onBack={() => setPreviewOpen(false)}
            rightElement={
              <>
                <Chip
                  label={previewSide === 'front' ? t('note_types.show_back') : t('note_types.show_front')}
                  icon="swap-horizontal"
                  onPress={() => setPreviewSide(previewSide === 'front' ? 'back' : 'front')}
                />
                <IconButton icon={previewNight ? 'sunny' : 'moon'} onPress={() => setPreviewNight(!previewNight)} />
              </>
            }
          />
          <Card padding={0} style={{ flex: 1, margin: 16, overflow: 'hidden' }}>
            <CardRenderer htmlContent={previewSide === 'front' ? rendered.frontHtml : rendered.backHtml} css={css} templateOrd={tplIdx} isNightMode={previewNight} />
          </Card>
        </SafeAreaView>
      </Modal>

      {/* Version history */}
      <BottomSheet visible={versionsOpen} onClose={() => setVersionsOpen(false)} title={t('note_types.versions_title')} icon="time" tone="amber" scrollable>
        {versions.length === 0 ? (
          <EmptyState compact illustration="sleep" title={t('note_types.versions_empty')} description="" />
        ) : (
          versions.map((v) => (
            <Row key={v.id} justify="space-between" style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }}>
              <AppText variant="bodySm" style={{ flex: 1 }}>
                {t('note_types.saved_at', { date: new Date(v.saved_at).toLocaleString() })}
              </AppText>
              <Button title={t('note_types.restore')} icon="refresh" variant="soft" size="sm" onPress={() => restore(v.id)} />
            </Row>
          ))
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
