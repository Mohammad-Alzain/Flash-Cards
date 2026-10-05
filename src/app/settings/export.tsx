import React, { useState } from 'react';
import { View, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../components/common/CustomDialog';
import { Screen, Header, Card, Button, SectionHeader, ChipPicker } from '../../components/ui';
import { deckRepository, DeckWithCounts } from '../../core/db/repositories/deckRepository';
import { useFocusData } from '../../hooks/useFocusData';
import { useExporter } from '../../features/export/useExporter';
import { ExportOptionsForm, ExportProgressView } from '../../features/export/components/ExportParts';

const ALL = '__all__';

export default function ExportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deckId?: string }>();
  const { t } = useTranslation();
  const [deckId, setDeckId] = useState<string>(params.deckId || ALL);
  const ex = useExporter();
  const { data: decks } = useFocusData<DeckWithCounts[]>(() => deckRepository.getAllWithCounts(), [], 'export decks');
  const [action, setAction] = useState<'save' | 'share' | null>(null);

  // One-step flow: build the file, then save it or open the share sheet.
  const exportAnd = async (next: 'save' | 'share') => {
    setAction(next);
    const res = await ex.runExport(deckId === ALL ? undefined : deckId);
    if (res) {
      if (next === 'save') await ex.save(res);
      else await ex.share(res);
    }
    setAction(null);
  };

  // Surface failures from the hook as alerts on this screen.
  React.useEffect(() => {
    if (ex.error) CustomAlert.alert(t('common.error'), ex.error);
  }, [ex.error, t]);

  const busy = action !== null;
  const options = [{ id: ALL, name: t('export.allDecks') }, ...decks.map((d) => ({ id: d.id, name: d.name }))];

  return (
    <Screen
      decor
      header={<Header title={t('export.title')} subtitle={t('export.subtitle')} icon="share-social" iconTone="orange" onBack={() => router.back()} />}
      overlay={
        <Modal visible={ex.busy === 'export'} transparent animationType="fade" statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(8,10,25,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Card style={{ width: '100%' }}>
              <ExportProgressView ex={ex} />
            </Card>
          </View>
        </Modal>
      }
    >
      <SectionHeader title={t('export.selectDeck')} icon="albums" tone="violet" />
      <View style={{ marginBottom: 20 }}>
        <ChipPicker items={options} selectedId={deckId} onSelect={setDeckId} getId={(o) => o.id} getLabel={(o) => o.name} />
      </View>

      <SectionHeader title={t('export.format')} icon="document" tone="indigo" />
      <ExportOptionsForm ex={ex} />

      <Button
        title={action === 'save' ? t('export.savingToDevice') : t('export.saveToDevice')}
        icon="download"
        size="lg"
        fullWidth
        loading={action === 'save'}
        disabled={busy}
        onPress={() => exportAnd('save')}
        style={{ marginBottom: 10 }}
      />
      <Button
        title={action === 'share' ? t('export.preparingShare') : t('export.shareFile')}
        icon="share-social"
        variant="ghost"
        size="lg"
        fullWidth
        loading={action === 'share'}
        disabled={busy}
        onPress={() => exportAnd('share')}
      />
    </Screen>
  );
}
