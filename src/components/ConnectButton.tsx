import { useMemo } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";
import { useWalletStore } from "../stores/wallet-store";
import type { ThemeColors } from "../constants/theme";

interface Props {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectButton({
  connected,
  connecting,
  publicKey,
  onConnect,
  onDisconnect,
}: Props) {
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  if (connecting) {
    return (
      <View style={[styles.button, styles.connecting]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.buttonText}>Connecting...</Text>
      </View>
    );
  }

  if (connected && publicKey) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.connected]}
        onPress={onDisconnect}
      >
        <Ionicons name="wallet" size={18} color={colors.primary} />
        <Text style={styles.connectedText}>
          {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
        </Text>
        <Ionicons
          name="close-circle-outline"
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, styles.disconnected]}
      onPress={onConnect}
    >
      <Ionicons name="wallet-outline" size={18} color="#fff" />
      <Text style={styles.buttonText}>Connect Wallet</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 8,
    },
    disconnected: {
      backgroundColor: colors.accent,
    },
    connected: {
      backgroundColor: isDark
        ? "rgba(20, 241, 149, 0.12)"
        : "rgba(20, 241, 149, 0.20)",
      borderWidth: 1,
      borderColor: colors.primary,
    },
    connecting: {
      backgroundColor: colors.accent,
      opacity: 0.9,
    },
    buttonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    connectedText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "monospace",
    },
  });
