import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PublicKey } from "@solana/web3.js";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWallet, TransactionFailedError } from "../src/hooks/useWallet";
import { useWalletStore } from "../src/stores/wallet-store";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { ScreenAtmosphere } from "../src/components/ScreenAtmosphere";
import type { ThemeColors } from "../src/constants/theme";
import { short } from "../src/utils/helpers";

function normalizeRecipientAddress(input: string) {
  let value = input.trim();

  const solscanMatch = value.match(
    /solscan\.io\/(?:account|address|token)\/([^/?#]+)/i,
  );
  if (solscanMatch?.[1]) value = solscanMatch[1];

  if (value.toLowerCase().startsWith("solana:")) {
    value = value.slice("solana:".length);
    if (value.startsWith("//")) value = value.slice(2);
    value = value.split("?")[0] ?? value;
    value = value.split("/")[0] ?? value;
  }

  return value.replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "");
}

function errorToMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "Something went wrong";
  return "Something went wrong";
}

/**
 * Held back from a MAX send so the transfer can still pay its own fee. The base
 * fee is 0.000005 SOL; the extra headroom covers a priority-fee bump.
 */
const FEE_RESERVE_SOL = 0.00005;

export default function SendScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  const searchHistory = useWalletStore((s) => s.searchHistory);
  const favorites = useWalletStore((s) => s.favorites);
  const isDevnet = useWalletStore((s) => s.isDevnet);
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);

  const fromBase58 = wallet.publicKey?.toBase58() ?? null;

  const { connected, getBalance } = wallet;

  const refreshBalance = useCallback(async () => {
    if (!connected) {
      setAvailableBalance(null);
      return;
    }
    try {
      setAvailableBalance(await getBalance());
    } catch {
      setAvailableBalance(null);
    }
  }, [connected, getBalance]);

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      if (!connected) {
        setAvailableBalance(null);
        return;
      }
      try {
        const balance = await getBalance();
        if (!cancelled) setAvailableBalance(balance);
      } catch {
        if (!cancelled) setAvailableBalance(null);
      }
    }

    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, [connected, getBalance, isDevnet]);

  const recentRecipients = [...new Set([...favorites, ...searchHistory])]
    .filter((item) => item !== fromBase58)
    .slice(0, 4);
  const sendDisabled =
    wallet.sending || !toAddress.trim() || !amount.trim() || Number(amount) <= 0;

  const handleMax = useCallback(() => {
    if (availableBalance === null) return;
    const safeAmount = Math.max(availableBalance - FEE_RESERVE_SOL, 0);
    // Truncate rather than round: toFixed() rounds up, which can push MAX back
    // above the balance and make the transfer fail for insufficient funds.
    const truncated = Math.floor(safeAmount * 1e6) / 1e6;
    setAmount(truncated === 0 ? "0" : String(truncated));
  }, [availableBalance]);

  const handleSend = async () => {
    const normalizedRecipient = normalizeRecipientAddress(toAddress);
    if (!normalizedRecipient) {
      Alert.alert("Enter a recipient address");
      return;
    }

    const amountSol = Number(amount);
    if (!amount.trim() || Number.isNaN(amountSol) || amountSol <= 0) {
      Alert.alert("Enter a valid amount");
      return;
    }

    try {
      try {
        // Validate before opening the wallet sheet so the user gets a clean error.
        // eslint-disable-next-line no-new
        new PublicKey(normalizedRecipient);
      } catch {
        Alert.alert(
          "Invalid recipient address",
          "Please paste a valid Solana wallet address.",
        );
        return;
      }

      if (availableBalance !== null && amountSol > availableBalance) {
        Alert.alert(
          "Insufficient SOL",
          `Available balance: ${availableBalance.toFixed(4)} SOL`,
        );
        return;
      }

      if (
        availableBalance !== null &&
        amountSol > availableBalance - FEE_RESERVE_SOL
      ) {
        Alert.alert(
          "Not enough left for fees",
          "Leave a small amount of SOL in the wallet to cover the network fee, or tap MAX.",
        );
        return;
      }

      const { signature, confirmed } = await wallet.sendSOL(
        normalizedRecipient,
        amountSol,
      );
      const clusterParam = isDevnet ? "?cluster=devnet" : "";
      void refreshBalance();

      Alert.alert(
        confirmed ? "Transaction sent" : "Transaction submitted",
        confirmed
          ? `Sent ${amountSol} SOL to ${short(normalizedRecipient, 4)}.`
          : `Sent ${amountSol} SOL to ${short(normalizedRecipient, 4)}, but it could not be confirmed in time. It may still land — check Solscan before retrying.`,
        [
          {
            text: "View on Solscan",
            onPress: () =>
              Linking.openURL(
                `https://solscan.io/tx/${signature}${clusterParam}`,
              ),
          },
          { text: "Done", onPress: () => router.back() },
        ],
      );
    } catch (error: unknown) {
      // An on-chain failure has a signature the user can inspect; surface it
      // instead of a bare error string so they can see what actually happened.
      if (error instanceof TransactionFailedError) {
        const clusterParam = isDevnet ? "?cluster=devnet" : "";
        void refreshBalance();
        Alert.alert("Transaction failed", "The transaction failed on-chain.", [
          {
            text: "View on Solscan",
            onPress: () =>
              Linking.openURL(
                `https://solscan.io/tx/${error.signature}${clusterParam}`,
              ),
          },
          { text: "Dismiss", style: "cancel" },
        ]);
        return;
      }
      Alert.alert("Transaction Failed", errorToMessage(error));
    }
  };

  if (!wallet.connected) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <View style={s.centerWrap}>
          <ScreenAtmosphere colors={colors} />
          <View style={s.emptyCard}>
            <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>Wallet not connected</Text>
            <Text style={s.emptyText}>
              Connect your wallet from the portfolio screen before sending SOL.
            </Text>
            <TouchableOpacity
              style={s.primaryButton}
              onPress={() => router.back()}
              activeOpacity={0.9}
            >
              <Text style={s.primaryButtonText}>Back to Portfolio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={s.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.container}>
          <ScreenAtmosphere colors={colors} />

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
          <View style={s.header}>
            <TouchableOpacity
              style={s.backButton}
              onPress={() => router.back()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>

            <Text style={s.headerTitle}>Send</Text>
            <View style={s.backButtonSpacer} />
          </View>

          <View style={s.amountSection}>
            <TextInput
              style={s.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            <Text style={s.amountSubtext}>
              From {fromBase58 ? short(fromBase58, 6) : "connected wallet"}
            </Text>
            <TouchableOpacity
              style={s.maxChip}
              onPress={handleMax}
              activeOpacity={0.85}
              disabled={availableBalance === null}
              accessibilityRole="button"
              accessibilityLabel="Send maximum amount"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.maxChipText}>
                MAX {availableBalance?.toFixed(4) ?? "--"} SOL
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <Text style={s.inputLabel}>To Address</Text>
            <TextInput
              style={s.addressInput}
              placeholder="Wallet address or .sol name"
              placeholderTextColor={colors.textMuted}
              value={toAddress}
              onChangeText={setToAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {recentRecipients.length > 0 ? (
              <>
                <Text style={[s.inputLabel, s.recentLabel]}>Recents</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.recentsRow}
                >
                  {recentRecipients.map((recipient, index) => (
                    <TouchableOpacity
                      key={recipient}
                      style={s.recentChip}
                      onPress={() => setToAddress(recipient)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Send to ${short(recipient, 4)}`}
                    >
                      <View
                        style={[
                          s.recentAvatar,
                          index % 3 === 0 && s.recentAvatarAccent,
                          index % 3 === 1 && s.recentAvatarPrimary,
                          index % 3 === 2 && s.recentAvatarBlue,
                        ]}
                      >
                        <Text style={s.recentAvatarText}>
                          {recipient.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={s.recentName}>{short(recipient, 4)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>

          <View style={s.tokenCard}>
            <View style={s.tokenIcon}>
              <Text style={s.tokenIconText}>◎</Text>
            </View>
            <View style={s.tokenInfo}>
              <Text style={s.tokenName}>Solana (SOL)</Text>
              <Text style={s.tokenMeta}>
                Balance: {availableBalance?.toFixed(4) ?? "--"} SOL
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted}
            />
          </View>

          <View style={s.networkCard}>
            <View style={s.networkDot} />
            <Text style={s.networkText}>
              Solana {isDevnet ? "Devnet" : "Mainnet"} · Est. fee{" "}
              <Text style={s.networkHighlight}>~0.000005 SOL</Text>
            </Text>
          </View>

            <TouchableOpacity
              style={[s.sendButton, sendDisabled && s.sendButtonDisabled]}
              onPress={handleSend}
              disabled={sendDisabled}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityState={{ disabled: sendDisabled, busy: wallet.sending }}
              accessibilityLabel={`Send ${amount || "0"} SOL`}
            >
              {wallet.sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                  <Text style={s.sendButtonText}>
                    Send {amount || "0.00"} SOL
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardWrap: {
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
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 40,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backButtonSpacer: {
      width: 38,
      height: 38,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "800",
    },
    amountSection: {
      alignItems: "center",
      marginTop: 30,
    },
    amountInput: {
      width: "100%",
      textAlign: "center",
      color: colors.text,
      fontSize: 54,
      fontWeight: "800",
      letterSpacing: -2,
    },
    amountSubtext: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 6,
    },
    maxChip: {
      marginTop: 12,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: "rgba(153,69,255,0.25)",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    maxChipText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "800",
    },
    card: {
      marginTop: 24,
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    inputLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    addressInput: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface2,
      color: colors.text,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 13,
      fontFamily: "monospace",
    },
    recentLabel: {
      marginTop: 18,
    },
    recentsRow: {
      gap: 12,
      paddingTop: 12,
    },
    recentChip: {
      alignItems: "center",
      gap: 7,
      width: 72,
    },
    recentAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
    },
    recentAvatarAccent: {
      backgroundColor: colors.accentSoft,
      borderColor: "rgba(153,69,255,0.25)",
    },
    recentAvatarPrimary: {
      backgroundColor: colors.primarySoft,
      borderColor: "rgba(20,241,149,0.2)",
    },
    recentAvatarBlue: {
      backgroundColor: colors.blueSoft,
      borderColor: "rgba(0,194,255,0.2)",
    },
    recentAvatarText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    recentName: {
      color: colors.textSubtle,
      fontSize: 11,
      fontWeight: "700",
      fontFamily: "monospace",
    },
    tokenCard: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    tokenIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    tokenIconText: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: "800",
    },
    tokenInfo: {
      flex: 1,
    },
    tokenName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    tokenMeta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 3,
    },
    networkCard: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: "rgba(20,241,149,0.15)",
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    networkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    networkText: {
      color: colors.textSubtle,
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
    },
    networkHighlight: {
      color: colors.text,
      fontWeight: "700",
    },
    sendButton: {
      marginTop: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 18,
      paddingVertical: 18,
    },
    sendButtonDisabled: {
      opacity: 0.6,
    },
    sendButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "800",
    },
    centerWrap: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      paddingHorizontal: 22,
    },
    emptyCard: {
      backgroundColor: isDark ? colors.surface : colors.surface2,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: "center",
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
      marginTop: 14,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 8,
      marginBottom: 18,
    },
    primaryButton: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      borderRadius: 18,
      paddingVertical: 16,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
  });
