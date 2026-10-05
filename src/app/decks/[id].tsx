import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { CustomAlert } from '../../components/common/CustomDialog';
import {
  Screen,
  Header,
  IconButton,
  Button,
  Card,
  Row,
  AppText,
  SegmentedControl,
  SectionHeader,
  ListGroup,
  ListItem,
  SearchBar,
  EmptyState,
  PressableScale,
} from '../../components/ui';
import { Illustration } from '../../components/illustrations';
import { ExportModal } from '../../components/export/ExportModal';
import { ErrorModal } from '../../components/common/ErrorModal';
import { BulkRescheduleModal } from '../../components/browser/BulkRescheduleModal';
import { NoteEditorModal } from '../../components/card/NoteEditorModal';
import { deckRepository } from '../../core/db/repositories/deckRepository';
import { browserRepository, BulkRescheduleResult } from '../../core/db/repositories/browserRepository';
import { reportError, AppErrorDetails } from '../../core/utils/errorHandler';
import { useDeckDetail, useDeckCards } from '../../features/decks/useDeckDetail';
import { DeckHero } from '../../features/decks/components/DeckHero';
import { CardRow } from '../../features/decks/components/CardRow';
import { DeckSettingsSheet } from '../../features/decks/components/DeckSettingsSheet';

type DeckTab = 'study' | 'cards' | 'tools';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { data, loading, reload } = useDeckDetail(id);
  const { deck, studiedCount, remainingNewCards } = data;

  const [tab, setTab] = useState<DeckTab>('study');
  const [cardSearch, setCardSearch] = useState('');
  const cards = useDeckCards(deck, tab === 'cards', cardSearch);

  const [activeError, setActiveError] = useState<AppErrorDetails | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [studiedCardIds, setStudiedCardIds] = useState<string[]>([]);

  if (!deck) {
    return (
      <Screen scroll={false} header={<Header title="" onBack={() => router.back()} />}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator color={colors.primary} /> : <Illustration name="search" size={200} />}
        </View>
      </Screen>
    );
  }

  const addCard = () => router.push({ pathname: '/modal/add-note', params: { deckId: id } });

  const openReschedule = async () => {
    try {
      const ids = await browserRepository.getStudiedCardIdsInDeck(deck.id);
      if (ids.length === 0) {
        CustomAlert.alert(t('common.info'), t('deck_detail.no_studied_msg'));
        return;
      }
      setStudiedCardIds(ids);
      setRescheduleVisible(true);
    } catch (e: any) {
      CustomAlert.alert(t('common.error'), e.message);
    }
  };

  const onRescheduled = (result: BulkRescheduleResult) => {
    CustomAlert.alert(t('common.done'), t('deck_detail.rescheduled_msg', { count: result.updatedCount, name: deck.name }));
    reload();
  };

  const confirmDelete = () => {
    CustomAlert.alert(t('common.delete'), t('deck_detail.delete_confirm', { name: deck.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deckRepository.delete(deck.id);
            router.back();
          } catch (err: any) {
            setActiveError(reportError('Delete Deck', err, t('common.error')));
          }
        },
      },
    ]);
  };

  const hasDue = deck.due_count > 0;
  const effectiveNew = Math.min(deck.new_count, remainingNewCards ?? deck.new_count);
  const hasNew = effectiveNew > 0;

  const studyTab = (
    <>
      <DeckHero deck={deck} />
      {hasDue ? (
        <Button
          title={`${t('home.start_review')} (${deck.due_count})`}
          icon="flash"
          size="lg"
          fullWidth
          onPress={() => router.push(`/study/review?deckId=${deck.id}`)}
          style={{ marginBottom: 22 }}
        />
      ) : hasNew ? (
        <Button
          title={`${t('home.start_learning')} (${effectiveNew})`}
          icon="school"
          size="lg"
          fullWidth
          color={colors.newCards}
          onPress={() => router.push(`/study/learn?deckId=${deck.id}`)}
          style={{ marginBottom: 22 }}
        />
      ) : (
        <Card variant="tinted" tone="green" style={{ marginBottom: 22 }}>
          <Row gap={12}>
            <Illustration name="all-done" size={92} backdrop={false} />
            <View style={{ flex: 1 }}>
              <AppText variant="title" weight="extrabold">
                {t('deck_detail.all_done_title')}
              </AppText>
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                {t('deck_detail.all_done_desc')}
              </AppText>
            </View>
          </Row>
        </Card>
      )}

      <SectionHeader title={t('deck_detail.modes_title')} icon="compass" tone="violet" />
      <ListGroup>
        <ListItem
          icon="headset"
          tone="sky"
          title={t('deck_detail.podcast_title')}
          subtitle={t('deck_detail.podcast_desc')}
          onPress={() => router.push(`/study/podcast?deckId=${deck.id}`)}
        />
        {hasDue && hasNew && (
          <ListItem
            icon="school"
            tone="blue"
            title={t('deck_detail.learn_title', { count: effectiveNew })}
            subtitle={t('deck_detail.learn_desc')}
            onPress={() => router.push(`/study/learn?deckId=${deck.id}`)}
          />
        )}
        {studiedCount > 0 && (
          <ListItem
            icon="repeat"
            tone="amber"
            title={t('deck_detail.cram_title', { count: studiedCount })}
            subtitle={t('deck_detail.cram_desc')}
            onPress={() => router.push(`/study/review?deckId=${deck.id}&mode=studied`)}
          />
        )}
      </ListGroup>
    </>
  );

  const cardsTab = (
    <>
      <Row gap={10} style={{ marginBottom: 14 }}>
        <SearchBar value={cardSearch} onChangeText={setCardSearch} placeholder={t('deck_detail.search_cards')} style={{ flex: 1 }} />
        <IconButton icon="add" variant="primary" size={50} onPress={addCard} accessibilityLabel={t('deck_detail.add_card')} />
      </Row>
      {cards.loading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="bodySm" color="textSecondary" style={{ marginTop: 8 }}>
            {t('deck_detail.loading_cards')}
          </AppText>
        </View>
      ) : cards.cards.length === 0 ? (
        <EmptyState
          compact
          illustration={cardSearch ? 'search' : 'empty-decks'}
          title={cardSearch ? t('deck_detail.no_matching_cards') : t('deck_detail.no_cards')}
          description={cardSearch ? t('decks.no_match_desc') : t('deck_detail.no_cards_desc')}
          actionTitle={cardSearch ? undefined : t('deck_detail.add_first')}
          actionIcon="add"
          onAction={cardSearch ? undefined : addCard}
        />
      ) : (
        <>
          {cards.cards.map((item) => (
            <CardRow key={item.id} item={item} onPress={() => setSelectedNoteId(item.note_id)} />
          ))}
          <PressableScale
            onPress={() => router.push(`/browser?deckId=${deck.id}&deckName=${encodeURIComponent(deck.name)}`)}
            style={{
              marginTop: 6,
              paddingVertical: 14,
              borderRadius: 18,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.border,
              alignItems: 'center',
            }}
          >
            <AppText variant="bodySm" weight="extrabold" color="primary">
              {t('deck_detail.open_browser')}
            </AppText>
          </PressableScale>
        </>
      )}
    </>
  );

  const toolsTab = (
    <>
      <ListGroup title={t('deck_detail.group_srs')}>
        <ListItem
          icon="calendar"
          tone="amber"
          title={t('deck_detail.reschedule_title')}
          subtitle={
            studiedCount > 0
              ? t('deck_detail.reschedule_desc', { count: studiedCount })
              : t('deck_detail.reschedule_none')
          }
          disabled={studiedCount === 0}
          onPress={openReschedule}
        />
        <ListItem
          icon="sparkles"
          tone="violet"
          title={t('deck_detail.quiz_title')}
          subtitle={t('deck_detail.quiz_desc')}
          onPress={() => router.push(`/(tabs)/quiz?deckId=${deck.id}`)}
        />
      </ListGroup>
      <ListGroup title={t('deck_detail.group_share')}>
        <ListItem
          icon="share-social"
          tone="pink"
          title={t('deck_detail.export_title')}
          subtitle={t('deck_detail.export_desc')}
          onPress={() => setExportVisible(true)}
        />
      </ListGroup>
      <ListGroup title={t('deck_detail.group_prefs')}>
        <ListItem
          icon="options"
          tone="sky"
          title={t('deck_detail.edit_title')}
          subtitle={t('deck_detail.edit_desc', { newPerDay: deck.new_per_day, reviewsPerDay: deck.reviews_per_day })}
          onPress={() => setSettingsVisible(true)}
        />
      </ListGroup>
      <ListGroup title={t('deck_detail.group_danger')}>
        <ListItem
          icon="trash"
          destructive
          title={t('deck_detail.delete_title')}
          subtitle={t('deck_detail.delete_desc')}
          onPress={confirmDelete}
        />
      </ListGroup>
    </>
  );

  return (
    <Screen
      decor
      header={
        <Header
          title={deck.name}
          subtitle={t('decks.cards_badge', { count: deck.card_count })}
          onBack={() => router.back()}
          rightElement={
            <>
              <IconButton icon="add" onPress={addCard} accessibilityLabel={t('deck_detail.add_card')} />
              <IconButton icon="options" onPress={() => setSettingsVisible(true)} accessibilityLabel={t('deck_detail.settings')} />
            </>
          }
        />
      }
      overlay={
        <>
          <DeckSettingsSheet deck={deck} visible={settingsVisible} onClose={() => setSettingsVisible(false)} onSaved={reload} />
          <ExportModal visible={exportVisible} deckId={deck.id} deckName={deck.name} onClose={() => setExportVisible(false)} />
          <ErrorModal visible={activeError !== null} error={activeError} onClose={() => setActiveError(null)} />
          <BulkRescheduleModal
            visible={rescheduleVisible}
            selectedCardIds={studiedCardIds}
            deckName={deck.name}
            onClose={() => setRescheduleVisible(false)}
            onSuccess={onRescheduled}
          />
          <NoteEditorModal
            visible={selectedNoteId !== null}
            noteId={selectedNoteId}
            onClose={() => setSelectedNoteId(null)}
            onSaved={() => {
              cards.reload();
              reload();
            }}
          />
        </>
      }
    >
      {!!deck.description && (
        <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 12 }}>
          {deck.description}
        </AppText>
      )}

      <SegmentedControl<DeckTab>
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 16 }}
        options={[
          { value: 'study', label: t('deck_detail.tab_study'), icon: 'school' },
          { value: 'cards', label: `${t('deck_detail.tab_cards')} (${deck.card_count})`, icon: 'documents' },
          { value: 'tools', label: t('deck_detail.tab_tools'), icon: 'construct' },
        ]}
      />

      {tab === 'study' && studyTab}
      {tab === 'cards' && cardsTab}
      {tab === 'tools' && toolsTab}
    </Screen>
  );
}
