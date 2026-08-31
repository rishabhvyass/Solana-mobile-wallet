import { useMemo } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ScreenAtmosphere } from "../../src/components/ScreenAtmosphere";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useWalletStore } from "../../src/stores/wallet-store";
import type { ThemeColors } from "../../src/constants/theme";
import { short } from "../../src/utils/helpers";

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const theme = useWalletStore((s) => s.theme);
  const isDark = theme === "dark";
  const toggleTheme = useWalletStore((s) => s.toggleTheme);
  const isDevnet = useWalletStore((s) => s.isDevnet);
  const toggleNetwork = useWalletStore((s) => s.toggleNetwork);
  const favorites = useWalletStore((s) => s.favorites);
  const searchHistory = useWalletStore((s) => s.searchHistory);
  const clearHistory = useWalletStore((s) => s.clearHistory);
  const connectedPublicKey = useWalletStore((s) => s.connectedPublicKey);
  const activeAddress = useWalletStore((s) => s.activeAddress);
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  // `activeAddress` can be an address the user merely searched for, so the card
  // must not label it "Main Wallet" just because some wallet is connected.
  const displayAddress = activeAddress ?? connectedPublicKey;
  const isOwnWallet =
    connectedPublicKey !== null &&
    (activeAddress === null || activeAddress === connectedPublicKey);
  const walletLabel = isOwnWallet
    ? "Main Wallet"
    : displayAddress
      ? "Watching Wallet"
      : "Guest Mode";

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
        >
          <Animated.Text entering={FadeInDown.delay(40).springify()} style={s.eyebrow}>
            Profile
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(70).springify()} style={s.title}>
            Wallet preferences
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(100).springify()} style={s.subtitle}>
            Keep the app tuned the way you like while keeping your saved wallets
            close.
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(130).springify()} style={s.heroCard}>
            <View style={s.avatar}>
              <Ionicons name="person" size={22} color="#FFFFFF" />
            </View>

            <Text style={s.heroTitle}>{walletLabel}</Text>
            <Text style={s.heroAddress}>
              {displayAddress
                ? short(displayAddress, 8)
                : "No active wallet selected"}
            </Text>

            <View style={s.heroMetaRow}>
              <View style={s.heroChip}>
                <Ionicons
                  name={isDevnet ? "flask" : "globe-outline"}
                  size={12}
                  color={isDevnet ? colors.warning : colors.positive}
                />
                <Text style={s.heroChipText}>
                  {isDevnet ? "Devnet" : "Mainnet"}
                </Text>
              </View>

              <View style={s.heroChip}>
                <Ionicons
                  name={isDark ? "moon" : "sunny"}
                  size={12}
                  color={colors.accent}
                />
                <Text style={s.heroChipText}>
                  {isDark ? "Dark" : "Light"}
                </Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).springify()}>
            <Text style={s.sectionTitle}>Quick Actions</Text>
            <View style={s.quickRow}>
              <TouchableOpacity
                style={s.quickButton}
                onPress={() => router.push("/receive")}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Receive"
                accessibilityHint="Shows a QR code for your wallet address"
              >
                <View style={[s.quickIconWrap, s.quickIconAccent]}>
                  <Ionicons name="download-outline" size={18} color={colors.accent} />
                </View>
                <Text style={s.quickTitle}>Receive</Text>
                <Text style={s.quickSubtitle}>Share your wallet address</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.quickButton}
                onPress={() => router.push("/watchlist")}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Watchlist"
                accessibilityHint="Opens the wallets you saved"
              >
                <View style={[s.quickIconWrap, s.quickIconPrimary]}>
                  <Ionicons name="heart-outline" size={18} color={colors.positive} />
                </View>
                <Text style={s.quickTitle}>Watchlist</Text>
                <Text style={s.quickSubtitle}>Open saved wallets fast</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(190).springify()}>
            <Text style={s.sectionTitle}>Preferences</Text>
            <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <View style={[s.iconBox, isDevnet && s.iconBoxWarm]}>
                  <Ionicons
                    name={isDevnet ? "flask" : "globe-outline"}
                    size={18}
                    color={isDevnet ? colors.warning : colors.positive}
                  />
                </View>
                <View style={s.rowText}>
                  <Text style={s.label}>Network</Text>
                  <Text style={s.sublabel}>
                    {isDevnet
                      ? "Testing network with free SOL"
                      : "Production network for real balances"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDevnet}
                onValueChange={toggleNetwork}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
                thumbColor={colors.surface}
                accessibilityLabel="Use Devnet"
                accessibilityHint="Switches balances and activity between Devnet and Mainnet"
              />
            </View>

            <View style={s.divider} />

            <View style={s.row}>
              <View style={s.rowLeft}>
                <View style={s.iconBox}>
                  <Ionicons
                    name={isDark ? "moon" : "sunny"}
                    size={18}
                    color={colors.accent}
                  />
                </View>
                <View style={s.rowText}>
                  <Text style={s.label}>Appearance</Text>
                  <Text style={s.sublabel}>
                    Toggle between the bright and dark wallet themes
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
                thumbColor={colors.surface}
                accessibilityLabel="Dark theme"
              />
            </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(220).springify()}>
            <Text style={s.sectionTitle}>Saved Data</Text>
            <View style={s.card}>
            <TouchableOpacity
              style={s.row}
              onPress={() => router.push("/watchlist")}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Saved wallets, ${favorites.length}`}
              accessibilityHint="Opens your watchlist"
            >
              <View style={s.rowLeft}>
                <View style={s.iconBox}>
                  <Ionicons name="heart" size={18} color={colors.positive} />
                </View>
                <View style={s.rowText}>
                  <Text style={s.label}>Saved Wallets</Text>
                  <Text style={s.sublabel}>
                    Quickly reopen wallet addresses you track
                  </Text>
                </View>
              </View>
              <View style={s.counter}>
                <Text style={s.counterText}>{favorites.length}</Text>
              </View>
            </TouchableOpacity>

            <View style={s.divider} />

            <View style={s.row}>
              <View style={s.rowLeft}>
                <View style={s.iconBox}>
                  <Ionicons name="time-outline" size={18} color={colors.blue} />
                </View>
                <View style={s.rowText}>
                  <Text style={s.label}>Search History</Text>
                  <Text style={s.sublabel}>
                    Recent addresses you searched from the portfolio tab
                  </Text>
                </View>
              </View>
              <View style={s.counter}>
                <Text style={s.counterText}>{searchHistory.length}</Text>
              </View>
            </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <TouchableOpacity
              style={s.dangerButton}
              onPress={() => {
                Alert.alert(
                  "Clear History",
                  "This removes your recent wallet searches but keeps your saved wallets.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear", style: "destructive", onPress: clearHistory },
                  ],
                );
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={s.dangerText}>Clear search history</Text>
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
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 120,
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
    heroCard: {
      marginTop: 22,
      backgroundColor: isDark ? "#10172A" : colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: isDark ? "rgba(153,69,255,0.22)" : colors.borderStrong,
      padding: 22,
      alignItems: "center",
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
      marginTop: 14,
    },
    heroAddress: {
      color: colors.textMuted,
      fontSize: 13,
      fontFamily: "monospace",
      marginTop: 6,
    },
    heroMetaRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    heroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    heroChipText: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "700",
    },
    quickRow: {
      flexDirection: "row",
      gap: 12,
    },
    quickButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      minHeight: 124,
    },
    quickIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    quickIconAccent: {
      backgroundColor: colors.accentSoft,
    },
    quickIconPrimary: {
      backgroundColor: colors.primarySoft,
    },
    quickTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    quickSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 6,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginTop: 24,
      marginBottom: 10,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 12,
    },
    rowLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.surface2,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBoxWarm: {
      backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(217,119,6,0.12)",
    },
    label: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    sublabel: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    counter: {
      minWidth: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    counterText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "800",
    },
    dangerButton: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: isDark ? "rgba(239,68,68,0.08)" : "rgba(220,38,38,0.06)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(239,68,68,0.18)" : "rgba(220,38,38,0.18)",
      borderRadius: 18,
      paddingVertical: 16,
    },
    dangerText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "800",
    },
  });
