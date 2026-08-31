import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenAtmosphere } from "../../src/components/ScreenAtmosphere";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useWallet } from "../../src/hooks/useWallet";
import { useWalletStore } from "../../src/stores/wallet-store";
import type { ThemeColors } from "../../src/constants/theme";
import { TOKENS, getTokenPrices } from "../../src/services/jupiter";
import type { TokenPrice } from "../../src/services/jupiter";
import {
  getBalance,
  getTokens,
  getTxns,
  isSolanaAddress,
  short,
} from "../../src/utils/helpers";

type TokenItem = {
  mint: string;
  amount: number;
};

type TxnItem = {
  sig: string;
  time: number;
  ok: boolean;
};

type PerformerMeta = {
  mint: string;
  name: string;
  symbol: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
};

type PerformerItem = PerformerMeta & {
  change: string;
  price: string;
  changeUp: boolean;
  points: number[];
};

/** Enough precision to stay meaningful for micro-cap tokens like BONK. */
function formatUsdPrice(value: number) {
  if (value <= 0) return "$0.00";
  if (value < 0.000001) return `$${value.toExponential(2)}`;
  if (value < 0.01) return `$${value.toFixed(8).replace(/0+$/, "")}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatChange(change: number | null) {
  if (change === null) return "--";
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

/**
 * Jupiter's price API gives a spot price and a 24h delta, not a time series.
 * Derive a shape consistent with that delta so the sparkline never implies a
 * trend the data does not support.
 */
function trendPoints(change: number | null) {
  const drift = Math.max(-0.34, Math.min(0.34, (change ?? 0) / 100));
  const start = 0.42 - drift / 2;
  return Array.from({ length: 9 }, (_, index) => {
    const progress = index / 8;
    const eased = progress * progress * (3 - 2 * progress);
    return Math.max(0.08, Math.min(0.92, start + drift * eased));
  });
}

/**
 * Presentation metadata only. Every price and percentage on these cards comes
 * from the live Jupiter price API — nothing here is a hardcoded market value.
 */
const PERFORMER_TOKENS: PerformerMeta[] = [
  {
    mint: TOKENS.JUP,
    name: "Jupiter",
    symbol: "JUP",
    icon: "planet",
    iconColor: "#0E9F6E",
    iconBg: "#E7FFF6",
  },
  {
    mint: TOKENS.BONK,
    name: "Bonk",
    symbol: "BONK",
    icon: "flame",
    iconColor: "#EA580C",
    iconBg: "#FFF2E8",
  },
  {
    mint: TOKENS.WIF,
    name: "dogwifhat",
    symbol: "WIF",
    icon: "sparkles",
    iconColor: "#7C3AED",
    iconBg: "#F3EBFF",
  },
  {
    mint: TOKENS.USDC,
    name: "USD Coin",
    symbol: "USDC",
    icon: "cash",
    iconColor: "#2563EB",
    iconBg: "#EAF1FF",
  },
];

type SparklineProps = {
  color: string;
  lineColor: string;
  points: number[];
  gridColor: string;
  headColor: string;
};

function MiniSparkline({
  color,
  lineColor,
  points,
  gridColor,
  headColor,
}: SparklineProps) {
  const width = 238;
  const height = 88;
  const plotPoints = points.map((point, index) => ({
    x: (index / Math.max(points.length - 1, 1)) * width,
    y: height - point * height,
  }));

  return (
    <View style={[styles.sparkWrap, { width, height }]}>
      <View style={[styles.sparkGridLine, { backgroundColor: gridColor }]} />
      {plotPoints.slice(0, -1).map((point, index) => {
        const next = plotPoints[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        return (
          <View
            key={`segment-${index}`}
            style={[
              styles.sparkSegment,
              {
                left: point.x,
                top: point.y,
                width: length,
                backgroundColor: lineColor,
                transform: [{ rotate: `${angle}rad` }],
              },
            ]}
          />
        );
      })}

      {plotPoints.map((point, index) => (
        <View
          key={`dot-${index}`}
          style={[
            styles.sparkDot,
            {
              left: point.x - 3,
              top: point.y - 3,
              backgroundColor:
                index === plotPoints.length - 1 ? headColor : color,
              width: index === plotPoints.length - 1 ? 16 : 6,
              height: index === plotPoints.length - 1 ? 16 : 6,
              borderRadius: index === plotPoints.length - 1 ? 8 : 3,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function WalletScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  const addToHistory = useWalletStore((s) => s.addToHistory);
  const searchHistory = useWalletStore((s) => s.searchHistory);
  const activeAddress = useWalletStore((s) => s.activeAddress);
  const isDevnet = useWalletStore((s) => s.isDevnet);
  const setActiveAddress = useWalletStore((s) => s.setActiveAddress);
  const toggleTheme = useWalletStore((s) => s.toggleTheme);
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [txns, setTxns] = useState<TxnItem[]>([]);
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState(false);

  const connectedAddress = wallet.publicKey?.toBase58() ?? null;

  const loadWallet = useCallback(async (addressToLoad: string) => {
    setLoading(true);
    setLoadError(null);

    try {
      const [walletBalance, walletTokens, walletTxns] = await Promise.all([
        getBalance(addressToLoad),
        getTokens(addressToLoad),
        getTxns(addressToLoad),
      ]);

      setBalance(walletBalance);
      setTokens(walletTokens);
      setTxns(walletTxns);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load wallet data";
      // Surface this inline rather than in an Alert: a null balance must never
      // be rendered as a real "0.00" holding.
      setLoadError(message);
      setBalance(null);
      setTokens([]);
      setTxns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrices = useCallback(async () => {
    // Jupiter prices are mainnet-only; showing them next to devnet balances
    // would misrepresent what the user holds.
    if (isDevnet) {
      setPrices({});
      setPricesError(false);
      return;
    }

    setPricesLoading(true);
    try {
      const next = await getTokenPrices(PERFORMER_TOKENS.map((t) => t.mint));
      setPrices(next);
      setPricesError(false);
    } catch {
      setPrices({});
      setPricesError(true);
    } finally {
      setPricesLoading(false);
    }
  }, [isDevnet]);

  useEffect(() => {
    if (!activeAddress && connectedAddress) {
      setActiveAddress(connectedAddress);
    }
  }, [activeAddress, connectedAddress, setActiveAddress]);

  useEffect(() => {
    if (!activeAddress) {
      setBalance(null);
      setTokens([]);
      setTxns([]);
      setLoadError(null);
      return;
    }

    setAddress(activeAddress);
    // `isDevnet` belongs in the dep list: the RPC helper reads the network at
    // call time, so a network switch must trigger a refetch.
    void loadWallet(activeAddress);
  }, [activeAddress, isDevnet, loadWallet]);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      activeAddress ? loadWallet(activeAddress) : Promise.resolve(),
      loadPrices(),
    ]);
    setRefreshing(false);
  }, [activeAddress, loadPrices, loadWallet]);

  const performers = useMemo<PerformerItem[]>(
    () =>
      PERFORMER_TOKENS.map((token) => {
        const price = prices[token.mint];
        const change = price?.priceChange24h ?? null;
        return {
          ...token,
          price: price ? formatUsdPrice(price.usdPrice) : "--",
          change: formatChange(change),
          changeUp: (change ?? 0) >= 0,
          points: trendPoints(change),
        };
      }).sort((a, b) => {
        const aChange = prices[a.mint]?.priceChange24h ?? -Infinity;
        const bChange = prices[b.mint]?.priceChange24h ?? -Infinity;
        return bChange - aChange;
      }),
    [prices],
  );

  const profileHandle = activeAddress
    ? `@${activeAddress.slice(0, 10).toLowerCase()}`
    : "@solscanwallet";
  const avatarLetter = activeAddress?.slice(0, 1).toUpperCase() || "A";

  const handleSearch = () => {
    const trimmed = address.trim();
    if (!trimmed) {
      Alert.alert("Enter a wallet address");
      return;
    }

    if (!isSolanaAddress(trimmed)) {
      Alert.alert(
        "Invalid address",
        "That does not look like a Solana address. Check for missing or extra characters.",
      );
      return;
    }

    addToHistory(trimmed);
    setActiveAddress(trimmed);
  };

  const ensureConnected = async () => {
    if (wallet.connected) return wallet.publicKey?.toBase58() ?? null;

    try {
      // `connect()` returns the key directly; reading wallet.publicKey here
      // would still see the pre-connect render's null.
      const key = await wallet.connect();
      return key.toBase58();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not connect wallet";
      Alert.alert("Connection failed", message);
      return null;
    }
  };

  const handleShare = async () => {
    const shareAddress = activeAddress ?? (await ensureConnected());
    if (!shareAddress) return;

    try {
      await Share.share({
        message: `My Solana wallet address: ${shareAddress}`,
      });
    } catch {
      Alert.alert("Share unavailable", "Could not open the share sheet.");
    }
  };

  const handleBuy = async () => {
    if (!(await ensureConnected())) return;
    router.push("/(tabs)/swap");
  };

  const handleSell = async () => {
    if (!(await ensureConnected())) return;
    router.push("/send");
  };

  const handleMore = () => {
    router.push("/watchlist");
  };

  const valueText =
    loadError !== null || balance === null ? "--" : balance.toFixed(2);

  const searchChips = searchHistory.slice(0, 5);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <ScreenAtmosphere colors={colors} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          <Animated.View
            entering={FadeInDown.delay(40).springify()}
            style={styles.headerRow}
          >
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>

            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>{profileHandle}</Text>
              <Text style={styles.profileSubtext}>
                {activeAddress ? short(activeAddress, 4) : "Connect a wallet"}
              </Text>
            </View>
          </View>

          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Ionicons name="share-social" size={18} color={colors.accent} />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconCircle}
              onPress={() => router.push("/(tabs)/settings")}
              activeOpacity={0.85}
            >
              <Ionicons
                name="settings"
                size={24}
                color={isDark ? colors.text : "#24163C"}
              />
            </TouchableOpacity>
          </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(90).springify()}
            style={styles.statusStrip}
          >
            <View style={styles.statusPill}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: wallet.connected ? colors.accent : colors.textMuted },
                ]}
              />
              <Text style={styles.statusPillText}>
                {wallet.connected ? "Wallet connected" : "Guest mode"}
              </Text>
            </View>

            <View style={styles.statusPill}>
              <Ionicons
                name="globe-outline"
                size={14}
                color={isDark ? colors.primary : colors.accent}
              />
              <Text style={styles.statusPillText}>
                {isDevnet ? "Devnet" : "Mainnet"}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(130).springify()}
            style={styles.valueBlock}
          >
          <View style={styles.valueLabelRow}>
            <Text style={styles.valueLabel}>Total value</Text>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={colors.textMuted}
            />
          </View>

          <View style={styles.valueRow}>
            <Text style={styles.valueNumber}>{valueText}</Text>
            <Text style={styles.valueUnit}>SOL</Text>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Refreshing wallet data</Text>
            </View>
          ) : loadError ? (
            <View style={styles.errorRow}>
              <Ionicons
                name="cloud-offline-outline"
                size={16}
                color={colors.negative}
              />
              <Text style={styles.errorText} numberOfLines={2}>
                {loadError}
              </Text>
              <TouchableOpacity
                style={styles.retryChip}
                onPress={() => activeAddress && loadWallet(activeAddress)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Retry loading wallet"
              >
                <Text style={styles.retryChipText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.valueMeta}>
              {tokens.length} assets · {txns.length} recent transactions
            </Text>
          )}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(170).springify()}
            style={styles.actionRow}
          >
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={handleBuy}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryActionText}>Buy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryAction}
            onPress={handleSell}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryActionText}>Sell</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moreAction}
            onPress={handleMore}
            activeOpacity={0.85}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={28}
              color={isDark ? colors.text : "#111111"}
            />
          </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(220).springify()}>
            <TouchableOpacity
              style={styles.verifyCard}
              activeOpacity={0.9}
              onPress={() => router.push("/(tabs)/settings")}
            >
          <View style={styles.verifyArtwork}>
            <View style={styles.verifyPaneLeft} />
            <View style={styles.verifyPaneCenter} />
            <View style={styles.verifyPaneRight} />
            <View style={styles.verifyBeam} />
            <View style={styles.verifyFloor} />
            <View style={styles.verifyFigureLarge} />
            <View style={styles.verifyFigureLargeHead} />
            <View style={styles.verifyFigureSmall} />
            <View style={styles.verifyFigureSmallHead} />
            <View style={styles.verifyWindow} />
            <Text style={styles.verifyTitle}>Verify your account</Text>
          </View>

          <View style={styles.verifyFooter}>
            <Text style={styles.verifyDescription}>
              This helps keep you and others safe. It should only take a couple
              minutes.
            </Text>

            <View style={styles.verifyArrow}>
              <Ionicons name="arrow-forward" size={28} color="#DDEEEA" />
            </View>
          </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(260).springify()}
            style={styles.sectionTitle}
          >
            Top performers (24h)
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(300).springify()}>
            {isDevnet ? (
              <View style={styles.performerNotice}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={colors.textSubtle}
                />
                <Text style={styles.performerNoticeText}>
                  Live prices are unavailable on Devnet. Switch to Mainnet to
                  see market data.
                </Text>
              </View>
            ) : pricesError ? (
              <View style={styles.performerNotice}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={18}
                  color={colors.negative}
                />
                <Text style={styles.performerNoticeText}>
                  Could not load live prices.
                </Text>
                <TouchableOpacity
                  style={styles.retryChip}
                  onPress={() => loadPrices()}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading prices"
                >
                  <Text style={styles.retryChipText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.performersRow}
              >
                {performers.map((item) => (
                  <TouchableOpacity
                    key={item.symbol}
                    style={styles.performerCard}
                    onPress={() => router.push(`/token/${item.mint}`)}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${item.price}, ${item.change} over 24 hours`}
                  >
                    <View style={styles.performerHeader}>
                      <View
                        style={[
                          styles.performerIcon,
                          { backgroundColor: item.iconBg },
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={24}
                          color={item.iconColor}
                        />
                      </View>

                      <View style={styles.performerMetric}>
                        {pricesLoading && !prices[item.mint] ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.textSubtle}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.performerChange,
                              {
                                color: item.changeUp
                                  ? colors.positive
                                  : colors.negative,
                              },
                            ]}
                          >
                            {item.change}
                          </Text>
                        )}
                        <Text style={styles.performerPrice}>{item.price}</Text>
                      </View>

                      <Text style={styles.performerName}>
                        {item.name}, {item.symbol}
                      </Text>
                    </View>

                    <MiniSparkline
                      color={item.iconColor}
                      lineColor={item.iconColor}
                      points={item.points}
                      gridColor={colors.border}
                      headColor={colors.text}
                    />

                    <View style={styles.performerFooter}>
                      <Text style={styles.performerFootnote}>24h change</Text>
                      <Ionicons
                        name={item.changeUp ? "trending-up" : "trending-down"}
                        size={18}
                        color={item.changeUp ? colors.positive : colors.negative}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(340).springify()}
            style={styles.toolsCard}
          >
          <View style={styles.toolsHeader}>
            <Text style={styles.toolsTitle}>Wallet explorer</Text>
            <TouchableOpacity
              style={styles.themeChip}
              onPress={toggleTheme}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isDark ? "moon" : "sunny"}
                size={14}
                color={colors.accent}
              />
              <Text style={styles.themeChipText}>
                {isDark ? "Dark" : "Light"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Paste any Solana wallet address"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              activeOpacity={0.88}
            >
              <Text style={styles.searchButtonText}>Open</Text>
            </TouchableOpacity>
          </View>

          {searchChips.length > 0 ? (
            <View style={styles.chipsWrap}>
              {searchChips.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.searchChip}
                  onPress={() => {
                    setAddress(item);
                    addToHistory(item);
                    setActiveAddress(item);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.searchChipText}>{short(item, 4)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sparkWrap: {
    position: "relative",
    marginTop: 22,
    marginBottom: 8,
  },
  sparkGridLine: {
    position: "absolute",
    top: "55%",
    left: 0,
    right: 0,
    height: 1,
  },
  sparkSegment: {
    position: "absolute",
    height: 3,
    borderRadius: 999,
  },
  sparkDot: {
    position: "absolute",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});

const makeStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: isDark ? colors.background : "#FCFCFD",
    },
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : "#FCFCFD",
    },
    scroll: {
      flex: 1,
      backgroundColor: isDark ? colors.background : "#FCFCFD",
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 140,
    },
    statusStrip: {
      flexDirection: "row",
      gap: 10,
      marginTop: 22,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: isDark ? colors.surface : "rgba(255,255,255,0.84)",
      borderWidth: 1,
      borderColor: isDark ? colors.border : "#EDECF2",
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusPillText: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "700",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
    },
    profileRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.accent,
      shadowOpacity: isDark ? 0.18 : 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    avatarText: {
      color: "#FFFFFF",
      fontSize: 26,
      fontWeight: "800",
    },
    profileTextWrap: {
      flex: 1,
      gap: 2,
    },
    profileName: {
      color: isDark ? colors.text : "#1B1B1F",
      fontSize: 18,
      fontWeight: "800",
    },
    profileSubtext: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    shareButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: isDark ? colors.surface2 : "#F6EEFF",
      borderWidth: 1,
      borderColor: isDark ? colors.borderStrong : "#E8D7FF",
    },
    shareButtonText: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: "700",
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? colors.surface : "#F2F2F5",
    },
    valueBlock: {
      marginTop: 34,
    },
    valueLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    valueLabel: {
      color: colors.textMuted,
      fontSize: 19,
      fontWeight: "500",
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
      marginTop: 14,
    },
    valueNumber: {
      color: isDark ? colors.text : "#050505",
      fontSize: 60,
      lineHeight: 62,
      fontWeight: "800",
      letterSpacing: -2.4,
    },
    valueUnit: {
      color: colors.textMuted,
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 10,
    },
    valueMeta: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 10,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 26,
    },
    primaryAction: {
      flex: 1,
      height: 72,
      borderRadius: 999,
      backgroundColor: isDark ? colors.text : "#030303",
      alignItems: "center",
      justifyContent: "center",
    },
    primaryActionText: {
      color: isDark ? colors.background : "#FFFFFF",
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.4,
    },
    moreAction: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? colors.surface : "#F1F1F4",
      alignItems: "center",
      justifyContent: "center",
    },
    verifyCard: {
      marginTop: 28,
      borderRadius: 28,
      overflow: "hidden",
      backgroundColor: "#153A34",
    },
    verifyArtwork: {
      height: 255,
      backgroundColor: "#3E7D48",
      position: "relative",
      overflow: "hidden",
    },
    verifyPaneLeft: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "38%",
      backgroundColor: "#24503F",
    },
    verifyPaneCenter: {
      position: "absolute",
      left: "32%",
      top: 0,
      bottom: 0,
      width: "34%",
      backgroundColor: "#51A85B",
      opacity: 0.85,
    },
    verifyPaneRight: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: "34%",
      backgroundColor: "#7FDF76",
      opacity: 0.95,
    },
    verifyBeam: {
      position: "absolute",
      right: "18%",
      top: 32,
      width: 180,
      height: 160,
      backgroundColor: "rgba(255,255,255,0.18)",
      transform: [{ skewX: "-16deg" }],
    },
    verifyFloor: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 54,
      backgroundColor: "#0F2826",
    },
    verifyFigureLarge: {
      position: "absolute",
      left: 46,
      bottom: 58,
      width: 112,
      height: 110,
      borderTopLeftRadius: 54,
      borderTopRightRadius: 54,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      backgroundColor: "#10252A",
    },
    verifyFigureLargeHead: {
      position: "absolute",
      left: 74,
      bottom: 148,
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "#10252A",
    },
    verifyFigureSmall: {
      position: "absolute",
      right: 108,
      bottom: 64,
      width: 62,
      height: 92,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      backgroundColor: "rgba(17,38,34,0.55)",
    },
    verifyFigureSmallHead: {
      position: "absolute",
      right: 122,
      bottom: 144,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(17,38,34,0.55)",
    },
    verifyWindow: {
      position: "absolute",
      right: 64,
      top: 116,
      width: 130,
      height: 78,
      borderWidth: 3,
      borderColor: "rgba(57,105,71,0.70)",
    },
    verifyTitle: {
      position: "absolute",
      left: 24,
      bottom: 32,
      color: "#FFFFFF",
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -1,
    },
    verifyFooter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: "#102C2A",
      paddingHorizontal: 24,
      paddingVertical: 22,
    },
    verifyDescription: {
      flex: 1,
      color: "#E6F3EF",
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "500",
    },
    verifyArrow: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      marginTop: 36,
      color: isDark ? colors.text : "#050505",
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -1,
    },
    performersRow: {
      paddingTop: 18,
      paddingRight: 20,
      gap: 16,
    },
    performerNotice: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 16,
      paddingHorizontal: 18,
    },
    performerNoticeText: {
      flex: 1,
      color: colors.textSubtle,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "500",
    },
    errorRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    errorText: {
      flex: 1,
      color: colors.negative,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },
    retryChip: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 16,
      borderRadius: 22,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    retryChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    performerCard: {
      width: 320,
      borderRadius: 30,
      backgroundColor: isDark ? colors.surface : "#FFFFFF",
      padding: 24,
      borderWidth: 1,
      borderColor: isDark ? colors.border : "#F1F1F3",
      shadowColor: "#000000",
      shadowOpacity: isDark ? 0.16 : 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    performerHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
    },
    performerIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    performerMetric: {
      gap: 4,
    },
    performerChange: {
      color: isDark ? colors.text : "#050505",
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    performerPrice: {
      color: colors.textMuted,
      fontSize: 17,
      fontWeight: "500",
    },
    performerName: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 17,
      fontWeight: "500",
      textAlign: "right",
    },
    performerFooter: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    performerFootnote: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    toolsCard: {
      marginTop: 28,
      borderRadius: 28,
      backgroundColor: isDark ? colors.surface : "#FFFFFF",
      padding: 22,
      borderWidth: 1,
      borderColor: isDark ? colors.border : "#F0F0F2",
    },
    toolsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    toolsTitle: {
      color: isDark ? colors.text : "#111111",
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    themeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: isDark ? colors.accentSoft : "#F7EFFF",
    },
    themeChipText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "700",
    },
    searchRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 18,
    },
    searchInput: {
      flex: 1,
      height: 56,
      borderRadius: 18,
      backgroundColor: isDark ? colors.surface2 : "#F4F5F7",
      paddingHorizontal: 16,
      color: isDark ? colors.text : "#111111",
      fontSize: 15,
      fontWeight: "500",
    },
    searchButton: {
      paddingHorizontal: 20,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    searchButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 16,
    },
    searchChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: isDark ? colors.surface2 : "#F4F5F7",
    },
    searchChipText: {
      color: isDark ? colors.text : "#2C2D32",
      fontSize: 13,
      fontWeight: "700",
    },
  });
