import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useTheme, alpha } from "../../theme";
import { AppText, Row, PressableScale, GradientFill, IconName } from "../ui";

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: "home", off: "home-outline" },
  decks: { on: "albums", off: "albums-outline" },
  stats: { on: "bar-chart", off: "bar-chart-outline" },
  settings: { on: "settings", off: "settings-outline" },
};

/** Route rendered as the raised centre action. */
const CENTER_ROUTE = "quiz";

/** Floating pill tab bar with a raised gradient centre button. */
export const TabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { colors, heroGradient, shadow } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 14,
        paddingBottom: Math.max(insets.bottom, 10) + 4,
      }}
    >
      <Row
        justify="space-around"
        style={[
          {
            height: 68,
            borderRadius: 26,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 6,
          },
          shadow(3),
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.title === "string" ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name, route.params);
            }
          };

          if (route.name === CENTER_ROUTE) {
            // Raised above the pill bar with a negative top margin.
            return (
              <View
                key={route.key}
                style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
              >
                <PressableScale
                  onPress={onPress}
                  activeScale={0.9}
                  accessibilityRole="button"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={label}
                  style={{ marginTop: -28, alignItems: "center" }}
                >
                  {/* Shadow lives on an unclipped wrapper; circle clips inside. */}
                  <View
                    style={[
                      { width: 52, height: 52, borderRadius: 26 },
                      shadow(3, heroGradient[0]),
                    ]}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 26,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: [{ scale: focused ? 1.06 : 1 }],
                      }}
                    >
                      <GradientFill colors={heroGradient} radius={26} />
                      <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                  <AppText
                    variant="caption"
                    size={10.5}
                    weight={focused ? "extrabold" : "bold"}
                    color={focused ? "primary" : "textMuted"}
                    align="center"
                    numberOfLines={1}
                    style={{ marginTop: 3 }}
                  >
                    {label}
                  </AppText>
                </PressableScale>
              </View>
            );
          }

          const icon = ICONS[route.name] ?? {
            on: "ellipse",
            off: "ellipse-outline",
          };
          return (
            <PressableScale
              key={route.key}
              onPress={onPress}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
              activeScale={0.9}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 6,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 30,
                  borderRadius: 28,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: focused
                    ? alpha(colors.primary, 0.14)
                    : "transparent",
                }}
              >
                <Ionicons
                  name={focused ? icon.on : icon.off}
                  size={22}
                  color={focused ? colors.primary : colors.textMuted}
                />
              </View>
              <AppText
                variant="caption"
                size={10.5}
                weight={focused ? "extrabold" : "bold"}
                color={focused ? "primary" : "textMuted"}
                align="center"
                numberOfLines={1}
                style={{ marginTop: 2 }}
              >
                {label}
              </AppText>
            </PressableScale>
          );
        })}
      </Row>
    </View>
  );
};
