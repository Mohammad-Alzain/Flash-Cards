import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { CustomAlert } from '../../../components/common/CustomDialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { isRTL } from '../../../i18n';
import { Header, Card, Button, Chip } from '../../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { CardRenderer } from '../../../components/card/CardRenderer';
import { noteRepository } from '../../../core/db/repositories/noteRepository';
import { NoteType, CardTemplateDef, NoteFieldDef, NoteTypeVersion } from '../../../core/types/models';
import { renderCard } from '../../../core/render/templateEngine';

export default function TemplatesEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, spacing, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [noteType, setNoteType] = useState<NoteType | null>(null);
  const [fields, setFields] = useState<NoteFieldDef[]>([]);
  const [templates, setTemplates] = useState<CardTemplateDef[]>([]);
  const [css, setCss] = useState('');
  const [activeTemplateIdx, setActiveTemplateIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'front' | 'back' | 'css'>('front');

  // Preview Modal
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [previewNightMode, setPreviewNightMode] = useState(isDark);

  // Versions Modal
  const [versionsModalVisible, setVersionsModalVisible] = useState(false);
  const [versions, setVersions] = useState<NoteTypeVersion[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      noteRepository.getNoteTypeById(id).then((nt) => {
        if (nt) {
          setNoteType(nt);
          try {
            setFields(JSON.parse(nt.fields_json || '[]'));
          } catch (e) {
            setFields([]);
          }
          try {
            setTemplates(JSON.parse(nt.templates_json || '[]'));
          } catch (e) {
            setTemplates([]);
          }
          setCss(nt.css || '');
        }
      });
    }
  }, [id]);

  const activeTemplate = templates[activeTemplateIdx] || {
    id: 't_default',
    name: 'Card 1',
    order: 0,
    front_html: '',
    back_html: '',
  };

  const handleUpdateFront = (text: string) => {
    const updated = [...templates];
    updated[activeTemplateIdx] = { ...updated[activeTemplateIdx], front_html: text };
    setTemplates(updated);
  };

  const handleUpdateBack = (text: string) => {
    const updated = [...templates];
    updated[activeTemplateIdx] = { ...updated[activeTemplateIdx], back_html: text };
    setTemplates(updated);
  };

  const handleInsertField = (fieldName: string) => {
    const tag = `{{${fieldName}}}`;
    if (activeTab === 'front') {
      handleUpdateFront(activeTemplate.front_html + ' ' + tag);
    } else if (activeTab === 'back') {
      handleUpdateBack(activeTemplate.back_html + ' ' + tag);
    }
  };

  const handleSave = async () => {
    if (!noteType) return;
    setSaving(true);
    try {
      await noteRepository.updateNoteType(noteType.id, {
        templates,
        css,
      });
      CustomAlert.alert(t('common.done'), t('note_types.save') + '!');
      router.back();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenVersions = async () => {
    if (!noteType) return;
    const vList = await noteRepository.getVersions(noteType.id);
    setVersions(vList);
    setVersionsModalVisible(true);
  };

  const handleRestoreVersion = async (vId: string) => {
    try {
      await noteRepository.restoreVersion(vId);
      CustomAlert.alert(t('common.done'), 'Version restored successfully!');
      setVersionsModalVisible(false);
      // Reload
      const reloaded = await noteRepository.getNoteTypeById(noteType!.id);
      if (reloaded) {
        setTemplates(JSON.parse(reloaded.templates_json || '[]'));
        setCss(reloaded.css || '');
      }
    } catch (err: any) {
      CustomAlert.alert(t('common.error'), err.message);
    }
  };

  // Generate sample preview
  const sampleFields: Record<string, string> = {};
  fields.forEach((f) => {
    sampleFields[f.name] = f.rtl ? 'نص تجريبي للمعاينة' : `Sample ${f.name}`;
  });

  const rendered = renderCard({
    frontTemplate: activeTemplate.front_html,
    backTemplate: activeTemplate.back_html,
    fields: sampleFields,
    css,
    templateOrd: activeTemplateIdx,
    templateName: activeTemplate.name,
    noteTypeName: noteType?.name || 'Basic',
    isNightMode: previewNightMode,
  });

  if (!noteType) return null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('note_types.templates_title')}
        subtitle={noteType.name}
        onBack={() => router.back()}
        rightElement={
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
            <Button
              icon={<Ionicons name="time-outline" size={18} color={colors.primary} />}
              variant="ghost"
              size="sm"
              onPress={handleOpenVersions}
            />
            <Button
              title={t('common.save')}
              variant="primary"
              size="sm"
              loading={saving}
              onPress={handleSave}
            />
          </View>
        }
      />

      {/* Templates Selector (if multiple) */}
      {templates.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tplSelectorBar} contentContainerStyle={{ gap: 6 }}>
          {templates.map((tpl, i) => (
            <Chip
              key={tpl.id || i}
              label={tpl.name}
              selected={i === activeTemplateIdx}
              onPress={() => setActiveTemplateIdx(i)}
            />
          ))}
        </ScrollView>
      )}

      {/* Tabs: Front | Back | Styling (CSS) */}
      <View style={[styles.tabsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={() => setActiveTab('front')}
          style={[
            styles.tabItem,
            activeTab === 'front' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'front' ? colors.primary : colors.textSecondary,
                fontWeight: activeTab === 'front' ? 'bold' : 'normal',
              },
            ]}
          >
            {t('note_types.tab_front')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('back')}
          style={[
            styles.tabItem,
            activeTab === 'back' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'back' ? colors.primary : colors.textSecondary,
                fontWeight: activeTab === 'back' ? 'bold' : 'normal',
              },
            ]}
          >
            {t('note_types.tab_back')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('css')}
          style={[
            styles.tabItem,
            activeTab === 'css' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'css' ? colors.primary : colors.textSecondary,
                fontWeight: activeTab === 'css' ? 'bold' : 'normal',
              },
            ]}
          >
            {t('note_types.tab_css')}
          </Text>
        </Pressable>
      </View>

      {/* Code Textarea */}
      <View style={[styles.editorContainer, { backgroundColor: colors.surfaceRaised }]}>
        {activeTab === 'front' && (
          <TextInput
            value={activeTemplate.front_html}
            onChangeText={handleUpdateFront}
            multiline
            style={[styles.codeEditor, { color: colors.text }]}
            placeholder="<div>{{Front}}</div>"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        {activeTab === 'back' && (
          <TextInput
            value={activeTemplate.back_html}
            onChangeText={handleUpdateBack}
            multiline
            style={[styles.codeEditor, { color: colors.text }]}
            placeholder="{{FrontSide}}<hr id='answer'><div>{{Back}}</div>"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        {activeTab === 'css' && (
          <TextInput
            value={css}
            onChangeText={setCss}
            multiline
            style={[styles.codeEditor, { color: colors.text }]}
            placeholder=".card { font-size: 20px; }"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      </View>

      {/* Bottom Field Insertion Toolbar */}
      <View style={[styles.bottomToolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[styles.insertHeaderRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 'bold' }}>
            {t('note_types.insert_field')}:
          </Text>
          <Button
            title={t('note_types.preview')}
            icon={<Ionicons name="eye-outline" size={16} color={colors.primary} />}
            variant="secondary"
            size="sm"
            onPress={() => setPreviewVisible(true)}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={{ gap: 6 }}>
          {fields.map((f) => (
            <Chip
              key={f.id}
              label={f.name}
              onPress={() => handleInsertField(f.name)}
            />
          ))}
          {activeTab === 'back' && (
            <Chip
              label="FrontSide"
              onPress={() => handleInsertField('FrontSide')}
            />
          )}
        </ScrollView>
      </View>

      {/* Live Preview Modal */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
          <Header
            title={t('note_types.preview')}
            subtitle={`${activeTemplate.name} (${previewSide.toUpperCase()})`}
            onBack={() => setPreviewVisible(false)}
            rightElement={
              <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                <Button
                  title={previewSide === 'front' ? (rtl ? 'إظهار الظهر' : 'Show Back') : (rtl ? 'إظهار الوجه' : 'Show Front')}
                  variant="ghost"
                  size="sm"
                  onPress={() => setPreviewSide(previewSide === 'front' ? 'back' : 'front')}
                />
                <Button
                  icon={<Ionicons name={previewNightMode ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text} />}
                  variant="ghost"
                  size="sm"
                  onPress={() => setPreviewNightMode(!previewNightMode)}
                />
              </View>
            }
          />

          <View style={styles.previewContainer}>
            <CardRenderer
              htmlContent={previewSide === 'front' ? rendered.frontHtml : rendered.backHtml}
              css={css}
              templateOrd={activeTemplateIdx}
              isNightMode={previewNightMode}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Version History Modal */}
      <Modal
        visible={versionsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setVersionsModalVisible(false)}
      >
        <View style={styles.versionsBackdrop}>
          <Card style={[styles.versionsCard, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[styles.versionsHeading, { color: colors.text, textAlign: rtl ? 'right' : 'left' }]}>
              {rtl ? 'النسخ السابقة للقالب (آخر 10)' : 'Template Versions (Last 10)'}
            </Text>

            <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
              {versions.length === 0 ? (
                <Text style={{ color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }}>
                  {rtl ? 'لا توجد نسخ محفوظة بعد.' : 'No saved snapshots yet.'}
                </Text>
              ) : (
                versions.map((v, i) => (
                  <View key={v.id} style={[styles.versionItem, { borderBottomColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <Text style={{ color: colors.text, fontSize: 13 }}>
                      {rtl ? 'حُفظت: ' : 'Saved: '}{new Date(v.saved_at).toLocaleString()}
                    </Text>
                    <Button
                      title={rtl ? 'استعادة' : 'Restore'}
                      variant="ghost"
                      size="sm"
                      onPress={() => handleRestoreVersion(v.id)}
                    />
                  </View>
                ))
              )}
            </ScrollView>

            <Button
              title={t('common.close')}
              variant="primary"
              size="md"
              onPress={() => setVersionsModalVisible(false)}
            />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  tplSelectorBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
  },
  editorContainer: {
    flex: 1,
    padding: 12,
  },
  codeEditor: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
  },
  bottomToolbar: {
    borderTopWidth: 1,
    padding: 12,
  },
  insertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  modalSafe: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    padding: 16,
  },
  versionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  versionsCard: {
    padding: 20,
  },
  versionsHeading: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  versionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
});
