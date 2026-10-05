import React from 'react';
import { View } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ToneName } from '../../theme';
import { Screen, Header, ListGroup, ListItem, Card, Row, AppText, IconTile, IconName } from '../../components/ui';
import { Mascot } from '../../components/illustrations';

interface Entry {
  icon: IconName;
  tone: ToneName;
  title: string;
  subtitle: string;
  href: Href;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const sections: { title: string; items: Entry[] }[] = [
    {
      title: t('settings.section_experience'),
      items: [
        { icon: 'sparkles', tone: 'violet', title: t('settings.ai_title'), subtitle: t('settings.ai_desc'), href: '/settings/ai' },
        { icon: 'color-palette', tone: 'pink', title: t('settings.appearance'), subtitle: t('settings.appearance_desc'), href: '/settings/appearance' },
        { icon: 'options', tone: 'sky', title: t('settings.study_title'), subtitle: t('settings.study_desc'), href: '/settings/study' },
        { icon: 'calendar', tone: 'amber', title: t('settings.planner_title'), subtitle: t('settings.planner_desc'), href: '/planner' },
      ],
    },
    {
      title: t('settings.section_security'),
      items: [
        { icon: 'lock-closed', tone: 'rose', title: t('settings.security_title'), subtitle: t('settings.security_desc'), href: '/settings/security' },
        { icon: 'cloud-upload', tone: 'blue', title: t('settings.backup_title'), subtitle: t('settings.backup_desc'), href: '/settings/backup' },
        { icon: 'share', tone: 'orange', title: t('settings.export_title'), subtitle: t('settings.export_desc'), href: '/settings/export' },
      ],
    },
    {
      title: t('settings.section_tools'),
      items: [
        { icon: 'search', tone: 'indigo', title: t('settings.browser_title'), subtitle: t('settings.browser_desc'), href: '/browser' },
        { icon: 'construct', tone: 'teal', title: t('settings.tools_title'), subtitle: t('settings.tools_desc'), href: '/tools' },
        { icon: 'document-text', tone: 'violet', title: t('settings.note_types_title'), subtitle: t('settings.note_types_desc'), href: '/note-types' },
        { icon: 'pricetags', tone: 'green', title: t('settings.tags_title'), subtitle: t('settings.tags_desc'), href: '/tools/tags' },
        { icon: 'server', tone: 'slate', title: t('settings.database'), subtitle: t('settings.database_desc'), href: '/settings/data' },
      ],
    },
    {
      title: t('settings.section_about'),
      items: [
        { icon: 'information-circle', tone: 'sky', title: t('settings.about'), subtitle: t('settings.about_desc'), href: '/settings/about' },
      ],
    },
  ];

  return (
    <Screen
      decor
      tabBarSpace
      header={<Header large title={t('settings.title')} subtitle={t('settings.subtitle')} icon="settings" iconTone="slate" />}
    >
      {/* Profile banner */}
      <Card variant="gradient" onPress={() => router.push('/profile')} padding={16} style={{ marginBottom: 14 }}>
        <Row gap={14}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mascot onColor size={50} pose="wave" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h3" color="#FFFFFF">
              {t('settings.profile_title')}
            </AppText>
            <AppText variant="bodySm" color="rgba(255,255,255,0.85)">
              {t('settings.profile_desc')}
            </AppText>
          </View>
        </Row>
      </Card>

      {/* Offline guarantee */}
      <Card variant="tinted" tone="green" padding={12} style={{ marginBottom: 22 }}>
        <Row gap={12}>
          <IconTile icon="shield-checkmark" tone="green" size={38} variant="solid" />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong" weight="extrabold">
              {t('settings.offline_badge')}
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {t('settings.offline_desc')}
            </AppText>
          </View>
        </Row>
      </Card>

      {sections.map((section) => (
        <ListGroup key={section.title} title={section.title}>
          {section.items.map((item) => (
            <ListItem
              key={item.title}
              icon={item.icon}
              tone={item.tone}
              title={item.title}
              subtitle={item.subtitle}
              onPress={() => router.push(item.href)}
            />
          ))}
        </ListGroup>
      ))}
    </Screen>
  );
}
