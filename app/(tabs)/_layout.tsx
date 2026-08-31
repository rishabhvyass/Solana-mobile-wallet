import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useWalletStore } from "../../src/stores/wallet-store";

function TabIcon({
  color,
  size,
  focused,
  name,
  isDark,
}: {
  color: string;
  size: number;
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  isDark: boolean;
}) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused
          ? isDark
            ? "rgba(255,255,255,0.10)"
            : "#0F172A"
          : "transparent",
      }}
    >
      <Ionicons
        name={name}
        size={size + (focused ? 3 : 1)}
        color={focused && !isDark ? "#FFFFFF" : color}
      />
    </View>
  );
}

export default function Tab() {
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: isDark ? colors.background : "#FCFCFD",
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          // Lift the floating bar clear of the home indicator on gesture-nav
          // devices; on older hardware insets.bottom is 0 and 12 still applies.
          bottom: Math.max(12, insets.bottom),
          height: 76,
          paddingTop: 10,
          paddingBottom: 12,
          paddingHorizontal: 8,
          borderTopWidth: 0,
          borderRadius: 28,
          backgroundColor: isDark ? "rgba(19,24,37,0.94)" : "rgba(255,255,255,0.96)",
          shadowColor: "#0F172A",
          shadowOpacity: isDark ? 0.32 : 0.1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 14,
        },
        tabBarItemStyle: {
          borderRadius: 24,
        },
        tabBarActiveBackgroundColor: "transparent",
        tabBarActiveTintColor: isDark ? colors.text : "#111111",
        tabBarInactiveTintColor: isDark ? colors.textMuted : "#B5B6BC",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Portfolio",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="home"
              color={color as string}
              size={size}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="swap"
        options={{
          title: "Swap",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="swap-horizontal"
              color={color as string}
              size={size}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="time"
              color={color as string}
              size={size}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="person"
              color={color as string}
              size={size}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
    </Tabs>
  );
}
