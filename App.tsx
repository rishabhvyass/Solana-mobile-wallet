import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Wallet } from "./src/Screens/wallet";
import { SwapScreen } from "./src/Screens/token-swap";
import Colors from "./src/constants/Colors";

export default function App() {
  const [activeTab, setActiveTab] = useState<"wallet" | "swap">("wallet");

  return (
    <SafeAreaProvider>

      <SafeAreaView style={s.safe}>
        {/* Screen Content */}
        {activeTab === "wallet" ? <Wallet /> : <SwapScreen />}

        {/* Bottom Tab Bar */}
        <View style={s.tabBar}>

          <TouchableOpacity
            style={s.tab}
            onPress={() => setActiveTab("wallet")}
          >
            <Ionicons
              name={activeTab === "wallet" ? "wallet" : "wallet-outline"}
              size={24}
              color={activeTab === "wallet" ? Colors.primary : "#6B7280"}
            />

            <Text style={[s.tabLabel, activeTab === "wallet" && s.tabActive]}>
              Wallet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.tab}
            onPress={() => setActiveTab("swap")}
          >
            <Ionicons
              name={activeTab === "swap" ? "swap-horizontal" : "swap-horizontal-outline"}
              size={24}
              color={activeTab === "swap" ? "#14F195" : "#6B7280"}
            />
            <Text style={[s.tabLabel, activeTab === "swap" && s.tabActive]}>
              Swap
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe:
  {
    flex: 1,
    backgroundColor: Colors.secondary,
  },

  tabBar:
  {
    flexDirection: "row",
    backgroundColor: "#16161D",
    borderTopWidth: 1,
    borderTopColor: Colors.gray.dark,
    paddingBottom: 8,
    paddingTop: 12,
  },

  tab:
  {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },

  tabLabel:
  {
    color: "#6B7280",
    fontSize: 12,
  },

  tabActive:
  {
    color: "#14F195",
  },
});

