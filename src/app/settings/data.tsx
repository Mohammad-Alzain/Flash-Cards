import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Row, StatTile, ListGroup, ListItem, SectionHeader } from '../../components/ui';
import { checkDatabaseIntegrity, optimizeDatabase, resetDatabase } from '../../core/db/connection';
import { deckRepository } from '../../core/db/repositories/deckRepository';
import { cardRepository } from '../../core/db/repositories/cardRepository';
import { noteRepository } from '../../core/db/repositories/noteRepository';
import { useFocusData } from '../../hooks/useFocusData';

type Busy = 'check' | 'optimize' | 'reset' | null;

export default function DataSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [busy, setBusy] = useState<Busy>(null);
  const { data, reload } = useFocusData(
    async () => {
      const [decks, cards, notes] = await Promise.all([
        deckRepository.getAllWithCounts(),
        cardRepository.getTotalCount(),
        noteRepository.getTotalCount(),
      ]);
      return { decks: decks.length, cards, notes };
    },
    { decks: 0, cards: 0, notes: 0 },
    'storage'
  );

  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    } finally {
      setBusy(null);
    }
  };

  const checkIntegrity = () =>
    run('check', async () => {
      const result = await checkDatabaseIntegrity();
      if (result.ok) CustomAlert.alert(t('settings.integrity_check'), t('settings.integrity_ok'));
      else CustomAlert.alert(t('common.warning'), result.message);
    });

  const optimize = () =>
    run('optimize', async () => {
      await optimizeDatabase();
      CustomAlert.alert(t('data.optimized_title'), t('data.optimized_msg'));
    });

  const confirmReset = () =>
    CustomAlert.alert(t('data.reset_confirm_title'), t('data.reset_confirm_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('data.reset_yes'),
        style: 'destructive',
        onPress: () =>
          run('reset', async () => {
            await resetDatabase();
            await reload();
            CustomAlert.alert(t('data.reset_done_title'), t('data.reset_done_msg'));
          }),
      },
    ]);

  const spinner = (kind: Busy) => (busy === kind ? <ActivityIndicator color={colors.primary} /> : undefined);

  return (
    <Screen decor header={<Header title={t('settings.database')} subtitle={t('data.subtitle')} icon="server" iconTone="slate" onBack={() => router.back()} />}>
      <SectionHeader title={t('data.storage_title')} icon="pie-chart" tone="sky" />
      <Row gap={8} align="stretch" style={{ marginBottom: 22 }}>
        <StatTile layout="compact" icon="albums" tone="violet" value={data.decks} label={t('data.decks')} />
        <StatTile layout="compact" icon="copy" tone="sky" value={data.cards} label={t('data.cards')} />
        <StatTile layout="compact" icon="document-text" tone="teal" value={data.notes} label={t('data.notes')} />
      </Row>

      <ListGroup title={t('data.maintenance_title')} footer={t('data.maintenance_desc')}>
        <ListItem
          icon="shield-checkmark"
          tone="green"
          title={t('settings.integrity_check')}
          subtitle={t('data.integrity_desc')}
          onPress={busy ? undefined : checkIntegrity}
          trailing={spinner('check')}
          showChevron={busy !== 'check'}
        />
        <ListItem
          icon="sparkles"
          tone="indigo"
          title={t('data.optimize')}
          subtitle={t('data.optimize_desc')}
          onPress={busy ? undefined : optimize}
          trailing={spinner('optimize')}
          showChevron={busy !== 'optimize'}
        />
      </ListGroup>

      <ListGroup title={t('data.danger_title')}>
        <ListItem
          icon="trash-bin"
          destructive
          title={t('data.reset')}
          subtitle={t('data.reset_desc')}
          onPress={busy ? undefined : confirmReset}
          trailing={spinner('reset')}
          showChevron={busy !== 'reset'}
        />
      </ListGroup>
    </Screen>
  );
}
