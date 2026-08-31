// app/(tabs)/swap.tsx
// swap screen with jupiter dex aggregator integration
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  TOKENS,
  TOKEN_INFO,
  AVAILABLE_TOKENS,
  DEFAULT_SLIPPAGE_BPS,
  fromSmallestUnit,
} from "../../src/services/jupiter";
import { ScreenAtmosphere } from "../../src/components/ScreenAtmosphere";
import { TransactionFailedError, useWallet } from "../../src/hooks/useWallet";
import { useWalletStore } from "../../src/stores/wallet-store";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import type { ThemeColors } from "../../src/constants/theme";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function SwapScreen() {
  const wallet = useWallet();
  const isDevnet = useWalletStore((s) => s.isDevnet);
  const colors = useThemeColors();
  const isDark = useWalletStore((s) => s.theme) === "dark";
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const {
    connected,
    connecting,
    connect,
    swapping,
    quoteLoading,
    quoteData,
    fetchSwapQuote,
    clearQuote,
    executeSwap,
  } = wallet;

  // token selection
  const [inputToken, setInputToken] = useState(TOKENS.SOL);
  const [outputToken, setOutputToken] = useState(TOKENS.USDC);

  // amounts
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteReqIdRef = useRef(0);

  // token picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"input" | "output">("input");

  const inputInfo = TOKEN_INFO[inputToken];
  const outputInfo = TOKEN_INFO[outputToken];

  // fetch quote when input amount changes (debounced)
  const fetchQuote = useCallback(async () => {
    const reqId = ++quoteReqIdRef.current;
    const inputValue = Number(inputAmount);

    if (!inputAmount.trim() || !Number.isFinite(inputValue) || inputValue <= 0) {
      setOutputAmount("");
      setQuoteError(null);
      clearQuote();
      return;
    }

    // Leave the field empty rather than writing a placeholder string into it:
    // `outputAmount` is read back as a number when flipping and when computing
    // the rate. The devnet banner below already explains why there is no quote.
    if (isDevnet) {
      setOutputAmount("");
      setQuoteError(null);
      clearQuote();
      return;
    }

    try {
      setQuoteError(null);
      const quote = await fetchSwapQuote(
        inputToken,
        outputToken,
        inputValue,
        inputInfo.decimals,
      );

      // Ignore stale results if the user changed inputs while this request ran.
      if (reqId !== quoteReqIdRef.current) return;

      if (quote) {
        const outValue = fromSmallestUnit(quote.outAmount, outputInfo.decimals);
        setOutputAmount(outValue.toFixed(outputInfo.decimals > 6 ? 4 : 2));
      }
    } catch (error: unknown) {
      if (reqId !== quoteReqIdRef.current) return;
      const message = error instanceof Error ? error.message : "Failed to fetch quote";
      setOutputAmount("");
      setQuoteError(message);
    }
  }, [
    inputAmount,
    inputToken,
    outputToken,
    inputInfo.decimals,
    outputInfo.decimals,
    isDevnet,
    fetchSwapQuote,
    clearQuote,
  ]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // flip tokens
  const flipTokens = () => {
    quoteReqIdRef.current += 1; // invalidate any in-flight quote
    // Only carry the amount across when it is a real number, so a placeholder
    // or an in-progress empty field can never land in the "You Pay" input.
    const carried = Number(outputAmount);
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount(
      outputAmount.trim() && Number.isFinite(carried) && carried > 0
        ? outputAmount
        : "",
    );
    setOutputAmount("");
    clearQuote();
    setQuoteError(null);
  };

  // token picker
  const openPicker = (target: "input" | "output") => {
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const selectToken = (mint: string) => {
    quoteReqIdRef.current += 1; // invalidate any in-flight quote
    if (pickerTarget === "input") {
      if (mint === outputToken) setOutputToken(inputToken);
      setInputToken(mint);
    } else {
      if (mint === inputToken) setInputToken(outputToken);
      setOutputToken(mint);
    }
    setPickerVisible(false);
    clearQuote();
    setQuoteError(null);
    setOutputAmount("");
  };

  // Derived from the quote rather than the two text fields, so a zero or
  // half-typed amount cannot render "Infinity" or "NaN" as the exchange rate.
  const rateText = useMemo(() => {
    if (!quoteData) return null;
    const paid = fromSmallestUnit(quoteData.inAmount, inputInfo.decimals);
    const received = fromSmallestUnit(quoteData.outAmount, outputInfo.decimals);
    if (!Number.isFinite(paid) || !Number.isFinite(received) || paid <= 0) {
      return null;
    }
    return `1 ${inputInfo.symbol} = ${(received / paid).toFixed(4)} ${outputInfo.symbol}`;
  }, [quoteData, inputInfo.decimals, inputInfo.symbol, outputInfo.decimals, outputInfo.symbol]);

  // execute swap
  const handleSwap = async () => {
    if (!connected) {
      return Alert.alert("Connect Wallet", "Connect your wallet first to swap");
    }

    if (isDevnet) {
      return Alert.alert(
        "Mainnet Only",
        "Jupiter swaps only work on Mainnet. Switch to Mainnet in settings.",
      );
    }

    if (!quoteData) {
      return Alert.alert("No Quote", "Enter an amount to get a quote first");
    }

    try {
      const result = await executeSwap(
        quoteData,
        inputInfo.symbol,
        outputInfo.symbol,
        outputInfo.decimals,
      );

      const swapped = `${inputAmount} ${result.inputSymbol} for ${result.outputAmount.toFixed(4)} ${result.outputSymbol}`;

      // Clear the fields either way: the transaction is on chain, so
      // re-submitting the same quote would be a second swap, not a retry.
      setInputAmount("");
      setOutputAmount("");

      Alert.alert(
        result.confirmed ? "Swap complete" : "Swap submitted",
        result.confirmed
          ? `Swapped ${swapped}.`
          : `Sent ${swapped}. The network did not confirm it in time — check the explorer for the final status.`,
        [
          { text: "Done", style: "cancel" },
          {
            text: "View on Solscan",
            onPress: () => {
              void Linking.openURL(`https://solscan.io/tx/${result.signature}`);
            },
          },
        ],
      );
    } catch (error) {
      if (error instanceof TransactionFailedError) {
        Alert.alert(
          "Swap failed",
          `${error.message}\n\nThe transaction was submitted but rejected on chain.`,
          [
            { text: "Dismiss", style: "cancel" },
            {
              text: "View on Solscan",
              onPress: () => {
                void Linking.openURL(`https://solscan.io/tx/${error.signature}`);
              },
            },
          ],
        );
        return;
      }
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      Alert.alert("Swap Failed", message);
    }
  };

  // token picker modal
  const renderTokenPicker = () => (
    <Modal
      visible={pickerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setPickerVisible(false)}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Token</Text>
            <TouchableOpacity
              onPress={() => setPickerVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close token picker"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={AVAILABLE_TOKENS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const info = TOKEN_INFO[item];
              const isSelected =
                pickerTarget === "input"
                  ? item === inputToken
                  : item === outputToken;
              return (
                <TouchableOpacity
                  style={[s.tokenOption, isSelected && s.tokenOptionSelected]}
                  onPress={() => selectToken(item)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${info.name}, ${info.symbol}`}
                >
                  <View style={[s.tokenIcon, { backgroundColor: info.color }]}>
                    <Text style={s.tokenIconText}>{info.symbol[0]}</Text>
                  </View>
                  <View style={s.tokenOptionInfo}>
                    <Text style={s.tokenOptionSymbol}>{info.symbol}</Text>
                    <Text style={s.tokenOptionName}>{info.name}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.container}>
        <ScreenAtmosphere colors={colors} />

        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.content,
            // Clear the floating tab bar (76 tall, lifted by the home indicator)
            // so the swap button is never trapped underneath it.
            { paddingBottom: 76 + Math.max(12, insets.bottom) + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.eyebrow}>Swap</Text>
          <Text style={s.title}>Token exchange</Text>
          <Text style={s.subtitle}>
            Route trades through Jupiter inside the same premium wallet shell.
          </Text>

          {isDevnet && (
            <View style={s.devnetWarning}>
              <Ionicons name="warning" size={16} color={colors.warning} />
              <Text style={s.devnetText}>
                Jupiter only works on Mainnet. Switch network to swap.
              </Text>
            </View>
          )}

          {/* From Token Card */}
          <Animated.View
            style={[s.card, { marginBottom: 10 }]}
            entering={FadeInDown.delay(100).springify()}
          >
            <View style={s.cardHeader}>
              <TouchableOpacity
                style={s.tokenSelector}
                onPress={() => openPicker("input")}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Change the token you pay with. Currently ${inputInfo.name}`}
              >
                <View
                  style={[s.tokenIcon, { backgroundColor: inputInfo.color }]}
                >
                  <Text style={s.tokenIconText}>{inputInfo.symbol[0]}</Text>
                </View>
                <Text style={s.tokenName}>{inputInfo.symbol}</Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
              <TextInput
                style={s.amountInput}
                value={inputAmount}
                onChangeText={setInputAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={s.cardFooter}>
              <Text style={s.labelText}>You Pay</Text>
            </View>
          </Animated.View>

          {/* Swap Arrow */}
          <Animated.View
            style={s.arrowContainer}
            entering={FadeInDown.delay(150).springify()}
          >
            <TouchableOpacity
              style={s.swapArrow}
              onPress={flipTokens}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Swap direction: pay with ${outputInfo.symbol} and receive ${inputInfo.symbol}`}
            >
              <Ionicons name="swap-vertical" size={20} color={colors.accent} />
            </TouchableOpacity>
          </Animated.View>

          {/* To Token Card */}
          <Animated.View
            style={s.card}
            entering={FadeInDown.delay(200).springify()}
          >
            <View style={s.cardHeader}>
              <TouchableOpacity
                style={s.tokenSelector}
                onPress={() => openPicker("output")}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Change the token you receive. Currently ${outputInfo.name}`}
              >
                <View
                  style={[s.tokenIcon, { backgroundColor: outputInfo.color }]}
                >
                  <Text style={s.tokenIconText}>{outputInfo.symbol[0]}</Text>
                </View>
                <Text style={s.tokenName}>{outputInfo.symbol}</Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
              <View style={s.outputContainer}>
                {wallet.quoteLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={s.outputText}>{outputAmount || "0"}</Text>
                )}
              </View>
            </View>
            <View style={s.cardFooter}>
              <Text style={s.labelText}>You Receive</Text>
            </View>
          </Animated.View>

        {quoteError && (
          <View style={s.quoteError}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={s.quoteErrorText} numberOfLines={3}>
              {quoteError}
            </Text>
          </View>
        )}

        {/* Quote Details */}
        {quoteData && (
          <Animated.View
            style={s.detailsCard}
            entering={FadeInDown.delay(250).springify()}
          >
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Rate</Text>
              <Text style={s.detailValue}>
                {rateText ?? "--"}
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Price Impact</Text>
              <Text
                style={[
                  s.detailValue,
                  Number(quoteData.priceImpactPct) > 1 && {
                    color: colors.danger,
                  },
                ]}
              >
                {Number(quoteData.priceImpactPct).toFixed(2)}%
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Slippage</Text>
              <Text style={s.detailValue}>{DEFAULT_SLIPPAGE_BPS / 100}%</Text>
            </View>
            {quoteData.routePlan?.length > 0 && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Route</Text>
                <Text style={s.detailValue}>
                  {quoteData.routePlan.map((r) => r.swapInfo.label).join(" -> ")}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Swap Button */}
        {connected ? (
          <TouchableOpacity
            style={[
              s.swapBtn,
              (!quoteData || swapping || isDevnet) &&
              s.swapBtnDisabled,
            ]}
            onPress={handleSwap}
            disabled={!quoteData || swapping || isDevnet}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !quoteData || swapping || isDevnet,
              busy: swapping,
            }}
            accessibilityLabel={
              isDevnet
                ? "Swapping is unavailable on devnet"
                : quoteData
                  ? `Confirm swap of ${inputAmount} ${inputInfo.symbol} for ${outputAmount} ${outputInfo.symbol}`
                  : "Enter an amount to get a quote"
            }
          >
            {swapping ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.swapBtnText}>
                {isDevnet
                  ? "Switch to Mainnet"
                  : quoteData
                    ? "Confirm Swap"
                    : "Enter an amount"}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.connectBtn, connecting && s.swapBtnDisabled]}
            onPress={connect}
            disabled={connecting}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityState={{ disabled: connecting, busy: connecting }}
            accessibilityLabel="Connect a wallet to swap"
          >
            {connecting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.connectBtnText}>Connect Wallet to Swap</Text>
            )}
          </TouchableOpacity>
        )}
        </ScrollView>
      </View>

      {renderTokenPicker()}
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    // layout
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

  // header
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
    marginBottom: 20,
  },

    // devnet warning
    devnetWarning: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark
        ? "rgba(245, 158, 11, 0.10)"
        : "rgba(245, 158, 11, 0.12)",
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
      gap: 8,
    },
    devnetText: {
      color: colors.warning,
      fontSize: 13,
      flex: 1,
    },

    // token card
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 12,
    },

    // token selector
    tokenSelector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface2,
      paddingLeft: 8,
      paddingRight: 12,
      paddingVertical: 8,
      borderRadius: 24,
      gap: 6,
    },
    tokenIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    // White regardless of theme: the circle behind it is always the token's own
    // saturated brand colour, so colors.text goes near-invisible in light mode.
    tokenIconText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    tokenName: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },

    // amount input/output
    amountInput: {
      fontSize: 36,
      fontWeight: "500",
      color: colors.text,
      textAlign: "right",
      flex: 1,
      marginLeft: 10,
    },
    outputContainer: {
      flex: 1,
      alignItems: "flex-end",
      justifyContent: "center",
      minHeight: 44,
    },
    outputText: {
      fontSize: 36,
      fontWeight: "500",
      color: colors.text,
    },
    labelText: {
      fontSize: 13,
      color: colors.textMuted,
      textTransform: "uppercase",
    },

    // swap arrow
    arrowContainer: {
      alignItems: "center",
      marginVertical: -22,
      zIndex: 10,
    },
  swapArrow: {
    backgroundColor: colors.surface2,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },

    // quote details
    detailsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quoteError: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: isDark
        ? "rgba(239, 68, 68, 0.10)"
        : "rgba(239, 68, 68, 0.06)",
      borderWidth: 1,
      borderColor: isDark
        ? "rgba(239, 68, 68, 0.25)"
        : "rgba(239, 68, 68, 0.20)",
    },
    quoteErrorText: {
      color: colors.danger,
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    detailLabel: {
      color: colors.textMuted,
      fontSize: 13,
    },
    detailValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "500",
      maxWidth: "60%",
      textAlign: "right",
    },

    // buttons
  swapBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
  },
    swapBtnDisabled: {
      opacity: 0.4,
    },
  swapBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
    connectBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: "center",
      marginTop: 24,
    },
  connectBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

    // modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "70%",
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "600",
    },

    // token option list
    tokenOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tokenOptionSelected: {
      backgroundColor: isDark
        ? "rgba(20, 241, 149, 0.10)"
        : "rgba(20, 241, 149, 0.12)",
    },
    tokenOptionInfo: {
      flex: 1,
      marginLeft: 12,
    },
    tokenOptionSymbol: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    tokenOptionName: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
  });
