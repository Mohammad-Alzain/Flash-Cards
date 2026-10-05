import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CardRenderer } from './CardRenderer';
import { useTheme } from '../../theme';

interface FlashCardFlipProps {
  frontHtml: string;
  backHtml: string;
  css?: string;
  templateOrd?: number;
  isFlipped: boolean;
  onFlip?: () => void;
  onAudioPlay?: (filename: string) => void;
  style?: ViewStyle;
}

export const FlashCardFlip: React.FC<FlashCardFlipProps> = ({
  frontHtml,
  backHtml,
  css = '',
  templateOrd = 0,
  isFlipped,
  onFlip,
  onAudioPlay,
  style,
}) => {
  const { colors, isDark, shadow } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(isFlipped ? 180 : 0, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFlipped]);

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    if (onFlip) {
      onFlip();
    }
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(rotation.value, [0, 180], [0, 180])}deg`;
    return {
      transform: [{ perspective: 1000 }, { rotateY }],
      opacity: rotation.value >= 90 ? 0 : 1,
      zIndex: rotation.value < 90 ? 1 : 0,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(rotation.value, [0, 180], [180, 360])}deg`;
    return {
      transform: [{ perspective: 1000 }, { rotateY }],
      opacity: rotation.value < 90 ? 0 : 1,
      zIndex: rotation.value >= 90 ? 1 : 0,
    };
  });

  return (
    <View style={[styles.container, style]}>
      {/* Front Face */}
      <Animated.View
        style={[
          styles.cardFace,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderBottomColor: colors.borderDarker,
          },
          shadow(2),
          frontAnimatedStyle,
        ]}
        pointerEvents={isFlipped ? 'none' : 'auto'}
      >
        <CardRenderer
          htmlContent={frontHtml}
          css={css}
          templateOrd={templateOrd}
          isNightMode={isDark}
          onAudioPlay={onAudioPlay}
          onFlip={handlePress}
        />
      </Animated.View>

      {/* Back Face */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.backFace,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderBottomColor: colors.borderDarker,
          },
          shadow(2),
          backAnimatedStyle,
        ]}
        pointerEvents={isFlipped ? 'auto' : 'none'}
      >
        <CardRenderer
          htmlContent={backHtml}
          css={css}
          templateOrd={templateOrd}
          isNightMode={isDark}
          onAudioPlay={onAudioPlay}
          onFlip={handlePress}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 4,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  backFace: {},
});
