import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, ListGroup, ListItem, BottomSheet, TextField, Button, Row } from '../../components/ui';
import { checkDatabaseIntegrity } from '../../core/db/connection';
import { mediaManager } from '../../core/media/mediaManager';
import { browserRepository } from '../../core/db/repositories/browserRepository';
import { formatBytes } from '../../core/utils/format';

/** Duplicate groups listed in the result dialog. */
const DUPLICATE_PREVIEW = 5;

export default function ToolsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [findOpen, setFindOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [replace, setReplace] = useState('');
  const [media, setMedia] = useState({ count: 0, totalSizeBytes: 0 });

  useEffect(() => {
    mediaManager.getStorageStats().then(setMedia);
  }, []);

  const checkDb = async () => {
    const res = await checkDatabaseIntegrity();
    if (res.ok) CustomAlert.alert(t('tools.db_ok_title'), t('tools.db_ok'));
    else CustomAlert.alert(t('common.warning'), res.message);
  };

  const checkMedia = async () => {
    const stats = await mediaManager.getStorageStats();
    setMedia(stats);
    CustomAlert.alert(t('tools.media_title'), t('tools.media_found', { count: stats.count }));
  };

  const checkEmpty = async () => {
    const empty = await browserRepository.findEmptyCards();
    if (empty.length === 0) {
      CustomAlert.alert(t('tools.empty_cards'), t('tools.empty_none'));
      return;
    }
    CustomAlert.alert(t('tools.empty_found_title'), t('tools.empty_found', { count: empty.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await browserRepository.deleteEmptyCards(empty.map((e) => e.cardId));
          CustomAlert.alert(t('common.done'), t('tools.empty_deleted', { count: empty.length }));
        },
      },
    ]);
  };

  const findDuplicates = async () => {
    const dups = await browserRepository.findDuplicates();
    if (dups.length === 0) {
      CustomAlert.alert(t('tools.duplicates'), t('tools.dup_none'));
      return;
    }
    const summary = dups
      .slice(0, DUPLICATE_PREVIEW)
      .map((d) => `"${d.sortField}": ${d.count}`)
      .join('\n');
    CustomAlert.alert(t('tools.dup_found_title'), t('tools.dup_found', { count: dups.length, summary }));
  };

  const runReplace = async () => {
    if (!search.trim()) return;
    try {
      const count = await browserRepository.findAndReplace(search.trim(), replace.trim());
      setFindOpen(false);
      CustomAlert.alert(t('common.done'), t('tools.replaced', { count }));
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const vacuum = async () => {
    try {
      await browserRepository.vacuumDatabase();
      CustomAlert.alert(t('common.done'), t('tools.vacuum_done'));
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  return (
    <Screen
      decor
      header={<Header title={t('tools.title')} subtitle={t('tools.subtitle')} icon="construct" iconTone="teal" onBack={() => router.back()} />}
      overlay={
        <BottomSheet
          visible={findOpen}
          onClose={() => setFindOpen(false)}
          title={t('tools.find_replace')}
          icon="swap-horizontal"
          tone="sky"
          footer={
            <Row gap={10}>
              <Button title={t('common.cancel')} variant="ghost" onPress={() => setFindOpen(false)} style={{ flex: 1 }} />
              <Button title={t('tools.replace_run')} icon="checkmark" disabled={!search.trim()} onPress={runReplace} style={{ flex: 1 }} />
            </Row>
          }
        >
          <TextField label={t('tools.find_label')} value={search} onChangeText={setSearch} placeholder={t('tools.find_placeholder')} icon="search" autoFocus />
          <TextField label={t('tools.replace_label')} value={replace} onChangeText={setReplace} placeholder={t('tools.replace_placeholder')} icon="swap-horizontal" style={{ marginBottom: 0 }} />
        </BottomSheet>
      }
    >
      <ListGroup title={t('tools.group_content')}>
        <ListItem icon="layers" tone="violet" title={t('tools.note_types')} subtitle={t('tools.note_types_desc')} onPress={() => router.push('/note-types')} />
        <ListItem icon="pricetags" tone="green" title={t('tools.tags')} subtitle={t('tools.tags_desc')} onPress={() => router.push('/tools/tags')} />
        <ListItem icon="swap-horizontal" tone="sky" title={t('tools.find_replace')} subtitle={t('tools.find_replace_desc')} onPress={() => setFindOpen(true)} />
        <ListItem icon="copy" tone="amber" title={t('tools.duplicates')} subtitle={t('tools.duplicates_desc')} onPress={findDuplicates} />
        <ListItem icon="trash" tone="rose" title={t('tools.empty_cards')} subtitle={t('tools.empty_desc')} onPress={checkEmpty} />
      </ListGroup>

      <ListGroup title={t('tools.group_maintenance')}>
        <ListItem icon="shield-checkmark" tone="green" title={t('tools.db_check')} subtitle={t('tools.db_check_desc')} onPress={checkDb} />
        <ListItem
          icon="folder"
          tone="orange"
          title={t('tools.media')}
          subtitle={t('tools.media_desc', { count: media.count, size: formatBytes(media.totalSizeBytes) })}
          onPress={checkMedia}
        />
        <ListItem icon="flash" tone="indigo" title={t('tools.vacuum')} subtitle={t('tools.vacuum_desc')} onPress={vacuum} />
      </ListGroup>
    </Screen>
  );
}
