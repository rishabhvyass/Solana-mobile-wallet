import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useWalletStore } from "../../src/stores/wallet-store";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { ScreenAtmosphere } from "../../src/components/ScreenAtmosphere";
import type { ThemeColors } from "../../src/constants/theme";
import { getTxns, short, timeAgo } from "../../src/utils/helpers";

type TxnItem = {
  sig: string;
  time: number;
  ok: boolean;
};

type FilterKey = "all" | "success" | "failed";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "success", label: "Confirmed" },
  { key: "failed", label: "Failed" },
];

export default function ActivityScreen() {
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  const activeAddress = useWalletStore((s) => s.activeAddress);
  const connectedPublicKey = useWalletStore((s) => s.connectedPublicKey);
  const isDevnet = useWalletStore((s) => s.isDevnet);
  const insets = useSafeAreaInsets();
  const walletAddress = activeAddress ?? connectedPublicKey;
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [transactions, setTransactions] = useState<TxnItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadTransactions = useCallback(
    async (address: string, isRefresh = false) => {
      // Tag each fetch: switching address or network mid-request must not let
      // the older reply overwrite the newer one when it finally lands.
      const requestId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const nextTransactions = await getTxns(address);
        if (requestId !== requestIdRef.current) return;
        setTransactions(nextTransactions);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (requestId !== requestIdRef.current) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load transaction history";
        setTransactions([]);
        setErrorMessage(message);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!walletAddress) {
      requestIdRef.current += 1;
      setTransactions([]);
      setErrorMessage(null);
      return;
    }

    void loadTransactions(walletAddress);
    // `getTxns` resolves the cluster from the store when it runs, so a network
    // toggle has to retrigger this or the list keeps showing the old chain.
  }, [walletAddress, isDevnet, loadTransactions]);

  const filteredTransactions = transactions.filter((item) => {
    if (filter === "success") return item.ok;
    if (filter === "failed") return !item.ok;
    return true;
  });
  const confirmedCount = transactions.filter((item) => item.ok).length;
  const failedCount = transactions.filter((item) => !item.ok).length;

  const openTransaction = (signature: string) => {
    const clusterParam = isDevnet ? "?cluster=devnet" : "";
    void Linking.openURL(`https://solscan.io/tx/${signature}${clusterParam}`);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.container}>
        <ScreenAtmosphere colors={colors} />

        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.content,
            // Clear the floating tab bar so the last row is fully reachable.
            { paddingBottom: 76 + Math.max(12, insets.bottom) + 28 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                if (!walletAddress) return;
                void loadTransactions(walletAddress, true);
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <Animated.View entering={FadeInDown.delay(40).springify()}>
            <Text style={s.eyebrow}>Activity</Text>
            <Text style={s.title}>Recent wallet moves</Text>
            <Text style={s.subtitle}>
              {walletAddress
                ? `${short(walletAddress, 6)} on ${isDevnet ? "Devnet" : "Mainnet"}`
                : "Connect or search a wallet to see its transaction history."}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            style={s.summaryCard}
          >
            <View style={s.summaryGlow} />
            <View style={s.summaryRow}>
              <View style={s.summaryStat}>
                <Text style={s.summaryValue}>{transactions.length}</Text>
                <Text style={s.summaryLabel}>Total</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryStat}>
                <Text style={[s.summaryValue, { color: colors.positive }]}>
                  {confirmedCount}
                </Text>
                <Text style={s.summaryLabel}>Confirmed</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryStat}>
                <Text style={[s.summaryValue, { color: colors.negative }]}>
                  {failedCount}
                </Text>
                <Text style={s.summaryLabel}>Failed</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={s.filterRow}
          >
            {FILTERS.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  s.filterChip,
                  filter === item.key && s.filterChipActive,
                ]}
                onPress={() => setFilter(item.key)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === item.key }}
                accessibilityLabel={`Show ${item.label.toLowerCase()} transactions`}
              >
                <Text
                  style={[
                    s.filterChipText,
                    filter === item.key && s.filterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          {loading ? (
            <View style={s.loadingCard}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : errorMessage ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>Couldn&apos;t load activity</Text>
              <Text style={s.emptyText}>{errorMessage}</Text>
              {walletAddress && (
                <TouchableOpacity
                  style={s.retryChip}
                  onPress={() => void loadTransactions(walletAddress)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading activity"
                >
                  <Ionicons name="refresh" size={15} color={colors.accent} />
                  <Text style={s.retryChipText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : filteredTransactions.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(160).springify()}>
              <Text style={s.groupLabel}>Latest</Text>
              {filteredTransactions.map((item, index) => (
                <Animated.View
                  key={item.sig}
                  entering={FadeInDown.delay(190 + index * 40).springify()}
                >
                  <TouchableOpacity
                    style={s.txRow}
                    onPress={() => openTransaction(item.sig)}
                    activeOpacity={0.85}
                    accessibilityRole="link"
                    accessibilityLabel={`Transaction ${short(item.sig, 8)}, ${
                      item.ok ? "confirmed" : "failed"
                    }${item.time ? `, ${timeAgo(item.time)}` : ""}. Opens Solscan.`}
                  >
                    <View
                      style={[
                        s.txIconWrap,
                        item.ok ? s.txIconPositive : s.txIconNegative,
                      ]}
                    >
                      <Ionicons
                        name={item.ok ? "checkmark" : "close"}
                        size={16}
                        color={item.ok ? colors.positive : colors.negative}
                      />
                    </View>

                    <View style={s.txInfo}>
                      <Text style={s.txName}>{short(item.sig, 8)}</Text>
                      <Text style={s.txMeta}>
                        {item.time ? timeAgo(item.time) : "Pending"} ·{" "}
                        {item.ok ? "Confirmed" : "Failed"}
                      </Text>
                    </View>

                    <Text
                      style={[
                        s.txValue,
                        { color: item.ok ? colors.positive : colors.negative },
                      ]}
                    >
                      {item.ok ? "Done" : "Error"}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </Animated.View>
          ) : !walletAddress ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No wallet selected</Text>
              <Text style={s.emptyText}>
                Connect a wallet or search an address on the Portfolio tab to
                see its transaction history here.
              </Text>
            </View>
          ) : transactions.length > 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>Nothing matches this filter</Text>
              <Text style={s.emptyText}>
                This wallet has {transactions.length} recent transaction
                {transactions.length === 1 ? "" : "s"}, but none are{" "}
                {filter === "success" ? "confirmed" : "failed"}. Switch back to
                All to see them.
              </Text>
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptyText}>
                This wallet has no recent activity on{" "}
                {isDevnet ? "Devnet" : "Mainnet"}. Pull down to refresh.
              </Text>
            </View>
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
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    eyebrow: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "800",
      marginTop: 10,
    },
    subtitle: {
      color: colors.textSubtle,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 8,
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 18,
      marginBottom: 8,
    },
    summaryCard: {
      marginTop: 18,
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      padding: 18,
    },
    summaryGlow: {
      position: "absolute",
      top: -40,
      right: -30,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? "rgba(153,69,255,0.20)" : "rgba(124,58,237,0.10)",
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    summaryStat: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    summaryDivider: {
      width: 1,
      alignSelf: "stretch",
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.7,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    filterChip: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface2,
      paddingHorizontal: 16,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    filterChipActive: {
      backgroundColor: colors.accentSoft,
      borderColor: "rgba(153,69,255,0.28)",
    },
    filterChipText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    filterChipTextActive: {
      color: colors.accent,
    },
    groupLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      textTransform: "uppercase",
      marginVertical: 14,
    },
    loadingCard: {
      marginTop: 20,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 10,
    },
    txIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    txIconPositive: {
      backgroundColor: colors.primarySoft,
    },
    txIconNegative: {
      backgroundColor: "rgba(239,68,68,0.12)",
    },
    txInfo: {
      flex: 1,
    },
    txName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      fontFamily: "monospace",
    },
    txMeta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 3,
    },
    txValue: {
      fontSize: 12,
      fontWeight: "800",
    },
    emptyCard: {
      marginTop: 22,
      backgroundColor: isDark ? colors.surface : colors.surface2,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 8,
    },
    retryChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      gap: 7,
      marginTop: 14,
      paddingHorizontal: 16,
      minHeight: 44,
      borderRadius: 14,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: "rgba(153,69,255,0.28)",
    },
    retryChipText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "800",
    },
  });
