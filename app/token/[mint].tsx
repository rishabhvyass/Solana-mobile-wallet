import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenAtmosphere } from "../../src/components/ScreenAtmosphere";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useWalletStore } from "../../src/stores/wallet-store";
import type { ThemeColors } from "../../src/constants/theme";
import { short } from "../../src/utils/helpers";

interface TokenPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange: {
    h24: number;
  };
  volume: {
    h24: number;
  };
  liquidity: {
    usd: number;
  };
  fdv: number;
  marketCap: number;
  info?: {
    imageUrl?: string;
  };
}

interface DexScreenerResponse {
  pairs: TokenPair[] | null;
}

/** DexScreener is a third party; don't let a hung socket freeze the screen. */
const DEXSCREENER_TIMEOUT_MS = 12000;

const formatPrice = (value: string | number) => {
  const price = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(price)) {
    return "--";
  }

  if (price < 0.0001) {
    return `$${price.toExponential(4)}`;
  }

  if (price < 1) {
    return `$${price.toFixed(6)}`;
  }

  return `$${price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatLargeNumber = (value: number | undefined) => {
  const amount = value ?? 0;

  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`;
  if (amount <= 0) return "--";
  return `$${amount.toFixed(2)}`;
};

const formatUsdValue = (value: number) => {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function TokenDetailScreen() {
  const params = useLocalSearchParams<{
    mint?: string | string[];
    amount?: string | string[];
  }>();
  const mint = Array.isArray(params.mint) ? params.mint[0] : params.mint;
  const rawAmount = Array.isArray(params.amount) ? params.amount[0] : params.amount;
  const amount = rawAmount ? Number(rawAmount) : null;

  const router = useRouter();
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [tokenData, setTokenData] = useState<TokenPair | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!mint) {
      setError("Missing token mint");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEXSCREENER_TIMEOUT_MS);

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`DexScreener returned ${response.status}`);
        }

        const data: DexScreenerResponse = await response.json();

        // DexScreener returns every pair the mint appears in, including ones
        // where it is the *quote* side. Those pairs describe a different token,
        // so their name, price and 24h change belong to that other token —
        // using one would misprice the user's holdings. Keep only pairs where
        // this mint is the base token.
        const ownPairs = (data.pairs ?? []).filter(
          (pair) =>
            pair.chainId === "solana" &&
            pair.baseToken?.address?.toLowerCase() === mint.toLowerCase(),
        );

        if (ownPairs.length === 0) {
          throw new Error("No Solana market found for this token");
        }

        // Deepest pool is the most representative price.
        const bestPair = ownPairs.reduce((best, current) =>
          (current.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0)
            ? current
            : best,
        );

        if (!cancelled) setTokenData(bestPair);
      } catch (fetchError: unknown) {
        if (cancelled) return;
        setTokenData(null);
        setError(
          fetchError instanceof Error
            ? fetchError.name === "AbortError"
              ? "DexScreener took too long to respond."
              : fetchError.message
            : "Failed to load token data",
        );
      } finally {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [mint, reloadKey]);

  const openDexScreener = () => {
    if (!mint) return;
    void Linking.openURL(`https://dexscreener.com/solana/${mint}`);
  };

  const openSolscan = () => {
    if (!mint) return;
    void Linking.openURL(`https://solscan.io/token/${mint}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.container}>
          <ScreenAtmosphere colors={colors} />
          <View style={s.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={s.iconButton}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.topBarTitle}>Token</Text>
            <View style={s.iconSpacer} />
          </View>

          <View style={s.centerState}>
            <View style={s.stateCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={s.stateTitle}>Fetching market overview</Text>
              <Text style={s.stateText}>
                Pulling the best Solana pair from DexScreener.
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !tokenData) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.container}>
          <ScreenAtmosphere colors={colors} />
          <View style={s.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={s.iconButton}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={s.topBarTitle}>Token</Text>
            <View style={s.iconSpacer} />
          </View>

          <View style={s.centerState}>
            <View style={s.stateCard}>
              <View style={s.errorIconWrap}>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color={colors.danger}
                />
              </View>
              <Text style={s.stateTitle}>Couldn&apos;t load token data</Text>
              <Text style={s.stateText}>{error ?? "Token not found"}</Text>
              <Text style={s.mintValue}>{mint ? short(mint, 8) : "Unknown mint"}</Text>

              {mint ? (
                <TouchableOpacity
                  style={s.primaryButton}
                  onPress={() => setReloadKey((key) => key + 1)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Try loading token data again"
                >
                  <Ionicons name="refresh" size={18} color="#FFFFFF" />
                  <Text style={s.primaryButtonText}>Try again</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[s.secondaryButton, s.stateSecondaryButton]}
                onPress={openSolscan}
                activeOpacity={0.85}
                accessibilityRole="link"
                accessibilityLabel="Open this token on Solscan"
              >
                <Ionicons name="search" size={18} color={colors.accent} />
                <Text style={s.secondaryButtonText}>Open in Solscan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const priceChange = tokenData.priceChange?.h24 || 0;
  const isPositive = priceChange >= 0;
  const numericPrice = Number(tokenData.priceUsd || "0");
  const usdValue =
    amount !== null && Number.isFinite(amount) ? numericPrice * amount : null;

  const overviewCards = [
    {
      label: "24h Volume",
      value: formatLargeNumber(tokenData.volume?.h24),
      tone: "blue" as const,
      icon: "bar-chart-outline" as const,
    },
    {
      label: "Liquidity",
      value: formatLargeNumber(tokenData.liquidity?.usd),
      tone: "primary" as const,
      icon: "water-outline" as const,
    },
    {
      label: "Market Cap",
      value: formatLargeNumber(tokenData.marketCap),
      tone: "accent" as const,
      icon: "planet-outline" as const,
    },
  ];

  const marketRows = [
    { label: "Current Price", value: formatPrice(tokenData.priceUsd) },
    {
      label: "24h Change",
      value: `${isPositive ? "+" : "-"}${Math.abs(priceChange).toFixed(2)}%`,
    },
    { label: "FDV", value: formatLargeNumber(tokenData.fdv) },
    { label: "Pair Liquidity", value: formatLargeNumber(tokenData.liquidity?.usd) },
  ];

  const infoRows = [
    { label: "Token Mint", value: short(mint ?? tokenData.baseToken.address, 6), mono: true },
    { label: "Pair", value: short(tokenData.pairAddress, 6), mono: true },
    { label: "Network", value: "Solana" },
    { label: "DEX", value: tokenData.dexId.toUpperCase() },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.container}>
        <ScreenAtmosphere colors={colors} />

        <View style={s.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.iconButton}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={s.topBarTitle}>Token</Text>

          <TouchableOpacity
            onPress={openDexScreener}
            style={s.iconButton}
            activeOpacity={0.85}
            accessibilityRole="link"
            accessibilityLabel="Open this token on DexScreener"
          >
            <Ionicons name="open-outline" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.content}
        >
          <Animated.View entering={FadeInDown.delay(50).springify()} style={s.heroCard}>
            <View style={s.heroGlowAccent} />
            <View style={s.heroGlowPrimary} />

            <View style={s.heroHeader}>
              {tokenData.info?.imageUrl ? (
                <Image source={{ uri: tokenData.info.imageUrl }} style={s.tokenLogo} />
              ) : (
                <View style={[s.tokenLogo, s.placeholderLogo]}>
                  <Text style={s.placeholderText}>
                    {tokenData.baseToken.symbol?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
              )}

              <View style={s.heroTextWrap}>
                <Text style={s.eyebrow}>Token Overview</Text>
                <Text style={s.tokenName}>{tokenData.baseToken.name}</Text>
                <Text style={s.tokenMeta}>
                  {tokenData.baseToken.symbol} · {short(mint ?? tokenData.baseToken.address, 6)}
                </Text>
              </View>
            </View>

            <View style={s.priceRow}>
              <View>
                <Text style={s.priceLabel}>Live Price</Text>
                <Text style={s.priceValue}>{formatPrice(tokenData.priceUsd)}</Text>
              </View>

              <View
                style={[
                  s.changePill,
                  isPositive ? s.changePillPositive : s.changePillNegative,
                ]}
              >
                <Ionicons
                  name={isPositive ? "caret-up" : "caret-down"}
                  size={13}
                  color={isPositive ? colors.positive : colors.negative}
                />
                <Text
                  style={[
                    s.changeText,
                    isPositive ? s.changeTextPositive : s.changeTextNegative,
                  ]}
                >
                  {Math.abs(priceChange).toFixed(2)}%
                </Text>
              </View>
            </View>

            {amount !== null && Number.isFinite(amount) ? (
              <View style={s.holdingsCard}>
                <Text style={s.holdingsLabel}>Your position</Text>
                <Text style={s.holdingsAmount}>
                  {amount.toLocaleString()} {tokenData.baseToken.symbol}
                </Text>
                <Text style={s.holdingsValue}>
                  {usdValue !== null ? formatUsdValue(usdValue) : "--"}
                </Text>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(90).springify()} style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Market pulse</Text>
            <Text style={s.sectionMeta}>Best pair on DexScreener</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).springify()} style={s.overviewGrid}>
            {overviewCards.map((card) => (
              <View key={card.label} style={s.overviewCard}>
                <View
                  style={[
                    s.overviewIcon,
                    card.tone === "accent" && s.overviewAccent,
                    card.tone === "primary" && s.overviewPrimary,
                    card.tone === "blue" && s.overviewBlue,
                  ]}
                >
                  <Ionicons
                    name={card.icon}
                    size={17}
                    color={
                      card.tone === "accent"
                        ? colors.accent
                        : card.tone === "primary"
                          ? colors.positive
                          : colors.blue
                    }
                  />
                </View>
                <Text style={s.overviewLabel}>{card.label}</Text>
                <Text style={s.overviewValue}>{card.value}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).springify()} style={s.infoCard}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Market Data</Text>
              <Text style={s.cardMeta}>Updated live</Text>
            </View>

            {marketRows.map((row, index) => (
              <View
                key={row.label}
                style={[
                  s.infoRow,
                  index === marketRows.length - 1 && s.infoRowLast,
                ]}
              >
                <Text style={s.infoLabel}>{row.label}</Text>
                <Text
                  style={[
                    s.infoValue,
                    row.label === "24h Change" &&
                      (isPositive ? s.changeTextPositive : s.changeTextNegative),
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).springify()} style={s.infoCard}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Token Info</Text>
              <Text style={s.cardMeta}>Contract details</Text>
            </View>

            {infoRows.map((row, index) => (
              <View
                key={row.label}
                style={[
                  s.infoRow,
                  index === infoRows.length - 1 && s.infoRowLast,
                ]}
              >
                <Text style={s.infoLabel}>{row.label}</Text>
                <Text style={[s.infoValue, row.mono && s.infoValueMono]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(210).springify()} style={s.actionsRow}>
            <TouchableOpacity
              style={s.primaryButton}
              onPress={openDexScreener}
              activeOpacity={0.9}
              accessibilityRole="link"
              accessibilityLabel="Open this token on DexScreener"
            >
              <Ionicons name="stats-chart" size={18} color="#FFFFFF" />
              <Text style={s.primaryButtonText}>DexScreener</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryButton}
              onPress={openSolscan}
              activeOpacity={0.85}
              accessibilityRole="link"
              accessibilityLabel="Open this token on Solscan"
            >
              <Ionicons name="search" size={18} color={colors.accent} />
              <Text style={s.secondaryButtonText}>Solscan</Text>
            </TouchableOpacity>
          </Animated.View>
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
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 10,
    },
    topBarTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    iconSpacer: {
      width: 42,
      height: 42,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      gap: 16,
    },
    heroCard: {
      overflow: "hidden",
      borderRadius: 26,
      borderWidth: 1,
      borderColor: isDark ? "rgba(153,69,255,0.22)" : colors.borderStrong,
      backgroundColor: colors.surface,
      padding: 22,
    },
    heroGlowAccent: {
      position: "absolute",
      width: 210,
      height: 210,
      borderRadius: 105,
      top: -105,
      right: -40,
      backgroundColor: colors.accent,
      opacity: 0.18,
    },
    heroGlowPrimary: {
      position: "absolute",
      width: 170,
      height: 170,
      borderRadius: 85,
      bottom: -85,
      left: -30,
      backgroundColor: colors.primary,
      opacity: 0.12,
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    tokenLogo: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface2,
    },
    placeholderLogo: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    placeholderText: {
      color: colors.accent,
      fontSize: 26,
      fontWeight: "800",
    },
    heroTextWrap: {
      flex: 1,
      gap: 3,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 2,
    },
    tokenName: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.7,
    },
    tokenMeta: {
      color: colors.textSubtle,
      fontSize: 13,
      fontWeight: "600",
    },
    priceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 22,
      gap: 12,
    },
    priceLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.3,
      marginBottom: 8,
    },
    priceValue: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: -1,
    },
    changePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
    },
    changePillPositive: {
      backgroundColor: colors.primarySoft,
      borderColor: "rgba(20,241,149,0.22)",
    },
    changePillNegative: {
      backgroundColor: "rgba(239,68,68,0.12)",
      borderColor: "rgba(239,68,68,0.18)",
    },
    changeText: {
      fontSize: 13,
      fontWeight: "800",
    },
    changeTextPositive: {
      color: colors.positive,
    },
    changeTextNegative: {
      color: colors.negative,
    },
    holdingsCard: {
      marginTop: 18,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    holdingsLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    holdingsAmount: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
      marginTop: 8,
    },
    holdingsValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      marginTop: 4,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    sectionMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    overviewGrid: {
      gap: 12,
    },
    overviewCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    overviewIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    overviewAccent: {
      backgroundColor: colors.accentSoft,
    },
    overviewPrimary: {
      backgroundColor: colors.primarySoft,
    },
    overviewBlue: {
      backgroundColor: colors.blueSoft,
    },
    overviewLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.1,
    },
    overviewValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
      marginTop: 8,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    cardMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 4,
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
      flex: 1,
    },
    infoValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "right",
      flexShrink: 1,
    },
    infoValueMono: {
      fontFamily: "monospace",
    },
    actionsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 4,
    },
    primaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 18,
      paddingVertical: 17,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
    secondaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.surface2,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingVertical: 17,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    stateSecondaryButton: {
      width: "100%",
      marginTop: 12,
    },
    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    stateCard: {
      width: "100%",
      alignItems: "center",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    stateTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
      marginTop: 18,
      textAlign: "center",
    },
    stateText: {
      color: colors.textSubtle,
      fontSize: 14,
      lineHeight: 22,
      textAlign: "center",
      marginTop: 10,
    },
    errorIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(239,68,68,0.12)",
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.18)",
    },
    mintValue: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: "monospace",
      marginTop: 10,
      marginBottom: 20,
    },
  });
