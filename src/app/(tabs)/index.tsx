import React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection } from '../../theme';
import {
  Screen,
  AppText,
  Row,
  PressableScale,
  StreakFlame,
  XPCounter,
  StatTile,
  SectionHeader,
  FeatureTile,
  FAB,
  Card,
  Button,
  TAB_BAR_SPACE,
} from '../../components/ui';
import { Logo } from '../../components/brand/Logo';
import { Illustration } from '../../components/illustrations';
import { useHomeData, pickLearnTarget } from '../../features/home/useHomeData';
import { HomeHero } from '../../features/home/components/HomeHero';
import { StudyActionCard } from '../../features/home/components/StudyActionCard';
import { DeckTile } from '../../features/decks/components/DeckTile';

const greetingKey = (hour: number) =>
  hour < 12 ? 'home.greeting_morning' : hour < 17 ? 'home.greeting_afternoon' : 'home.greeting_evening';

export default function HomeScreen() {
  const { colors, shadow } = useTheme();
  const dir = useDirection();
  const { t } = useTranslation();
  const router = useRouter();
  const { data, refreshing, refresh } = useHomeData();
  const { decks, counts, today } = data;
  const learn = pickLearnTarget(data);
  const nothingToStudy = counts.total > 0 && counts.due === 0 && learn.newCount === 0;

  const header = (
    <Row gap={12} style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
      <Logo variant="mark" size={40} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodySm" color="textSecondary" numberOfLines={1}>
          {t(greetingKey(new Date().getHours()))}
        </AppText>
        <AppText variant="h2" weight="black" numberOfLines={1}>
          {t('home.ready_title')}
        </AppText>
      </View>
      <PressableScale
        onPress={() => router.push('/profile')}
        hitSlop={8}
        accessibilityRole="button"
        style={[
          {
            flexDirection: dir.row,
            alignItems: 'center',
            gap: 2,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 999,
            padding: 3,
          },
          shadow(1),
        ]}
      >
        <StreakFlame streak={today.streakCurrent} />
        <XPCounter xp={today.xpTotal} />
      </PressableScale>
    </Row>
  );

  return (
    <Screen
      decor
      header={header}
      refreshing={refreshing}
      onRefresh={refresh}
      tabBarSpace
      overlay={
        <FAB
          onPress={() => router.push('/modal/add-note')}
          accessibilityLabel={t('home.add_card')}
          style={[{ position: 'absolute', bottom: TAB_BAR_SPACE - 8 }, dir.end(18)]}
        />
      }
    >
      <HomeHero today={today} />

      {/* ── Study now ─────────────────────────────────────────── */}
      <SectionHeader title={t('home.study_now')} icon="flash" tone="amber" />
      {nothingToStudy ? (
        <Card variant="tinted" tone="green" style={{ alignItems: 'center', marginBottom: 22 }}>
          <Illustration name="all-done" size={170} />
          <AppText variant="h3" align="center">
            {t('home.all_done_title')}
          </AppText>
          <AppText variant="bodySm" color="textSecondary" align="center" style={{ marginTop: 4, marginBottom: 12 }}>
            {t('home.all_done_subtitle')}
          </AppText>
          <Button title={t('home.quick_quiz')} icon="sparkles" variant="soft" size="sm" onPress={() => router.push('/(tabs)/quiz')} />
        </Card>
      ) : (
        <Row gap={12} align="stretch" style={{ marginBottom: 22 }}>
          <StudyActionCard
            title={t('home.start_review')}
            subtitle={t('home.review_card_subtitle', { count: counts.due })}
            count={counts.due}
            icon="refresh"
            tone="green"
            disabled={counts.due === 0}
            onPress={() => router.push('/study/review')}
          />
          <StudyActionCard
            title={t('home.start_learning')}
            subtitle={
              learn.deck
                ? t('home.learn_scoped_subtitle', { deck: learn.deck.name, count: learn.newCount })
                : t('home.learn_card_subtitle', { count: learn.newCount })
            }
            count={learn.newCount}
            icon="school"
            tone="blue"
            disabled={learn.newCount <= 0}
            onPress={() =>
              router.push(learn.deck ? `/study/learn?deckId=${learn.deck.id}` : '/study/learn')
            }
          />
        </Row>
      )}

      {/* ── Today at a glance ─────────────────────────────────── */}
      <SectionHeader title={t('home.today_title')} icon="today" tone="sky" />
      <Row gap={8} align="stretch" style={{ marginBottom: 22 }}>
        <StatTile layout="compact" icon="checkmark-done" tone="green" value={today.reviewsDone} label={t('home.stat_reviewed')} />
        <StatTile layout="compact" icon="sparkles" tone="blue" value={today.newDone} label={t('home.stat_new')} />
        <StatTile layout="compact" icon="time" tone="sky" value={Math.round(today.timeMs / 60000)} label={t('home.stat_time')} />
        <StatTile layout="compact" icon="flash" tone="amber" value={today.xpTotal} label={t('home.stat_xp')} />
      </Row>

      {/* ── Active decks ──────────────────────────────────────── */}
      <SectionHeader
        title={t('home.recent_decks')}
        icon="albums"
        tone="violet"
        actionLabel={decks.length > 0 ? t('home.see_all') : undefined}
        onAction={() => router.push('/(tabs)/decks')}
      />
      {decks.length === 0 ? (
        <Card onPress={() => router.push('/(tabs)/decks')} style={{ alignItems: 'center', marginBottom: 22 }}>
          <Illustration name="empty-decks" size={150} />
          <AppText variant="title" align="center">
            {t('home.no_decks_title')}
          </AppText>
          <AppText variant="bodySm" weight="extrabold" color="primary" align="center" style={{ marginTop: 4 }}>
            + {t('home.no_decks_cta')}
          </AppText>
        </Card>
      ) : (
        <FlatList
          horizontal
          inverted={dir.rtl}
          data={decks}
          keyExtractor={(d) => d.id}
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16, marginBottom: 18 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
          renderItem={({ item }) => <DeckTile deck={item} onPress={() => router.push(`/decks/${item.id}`)} />}
        />
      )}

      {/* ── Quick tools ───────────────────────────────────────── */}
      <SectionHeader title={t('home.tools_title')} icon="grid" tone="pink" />
      <Row gap={12} align="stretch" style={{ marginBottom: 12 }}>
        <FeatureTile
          icon="sparkles"
          tone="violet"
          title={t('home.quick_quiz')}
          description={t('home.quick_quiz_desc')}
          onPress={() => router.push('/(tabs)/quiz')}
        />
        <FeatureTile
          icon="calendar"
          tone="amber"
          title={t('planner.title')}
          description={t('home.planner_desc')}
          onPress={() => router.push('/planner')}
        />
      </Row>
      <Row gap={12} align="stretch">
        <FeatureTile
          icon="search"
          tone="sky"
          title={t('home.browser_title')}
          description={t('home.browser_desc')}
          onPress={() => router.push('/browser')}
        />
        <FeatureTile
          icon="cloud-download"
          tone="teal"
          title={t('home.import_title')}
          description={t('home.import_desc')}
          onPress={() => router.push('/import')}
        />
      </Row>
    </Screen>
  );
}
