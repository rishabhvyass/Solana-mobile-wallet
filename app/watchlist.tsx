import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenAtmosphere } from "../src/components/ScreenAtmosphere";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { useWalletStore } from "../src/stores/wallet-store";
import type { ThemeColors } from "../src/constants/theme";
import { getBalance, short } from "../src/utils/helpers";

interface WatchlistItem {
  address: string;
  balance: number | null;
  loading: boolean;
}

export default function WatchlistScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  const favorites = useWalletStore((s) => s.favorites);
  const removeFavorite = useWalletStore((s) => s.removeFavorite);
  const addToHistory = useWalletStore((s) => s.addToHistory);
  const setActiveAddress = useWalletStore((s) => s.setActiveAddress);
  const isDevnet = useWalletStore((s) => s.isDevnet);
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // Balances arrive out of order when the list is refreshed mid-flight, so each
  // run is stamped and only the newest one is allowed to publish its results.
  const requestRef = useRef(0);

  const fetchBalances = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (favorites.length === 0) {
      setItems([]);
      return;
    }

    const results = await Promise.all(
      favorites.map(async (address) => {
        try {
          const balance = await getBalance(address);
          return { address, balance, loading: false };
        } catch {
          return { address, balance: null, loading: false };
        }
      }),
    );

    if (requestRef.current !== requestId) return;
    setItems(results);
  }, [favorites]);

  // `isDevnet` is read inside the RPC layer rather than passed in, so it has to
  // be a dependency here or switching networks would keep the old balances.
  useEffect(() => {
    if (favorites.length === 0) {
      setItems([]);
      return;
    }

    setItems(
      favorites.map((address) => ({
        address,
        balance: null,
        loading: true,
      })),
    );
    void fetchBalances();
  }, [favorites, fetchBalances, isDevnet]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBalances();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBalances]);

  const handleSelect = (address: string) => {
    addToHistory(address);
    setActiveAddress(address);
    router.replace("/(tabs)");
  };

  const confirmRemove = (address: string) => {
    Alert.alert("Remove saved wallet?", short(address, 6), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeFavorite(address),
      },
    ]);
  };

  const loadedBalances = items.filter(
    (item) => !item.loading && item.balance !== null,
  );
  const totalBalance = loadedBalances.reduce(
    (sum, item) => sum + (item.balance ?? 0),
    0,
  );
  const unavailableCount = items.filter(
    (item) => !item.loading && item.balance === null,
  ).length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.container}>
        <ScreenAtmosphere colors={colors} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.content,
            { paddingBottom: insets.bottom + 40 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          <Animated.View entering={FadeInDown.delay(40).springify()} style={s.header}>
            <TouchableOpacity
              style={s.headerButton}
              onPress={() => router.back()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>

            <View style={s.headerPill}>
              <View style={[s.networkDot, isDevnet && s.networkDotDevnet]} />
              <Text style={s.headerPillText}>
                {isDevnet ? "Devnet" : "Mainnet"}
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(90).springify()} style={s.heroCard}>
            <View style={s.heroGlowAccent} />
            <View style={s.heroGlowPrimary} />

            <Text style={s.eyebrow}>Saved Wallets</Text>
            <Text style={s.title}>Your watchlist, ready to open.</Text>
            <Text style={s.subtitle}>
              Track favorite Solana wallets, keep a quick balance pulse, and tap
              any card to load it into Portfolio.
            </Text>

            <View style={s.statRow}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Wallets</Text>
                <Text style={s.statValue}>{favorites.length}</Text>
              </View>

              <View style={s.statCard}>
                <Text style={s.statLabel}>Combined</Text>
                <Text style={s.statValue}>
                  {loadedBalances.length > 0 ? `${totalBalance.toFixed(2)} SOL` : "--"}
                </Text>
                {unavailableCount > 0 && loadedBalances.length > 0 ? (
                  // Say so rather than quietly under-reporting the total.
                  <Text style={s.statNote}>
                    {unavailableCount} wallet{unavailableCount === 1 ? "" : "s"}{" "}
                    not counted
                  </Text>
                ) : null}
              </View>
            </View>
          </Animated.View>

          {favorites.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(140).springify()} style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <Ionicons
                  name="heart-outline"
                  size={26}
                  color={colors.accent}
                />
              </View>
              <Text style={s.emptyTitle}>No saved wallets yet</Text>
              <Text style={s.emptyText}>
                Search any address from the portfolio screen and tap the heart
                icon to keep it here.
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(140).springify()} style={s.listWrap}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Wallet Collection</Text>
                <Text style={s.sectionMeta}>Tap to open</Text>
              </View>

              {items.map((item, index) => (
                <TouchableOpacity
                  key={item.address}
                  style={s.walletCard}
                  onPress={() => handleSelect(item.address)}
                  onLongPress={() => confirmRemove(item.address)}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={`Open wallet ${short(item.address, 6)} in Portfolio`}
                  accessibilityHint="Long press to remove it from your watchlist"
                >
                  <View
                    style={[
                      s.walletIcon,
                      index % 3 === 0 && s.walletIconAccent,
                      index % 3 === 1 && s.walletIconPrimary,
                      index % 3 === 2 && s.walletIconBlue,
                    ]}
                  >
                    <Ionicons
                      name="wallet-outline"
                      size={18}
                      color={
                        index % 3 === 0
                          ? colors.accent
                          : index % 3 === 1
                            ? colors.positive
                            : colors.blue
                      }
                    />
                  </View>

                  <View style={s.walletInfo}>
                    <Text style={s.walletName}>{short(item.address, 6)}</Text>
                    <Text style={s.walletAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>

                  <View style={s.walletRight}>
                    {item.loading ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : item.balance !== null ? (
                      <Text style={s.walletBalance}>
                        {item.balance.toFixed(4)} SOL
                      </Text>
                    ) : (
                      <Text style={s.walletError}>Unavailable</Text>
                    )}

                    <TouchableOpacity
                      style={s.removeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => confirmRemove(item.address)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${short(item.address, 6)} from watchlist`}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      gap: 18,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    headerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    networkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.positive,
    },
    networkDotDevnet: {
      backgroundColor: colors.accent,
    },
    headerPillText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    heroCard: {
      overflow: "hidden",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? "rgba(153,69,255,0.22)" : colors.borderStrong,
      backgroundColor: colors.surface,
      padding: 22,
    },
    heroGlowAccent: {
      position: "absolute",
      width: 190,
      height: 190,
      borderRadius: 95,
      top: -90,
      right: -30,
      backgroundColor: colors.accent,
      opacity: 0.18,
    },
    heroGlowPrimary: {
      position: "absolute",
      width: 150,
      height: 150,
      borderRadius: 75,
      bottom: -70,
      left: -30,
      backgroundColor: colors.primary,
      opacity: 0.12,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 2.1,
      marginBottom: 12,
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "800",
      lineHeight: 34,
      letterSpacing: -1,
    },
    subtitle: {
      color: colors.textSubtle,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 10,
    },
    statRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 20,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface2,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    statValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
      marginTop: 8,
    },
    statNote: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
      marginTop: 4,
    },
    emptyCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 24,
      paddingVertical: 36,
    },
    emptyIconWrap: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: "rgba(153,69,255,0.22)",
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
      marginTop: 18,
    },
    emptyText: {
      color: colors.textSubtle,
      fontSize: 14,
      lineHeight: 22,
      textAlign: "center",
      marginTop: 10,
    },
    listWrap: {
      gap: 12,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    sectionMeta: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    walletCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    walletIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface2,
    },
    walletIconAccent: {
      backgroundColor: colors.accentSoft,
    },
    walletIconPrimary: {
      backgroundColor: colors.primarySoft,
    },
    walletIconBlue: {
      backgroundColor: colors.blueSoft,
    },
    walletInfo: {
      flex: 1,
      gap: 3,
    },
    walletName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    walletAddress: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: "monospace",
    },
    walletRight: {
      alignItems: "flex-end",
      gap: 10,
      marginLeft: 8,
    },
    walletBalance: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    walletError: {
      color: colors.negative,
      fontSize: 12,
      fontWeight: "700",
    },
    removeButton: {
      padding: 4,
    },
  });
