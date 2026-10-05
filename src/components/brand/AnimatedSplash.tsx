import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { MascotFigure, sparkPath, SPARK_GOLD, MascotExpression, MascotPose } from '../illustrations/Mascot';
import { BRAND, Wordmark } from './Logo';

/** Matches `imageWidth` of the expo-splash-screen plugin so the hand-off is seamless. */
const NATIVE_IMAGE_SIZE = 200;
/** Keep the intro on screen at least this long, even if the app is ready sooner. */
const MIN_VISIBLE_MS = 1500;
const EXIT_MS = 380;
/** Moment the mascot "lands" and celebrates. */
const CHEER_AT_MS = 420;

interface AnimatedSplashProps {
  /** App finished loading (DB, language…). The splash exits once this is true. */
  ready: boolean;
  onFinish: () => void;
}

/**
 * Picks up exactly where the native splash leaves off (same background, same
 * mascot artwork at the same size and position), plays a short intro, then
 * fades into the app.
 */
export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ ready, onFinish }) => {
  const reduceMotion = useReducedMotion();
  const [expression, setExpression] = useState<MascotExpression>('happy');
  const [pose, setPose] = useState<MascotPose>('idle');
  const shownAt = useRef<number | null>(null);
  const exiting = useRef(false);

  const hop = useSharedValue(0);
  const squash = useSharedValue(1);
  const lift = useSharedValue(0);
  const sparkle = useSharedValue(0);
  const ring = useSharedValue(0);
  const words = useSharedValue(0);
  const fade = useSharedValue(1);
  const zoom = useSharedValue(1);

  const start = () => {
    if (shownAt.current !== null) return;
    shownAt.current = Date.now();
    // Our first frame matches the native splash — now it's safe to hide it.
    SplashScreen.hideAsync().catch(() => {});

    if (reduceMotion) {
      lift.value = withTiming(1, { duration: 250 });
      words.value = withTiming(1, { duration: 250 });
      return;
    }
    hop.value = withSequence(
      withTiming(-28, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })
    );
    squash.value = withSequence(
      withTiming(1.04, { duration: 220 }),
      withTiming(0.9, { duration: 200 }),
      withSpring(1, { damping: 7, stiffness: 180 })
    );
    ring.value = withDelay(380, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    sparkle.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    lift.value = withDelay(520, withSpring(1, { damping: 14, stiffness: 120 }));
    words.value = withDelay(600, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    setTimeout(() => {
      setExpression('excited');
      setPose('cheer');
    }, CHEER_AT_MS);
  };

  // Exit once the app is ready and the intro has had its moment.
  useEffect(() => {
    if (!ready || exiting.current) return;
    const tryExit = () => {
      if (shownAt.current === null) return false;
      exiting.current = true;
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
      setTimeout(() => {
        fade.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
        zoom.value = withTiming(reduceMotion ? 1 : 1.15, { duration: EXIT_MS });
        setTimeout(onFinish, EXIT_MS + 20);
      }, wait);
      return true;
    };
    if (tryExit()) return;
    // Ready before our first layout: retry shortly.
    const id = setInterval(() => tryExit() && clearInterval(id), 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -46 * lift.value }, { scale: zoom.value }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { scaleY: squash.value }, { scaleX: 2 - squash.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ring.value),
    transform: [{ scale: 0.6 + ring.value * 1.1 }],
  }));
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + 0.4 * sparkle.value,
    transform: [{ rotate: `${sparkle.value * 18}deg` }, { scale: 0.9 + 0.2 * sparkle.value }],
  }));
  const wordsStyle = useAnimatedStyle(() => ({
    opacity: words.value,
    transform: [{ translateY: 18 * (1 - words.value) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} onLayout={start} pointerEvents="none">
      <StatusBar style="light" />
      <Animated.View style={[styles.center, groupStyle]}>
        <View style={styles.stage}>
          <Animated.View style={[styles.ring, ringStyle]} />
          {/* Sparks twinkle independently of the hopping mascot. */}
          <Animated.View style={[StyleSheet.absoluteFill, sparkleStyle]}>
            <Svg width={NATIVE_IMAGE_SIZE} height={NATIVE_IMAGE_SIZE} viewBox="0 0 512 512">
              <Path d={sparkPath(150, 150, 22)} fill={SPARK_GOLD} />
              <Circle cx={364} cy={146} r={10} fill={BRAND.cyan} />
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, mascotStyle]}>
            <Svg width={NATIVE_IMAGE_SIZE} height={NATIVE_IMAGE_SIZE} viewBox="0 0 512 512">
              {/* Same placement as scripts/brand/logoSvg.js → splashSvg(). */}
              <MascotFigure uid="splash" color={BRAND.body} accent={BRAND.cyan} expression={expression} pose={pose} x={256 - 60 * 2.2} y={262 - 76 * 2.2} scale={2.2} />
            </Svg>
          </Animated.View>
        </View>
        <Animated.View style={[styles.words, wordsStyle]}>
          <Wordmark size={30} subtitle onDark align="center" />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: BRAND.splashBg, zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { width: NATIVE_IMAGE_SIZE, height: NATIVE_IMAGE_SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
    borderColor: BRAND.glow,
  },
  // Absolutely positioned so revealing the wordmark never shifts the mascot.
  words: { position: 'absolute', top: '50%', marginTop: NATIVE_IMAGE_SIZE / 2 + 8, alignItems: 'center', left: 0, right: 0 },
});
