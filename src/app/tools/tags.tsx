import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toneForKey } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Card, Row, AppText, IconButton, IconTile, EmptyState, BottomSheet, TextField, Button, SearchBar } from '../../components/ui';
import { browserRepository } from '../../core/db/repositories/browserRepository';
import { useFocusData } from '../../hooks/useFocusData';

export default function TagsManagerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: tags, reload } = useFocusData<{ tag: string; count: number }[]>(() => browserRepository.getAllTagsWithCounts(), [], 'tags');
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');

  const rename = async () => {
    if (!renameTarget || !newName.trim()) return;
    try {
      await browserRepository.renameTag(renameTarget, newName.trim());
      setRenameTarget(null);
      setNewName('');
      await reload();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const remove = (tag: string) =>
    CustomAlert.alert(t('common.delete'), t('tags_manager.delete_msg', { tag }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await browserRepository.deleteTag(tag);
          await reload();
        },
      },
    ]);

  const visible = query.trim() ? tags.filter((x) => x.tag.toLowerCase().includes(query.trim().toLowerCase())) : tags;

  return (
    <Screen
      decor
      header={<Header title={t('tools.tags')} subtitle={t('tags_manager.subtitle', { count: tags.length })} icon="pricetags" iconTone="green" onBack={() => router.back()} />}
      overlay={
        <BottomSheet
          visible={!!renameTarget}
          onClose={() => setRenameTarget(null)}
          title={t('tags_manager.rename_title')}
          subtitle={renameTarget ?? undefined}
          icon="create"
          tone="green"
          footer={
            <Row gap={10}>
              <Button title={t('common.cancel')} variant="ghost" onPress={() => setRenameTarget(null)} style={{ flex: 1 }} />
              <Button title={t('common.save')} icon="checkmark" disabled={!newName.trim()} onPress={rename} style={{ flex: 1 }} />
            </Row>
          }
        >
          <TextField label={t('tags_manager.new_name')} value={newName} onChangeText={setNewName} icon="pricetag" autoFocus clearButton style={{ marginBottom: 0 }} />
        </BottomSheet>
      }
    >
      {tags.length === 0 ? (
        <EmptyState illustration="search" title={t('tags_manager.empty_title')} description={t('tags_manager.empty_desc')} />
      ) : (
        <>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t('tags_manager.search')} style={{ marginBottom: 14 }} />
          {visible.map((item) => (
            <Card key={item.tag} padding={12} style={{ marginBottom: 10 }}>
              <Row gap={12}>
                <IconTile icon="pricetag" tone={toneForKey(item.tag)} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {item.tag}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {t('tags_manager.used_in', { count: item.count })}
                  </AppText>
                </View>
                <IconButton
                  icon="create"
                  variant="tinted"
                  size={38}
                  onPress={() => {
                    setRenameTarget(item.tag);
                    setNewName(item.tag);
                  }}
                  accessibilityLabel={t('tools.rename')}
                />
                <IconButton icon="trash" variant="danger" size={38} onPress={() => remove(item.tag)} accessibilityLabel={t('common.delete')} />
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
