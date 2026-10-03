import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../../components/ui/Button';
import { getDatabase } from '../../core/db/connection';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: number;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
  defaultTitle: string;
  defaultDesc: string;
  badge: string;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slides: Slide[] = [
    {
      id: 1,
      icon: 'shield-checkmark-outline',
      badge: '100% Offline',
      titleKey: 'onboarding.slide1Title',
      descKey: 'onboarding.slide1Desc',
      defaultTitle: 'خصوصية وأمان محلي 100%',
      defaultDesc: 'لا خوادم، لا تتبع، ولا اتصال بالإنترنت. بطاقاتك وبياناتك الصوتية والصور محفوظة بالكامل داخل جهازك.',
    },
    {
      id: 2,
      icon: 'hardware-chip-outline',
      badge: 'Smart SRS',
      titleKey: 'onboarding.slide2Title',
      descKey: 'onboarding.slide2Desc',
      defaultTitle: 'تكرار متباعد ذكي (SM-2 & FSRS)',
      defaultDesc: 'خوارزميات علمية دقيقة تراجع المعلومات في التوقيت المثالي قبل النسيان لترسيخ الذاكرة الدائمة.',
    },
    {
      id: 3,
      icon: 'albums-outline',
      badge: 'AnkiDroid Parity',
      titleKey: 'onboarding.slide3Title',
      descKey: 'onboarding.slide3Desc',
      defaultTitle: 'توافق كامل مع Anki و Excel',
      defaultDesc: 'استورد وصدر ملفات .apkg بحقولها ووسائطها وصيغها بسهولة تامة، أو استخدم جداول Excel والنصوص.',
    },
    {
      id: 4,
      icon: 'flame-outline',
      badge: 'Level Up',
      titleKey: 'onboarding.slide4Title',
      descKey: 'onboarding.slide4Desc',
      defaultTitle: 'نقاط وحماسة ومستويات تفاعلية',
      defaultDesc: 'اجمع نقاط الخبرة XP، حافظ على شعلة الحماسة اليومية، وافتح أوسمة الإنجاز وتحديات اليوم.',
    },
  ];

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    if (page !== activeIndex) {
      setActiveIndex(page);
    }
  };

  const completeOnboarding = async () => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_completed', 'true')"
      );
    } catch (e) {
      console.warn('Failed to save onboarding flag:', e);
    }
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      scrollRef.current?.scrollTo({
        x: (activeIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
      setActiveIndex(activeIndex + 1);
    } else {
      completeOnboarding();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Bar with Skip */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }} />
        {activeIndex < slides.length - 1 && (
          <TouchableOpacity onPress={completeOnboarding} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: theme.colors.textMuted }]}>
              {t('common.skip') || 'تخطي'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.carousel}
      >
        {slides.map(slide => (
          <View key={slide.id} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View
              style={[
                styles.emojiCircle,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name={slide.icon} size={44} color={theme.colors.primary} />
            </View>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.primary + '15',
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
                {slide.badge}
              </Text>
            </View>

            <Text style={[styles.title, { color: theme.colors.text }]}>
              {t(slide.titleKey) || slide.defaultTitle}
            </Text>

            <Text style={[styles.desc, { color: theme.colors.textMuted }]}>
              {t(slide.descKey) || slide.defaultDesc}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Bar: Indicators & Button */}
      <View style={styles.bottomBar}>
        {/* Dot Indicators */}
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === activeIndex ? theme.colors.primary : theme.colors.border,
                  width: i === activeIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <Button
          title={
            activeIndex === slides.length - 1
              ? (t('onboarding.start') || 'ابدأ الآن')
              : (t('common.next') || 'التالي')
          }
          icon={
            activeIndex === slides.length - 1
              ? <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
              : undefined
          }
          variant="primary"
          size="lg"
          style={styles.actionBtn}
          onPress={handleNext}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  carousel: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emojiCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderBottomWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emojiText: {
    fontSize: 64,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 30,
  },
  desc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomBar: {
    padding: 24,
    paddingBottom: 36,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionBtn: {
    width: '100%',
  },
});
