import React from 'react';
import { View, ScrollView, RefreshControl, StyleProp, ViewStyle, StyleSheet, ScrollViewProps } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';

/** Height reserved at the bottom of tab screens so content clears the floating tab bar. */
export const TAB_BAR_SPACE = 110;

interface ScreenProps {
  children: React.ReactNode;
  /** Rendered above the scroll area (sticky). */
  header?: React.ReactNode;
  /** Wrap children in a ScrollView. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Adds bottom padding for the floating tab bar. */
  tabBarSpace?: boolean;
  /** Soft brand glow behind the top of the screen. */
  decor?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle' | 'refreshControl'>;
  /** Overlay content (FABs, sheets) rendered outside the scroll view. */
  overlay?: React.ReactNode;
}

const TopGlow: React.FC = () => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { height: 340 }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="topglow" cx="85%" cy="0%" rx="80%" ry="90%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={isDark ? 0.22 : 0.13} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="topglow2" cx="0%" cy="10%" rx="60%" ry="60%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={isDark ? 0.12 : 0.08} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#topglow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#topglow2)" />
      </Svg>
    </View>
  );
};

/** Standard screen scaffold: safe area, background, optional glow, header and scroll body. */
export const Screen: React.FC<ScreenProps> = ({
  children,
  header,
  scroll = true,
  refreshing,
  onRefresh,
  tabBarSpace = false,
  decor = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  contentStyle,
  scrollProps,
  overlay,
}) => {
  const { colors } = useTheme();
  const padding: ViewStyle = {
    paddingHorizontal: padded ? 16 : 0,
    paddingTop: 8,
    paddingBottom: tabBarSpace ? TAB_BAR_SPACE : 32,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={edges}>
      {decor && <TopGlow />}
      {header}
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
          contentContainerStyle={[padding, contentStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surfaceRaised}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded ? { paddingHorizontal: 16 } : null, contentStyle]}>{children}</View>
      )}
      {overlay}
    </SafeAreaView>
  );
};

