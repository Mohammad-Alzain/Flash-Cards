import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Header, Card, Row, TextField, SegmentedControl, SectionHeader, ListGroup, ListItem, AppText } from '../../components/ui';
import { notificationService } from '../../core/notifications/notificationService';
import { useSetting, useBoolSetting } from '../../hooks/useSetting';

export default function StudySettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [algorithm, setAlgorithm] = useSetting('scheduler_algorithm', 'sm2');
  const [newLimit, setNewLimit] = useSetting('daily_new_limit', '20');
  const [reviewLimit, setReviewLimit] = useSetting('daily_review_limit', '100');
  const [rollover, setRollover] = useSetting('rollover_hour', '4');
  const [autoPlay, setAutoPlay] = useBoolSetting('auto_play_audio', true);
  const [quickCard, setQuickCard] = useBoolSetting('quick_card_on_open', false);
  const [notifCards, setNotifCards] = useBoolSetting('notification_cards_enabled', true);
  const [sending, setSending] = useState(false);

  const testNotification = async () => {
    setSending(true);
    await notificationService.sendInteractiveFlashcardNotification();
    setSending(false);
  };

  return (
    <Screen decor header={<Header title={t('study_settings.title')} subtitle={t('study_settings.subtitle')} icon="options" iconTone="sky" onBack={() => router.back()} />}>
      <SectionHeader title={t('study_settings.algo_title')} icon="hardware-chip" tone="indigo" />
      <Card style={{ marginBottom: 22 }}>
        <AppText variant="bodySm" color="textSecondary" style={{ marginBottom: 12 }}>
          {t('study_settings.algo_desc')}
        </AppText>
        <SegmentedControl<'sm2' | 'fsrs'>
          value={algorithm === 'fsrs' ? 'fsrs' : 'sm2'}
          onChange={setAlgorithm}
          options={[
            { value: 'sm2', label: t('study_settings.sm2'), icon: 'git-branch' },
            { value: 'fsrs', label: t('study_settings.fsrs'), icon: 'sparkles' },
          ]}
        />
      </Card>

      <SectionHeader title={t('study_settings.limits_title')} icon="speedometer" tone="amber" />
      <Card style={{ marginBottom: 22, paddingBottom: 4 }}>
        <Row gap={10} align="flex-start">
          <TextField label={t('study_settings.new_limit')} value={newLimit} onChangeText={setNewLimit} keyboardType="number-pad" icon="sparkles" style={{ flex: 1, width: undefined }} />
          <TextField label={t('study_settings.review_limit')} value={reviewLimit} onChangeText={setReviewLimit} keyboardType="number-pad" icon="repeat" style={{ flex: 1, width: undefined }} />
        </Row>
        <TextField label={t('study_settings.rollover')} value={rollover} onChangeText={setRollover} keyboardType="number-pad" icon="moon" />
      </Card>

      <ListGroup>
        <ListItem
          icon="volume-high"
          tone="violet"
          title={t('study_settings.audio_title')}
          subtitle={t('study_settings.audio_desc')}
          switchValue={autoPlay}
          onSwitchChange={setAutoPlay}
        />
      </ListGroup>

      <ListGroup title={t('study_settings.ambient_title')} footer={t('study_settings.ambient_desc')}>
        <ListItem
          icon="notifications"
          tone="orange"
          title={t('study_settings.notif_title')}
          subtitle={t('study_settings.notif_desc')}
          switchValue={notifCards}
          onSwitchChange={setNotifCards}
        />
        {notifCards && (
          <ListItem
            icon="paper-plane"
            tone="sky"
            title={sending ? t('study_settings.sending') : t('study_settings.notif_test')}
            onPress={sending ? undefined : testNotification}
          />
        )}
        <ListItem
          icon="phone-portrait"
          tone="green"
          title={t('study_settings.quick_title')}
          subtitle={t('study_settings.quick_desc')}
          switchValue={quickCard}
          onSwitchChange={setQuickCard}
        />
        <ListItem icon="eye" tone="teal" title={t('study_settings.quick_preview')} onPress={() => router.push('/modal/quick-card')} />
      </ListGroup>
    </Screen>
  );
}
