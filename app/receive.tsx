import { useMemo, useState } from "react";
import {
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWalletStore } from "../src/stores/wallet-store";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { ScreenAtmosphere } from "../src/components/ScreenAtmosphere";
import { QRCode } from "../src/components/QRCode";
import { copyToClipboard } from "../src/lib/clipboard";
import type { ThemeColors } from "../src/constants/theme";
import { short } from "../src/utils/helpers";

export default function ReceiveScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  // Only the connected wallet can actually receive here. `activeAddress` may be
  // some address the user merely searched for — showing it would invite them to
  // send funds to a wallet they do not control.
  const walletAddress = useWalletStore((s) => s.connectedPublicKey);
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!walletAddress) return;
    await Share.share({
      title: "Solana wallet address",
      message: walletAddress,
    });
  };

  const handleCopy = () => {
    if (!walletAddress) return;
    copyToClipboard(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
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
          <Text style={s.headerTitle}>Receive</Text>
          <View style={s.backSpacer} />
        </View>

        <Text style={s.subtitle}>
          Share this address to receive SOL or any Solana token.
        </Text>

        {walletAddress ? (
          <>
            <View style={s.qrCard}>
              <View style={s.qrWrap}>
                <QRCode value={walletAddress} size={236} />
                <View style={s.qrCenterMark}>
                  <Text style={s.qrCenterText}>◎</Text>
                </View>
              </View>

              <Text style={s.qrName}>Solana Wallet</Text>
              <Text style={s.qrSub}>{short(walletAddress, 6)}</Text>
            </View>

            <View style={s.addressCard}>
              <Text style={s.inputLabel}>Your address</Text>
              <Text selectable style={s.addressText}>
                {walletAddress}
              </Text>
              <TouchableOpacity
                style={[s.copyButton, copied && s.copyButtonDone]}
                onPress={handleCopy}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Copy wallet address"
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={s.copyButtonText}>
                  {copied ? "Copied" : "Copy address"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={s.actionRow}>
              <TouchableOpacity
                style={s.secondaryAction}
                onPress={handleShare}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Share wallet address"
              >
                <Ionicons
                  name="share-social-outline"
                  size={17}
                  color={colors.text}
                />
                <Text style={s.secondaryActionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.primaryAction}
                onPress={() => router.back()}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={s.primaryActionText}>Done</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={s.emptyCard}>
            <Ionicons name="wallet-outline" size={44} color={colors.textMuted} />
            <Text style={s.emptyTitle}>Wallet not connected</Text>
            <Text style={s.emptyText}>
              Connect your wallet from the portfolio screen to show a receive
              address you control.
            </Text>
            <TouchableOpacity
              style={s.primaryAction}
              onPress={() => router.back()}
              activeOpacity={0.9}
              accessibilityRole="button"
            >
              <Text style={s.primaryActionText}>Back to Portfolio</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 56,
      paddingBottom: 36,
      alignItems: "center",
    },
    header: {
      width: "100%",
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
    backSpacer: {
      width: 38,
      height: 38,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "800",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
      marginTop: 18,
      lineHeight: 19,
      maxWidth: 280,
    },
    qrCard: {
      width: "100%",
      backgroundColor: "#FFFFFF",
      borderRadius: 28,
      padding: 24,
      alignItems: "center",
      marginTop: 24,
      shadowColor: "#000000",
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    qrWrap: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    // Small enough that error-correction level M recovers the covered modules.
    qrCenterMark: {
      position: "absolute",
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: "#FFFFFF",
    },
    qrCenterText: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "800",
    },
    qrName: {
      color: "#111111",
      fontSize: 17,
      fontWeight: "800",
      marginTop: 18,
    },
    qrSub: {
      color: "#6B7280",
      fontSize: 12,
      marginTop: 4,
      fontFamily: "monospace",
    },
    addressCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      padding: 16,
      marginTop: 18,
    },
    inputLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    addressText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 8,
      fontFamily: "monospace",
    },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 13,
      marginTop: 14,
    },
    copyButtonDone: {
      backgroundColor: colors.positive,
    },
    copyButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    emptyCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: "center",
      marginTop: 28,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 19,
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
    actionRow: {
      width: "100%",
      flexDirection: "row",
      gap: 12,
      marginTop: 16,
    },
    secondaryAction: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.surface2,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingVertical: 15,
    },
    secondaryActionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    primaryAction: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 15,
    },
    primaryActionText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },
  });
