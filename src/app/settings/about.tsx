import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ToneName } from '../../theme';
import { Screen, Header, Card, Row, AppText, Badge, IconTile, SectionHeader, ListGroup, ListItem, IconName } from '../../components/ui';
import { Logo } from '../../components/brand/Logo';
import { Illustration } from '../../components/illustrations';

const FEATURES: { key: string; icon: IconName; tone: ToneName }[] = [
  { key: 'f_srs', icon: 'hardware-chip', tone: 'indigo' },
  { key: 'f_anki', icon: 'albums', tone: 'sky' },
  { key: 'f_quiz', icon: 'sparkles', tone: 'violet' },
  { key: 'f_lock', icon: 'lock-closed', tone: 'rose' },
  { key: 'f_tools', icon: 'brush', tone: 'amber' },
];

export default function AboutSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen decor header={<Header title={t('settings.about')} icon="information-circle" iconTone="sky" onBack={() => router.back()} />}>
      <Card style={{ alignItems: 'center', paddingVertical: 22, marginBottom: 14 }}>
        <Logo variant="mark" size={72} style={{ marginBottom: 12 }} />
        <AppText variant="h2" align="center">
          {t('settings.app_name')}
        </AppText>
        <Badge label={t('settings.version')} icon="pricetag" variant="primary" style={{ alignSelf: 'center', marginTop: 8 }} />
      </Card>

      <Card variant="tinted" tone="green" style={{ marginBottom: 22 }}>
        <Row gap={12} align="flex-start">
          <IconTile icon="shield-checkmark" tone="green" size={42} variant="solid" />
          <View style={{ flex: 1 }}>
            <AppText variant="title" weight="extrabold">
              {t('settings.offline_badge')}
            </AppText>
            <AppText variant="bodySm" color="textSecondary" style={{ marginTop: 2 }}>
              {t('settings.offline_desc')}
            </AppText>
          </View>
        </Row>
      </Card>

      <SectionHeader title={t('about.capabilities')} icon="rocket" tone="violet" />
      <ListGroup>
        {FEATURES.map((f) => (
          <ListItem key={f.key} icon={f.icon} tone={f.tone} title={t(`about.${f.key}`)} />
        ))}
      </ListGroup>

      <View style={{ alignItems: 'center' }}>
        <Illustration name="welcome" size={170} />
        <AppText variant="caption" color="textMuted" align="center">
          {t('about.made_with')}
        </AppText>
      </View>
    </Screen>
  );
}
