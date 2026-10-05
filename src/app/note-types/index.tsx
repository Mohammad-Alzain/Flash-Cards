import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { CustomAlert } from '../../components/common/CustomDialog';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { isRTL } from '../../i18n';
import { Header, Card, Button, Badge, TextField } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import {
  noteRepository,
  NoteTypeWithCounts,
} from '../../core/db/repositories/noteRepository';

export default function NoteTypesScreen() {
  const { colors, typography, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const rtl = isRTL();

  const [noteTypes, setNoteTypes] = useState<NoteTypeWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  // New Note Type Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await noteRepository.getAllNoteTypesWithCounts();
      setNoteTypes(data);
    } catch (e) {
      console.error('Failed to load note types:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCreateNew = async () => {
    if (!newTypeName.trim()) return;
    try {
      const created = await noteRepository.createNoteType({
        name: newTypeName.trim(),
        fields: [
          { id: 'f_front', name: 'Front', order: 0, rtl: false },
          { id: 'f_back', name: 'Back', order: 1, rtl: false },
        ],
        templates: [
          {
            id: 't_c1',
            name: 'Card 1',
            order: 0,
            front_html: '<div class="card">{{Front}}</div>',
            back_html: '{{FrontSide}}<hr id="answer"><div class="card">{{Back}}</div>',
          },
        ],
      });
      setNewTypeName('');
      setModalVisible(false);
      await loadData();
      router.push(`/note-types/${created.id}/fields`);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const handleDelete = (nt: NoteTypeWithCounts) => {
    if (nt.notes_count > 0) {
      CustomAlert.alert(t('common.warning'), t('note_types.cannot_delete'));
      return;
    }
    CustomAlert.alert(
      t('common.delete'),
      t('note_types.delete_type_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await noteRepository.deleteNoteType(nt.id);
              await loadData();
            } catch (err: any) {
              CustomAlert.alert(t('common.error'), err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        title={t('note_types.title')}
        onBack={() => router.back()}
        rightElement={
          <Button
            title={t('note_types.gallery_button')}
            variant="ghost"
            size="sm"
            onPress={() => router.push('/note-types/gallery')}
          />
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        <Button
          title={`+ ${t('note_types.new_type')}`}
          variant="primary"
          size="md"
          onPress={() => setModalVisible(true)}
          style={{ marginBottom: spacing.lg }}
        />

        {noteTypes.map((nt) => (
          <Card key={nt.id} style={[styles.noteTypeCard, { marginBottom: spacing.md }]}>
            <View style={[styles.headerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={styles.titleCol}>
                <Text
                  style={[
                    styles.typeName,
                    {
                      color: colors.text,
                      fontSize: typography.sizes.lg,
                      fontWeight: typography.weights.bold,
                      textAlign: rtl ? 'right' : 'left',
                    },
                  ]}
                >
                  {nt.name}
                </Text>
                <Text
                  style={[
                    styles.notesCount,
                    {
                      color: colors.textSecondary,
                      fontSize: typography.sizes.xs,
                      textAlign: rtl ? 'right' : 'left',
                      marginTop: 2,
                    },
                  ]}
                >
                  {t('note_types.notes_using', { count: nt.notes_count })}
                </Text>
              </View>

              {nt.is_cloze === 1 && (
                <Badge count="Cloze" variant="accent" size="sm" />
              )}
            </View>

            {/* Actions for Fields and Templates */}
            <View style={[styles.actionsRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8, marginTop: spacing.md }]}>
              <Button
                title={t('note_types.fields_button', { count: nt.fields_count })}
                variant="ghost"
                size="sm"
                onPress={() => router.push(`/note-types/${nt.id}/fields`)}
                style={{ flex: 1 }}
              />

              <Button
                title={t('note_types.templates_button', { count: nt.templates_count })}
                variant="secondary"
                size="sm"
                onPress={() => router.push(`/note-types/${nt.id}/templates`)}
                style={{ flex: 1 }}
              />

              {nt.notes_count === 0 && (
                <Button
                  icon={<Ionicons name="trash-outline" size={16} color="#FFFFFF" />}
                  variant="danger"
                  size="sm"
                  onPress={() => handleDelete(nt)}
                />
              )}
            </View>
          </Card>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* New Note Type Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={[styles.modalCard, { backgroundColor: colors.surfaceRaised }]}>
            <Text
              style={[
                styles.modalHeading,
                {
                  color: colors.text,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                  textAlign: rtl ? 'right' : 'left',
                  marginBottom: spacing.md,
                },
              ]}
            >
              {t('note_types.new_type')}
            </Text>

            <TextField
              label={t('note_types.name_label')}
              value={newTypeName}
              onChangeText={setNewTypeName}
              placeholder="e.g. Vocabulary, Medical, Grammar..."
            />

            <View style={[styles.modalBtnRow, { flexDirection: rtl ? 'row-reverse' : 'row', gap: 8, marginTop: spacing.md }]}>
              <Button
                title={t('common.cancel')}
                variant="ghost"
                size="md"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={t('common.save')}
                variant="primary"
                size="md"
                onPress={handleCreateNew}
                style={{ flex: 1 }}
              />
            </View>
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
  content: {},
  noteTypeCard: {},
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleCol: {
    flex: 1,
  },
  typeName: {},
  notesCount: {},
  actionsRow: {
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    padding: 24,
  },
  modalHeading: {},
  modalBtnRow: {},
});
