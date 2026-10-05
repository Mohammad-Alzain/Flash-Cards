import React, { useRef, useState } from 'react';
import { View, FlatList, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme, useDirection, ToneName } from '../../theme';
import { AppText, Row, Button, Badge, IconName } from '../../components/ui';
import { Logo } from '../../components/brand/Logo';
import { Illustration, IllustrationName } from '../../components/illustrations';
import { settingsRepository } from '../../core/db/repositories/settingsRepository';

interface Slide {
  key: string;
  illustration: IllustrationName;
  icon: IconName;
  tone: ToneName;
}

const SLIDES: Slide[] = [
  { key: '1', illustration: 'locked', icon: 'shield-checkmark', tone: 'green' },
  { key: '2', illustration: 'review', icon: 'hardware-chip', tone: 'indigo' },
  { key: '3', illustration: 'import', icon: 'albums', tone: 'sky' },
  { key: '4', illustration: 'all-done', icon: 'flame', tone: 'orange' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dir = useDirection();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const last = index === SLIDES.length - 1;

  const complete = async () => {
    try {
      await settingsRepository.set('onboarding_completed', 'true');
    } catch (e) {
      console.warn('Failed to save onboarding flag:', e);
    }
    router.replace('/(tabs)');
  };

  const next = () => {
    if (last) {
      complete();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex(index + 1);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== index) setIndex(page);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
      <Row justify="space-between" style={{ paddingHorizontal: 20, height: 60 }}>
        <Logo variant="lockup" size={28} />
        {!last && (
          <Pressable onPress={complete} hitSlop={10}>
            <AppText variant="bodyStrong" color="textMuted">
              {t('common.skip')}
            </AppText>
          </Pressable>
        )}
      </Row>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        inverted={dir.rtl}
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Illustration name={item.illustration} size={Math.min(300, width - 48)} />
            <Badge icon={item.icon} variant="primary" label={t(`onboarding.badge${item.key}`)} style={{ alignSelf: 'center', marginTop: 8, marginBottom: 14 }} />
            <AppText variant="h1" align="center" style={{ marginBottom: 10 }}>
              {t(`onboarding.slide${item.key}Title`)}
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {t(`onboarding.slide${item.key}Desc`)}
            </AppText>
          </View>
        )}
      />

      <View style={{ padding: 24, paddingTop: 8 }}>
        <Row gap={8} justify="center" style={{ marginBottom: 20 }}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={{ height: 8, borderRadius: 4, width: i === index ? 28 : 8, backgroundColor: i === index ? colors.primary : colors.border }}
            />
          ))}
        </Row>
        <Button
          title={last ? t('onboarding.start') : t('common.next')}
          icon={last ? 'rocket' : dir.arrowForwardIcon}
          iconPosition={last ? 'left' : 'right'}
          size="lg"
          fullWidth
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}
