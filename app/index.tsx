import { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { MoonpayBackdrop } from "../src/components/MoonpayBackdrop";
import { useWalletStore } from "../src/stores/wallet-store";

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  highlight: string;
};

const SLIDES: Slide[] = [
  {
    key: "explore",
    icon: "search-outline",
    title: "Explore any Solana wallet",
    body: "Paste an address to see its SOL balance, token holdings and recent activity, pulled live from the chain.",
    highlight: "No account needed",
  },
  {
    key: "swap",
    icon: "swap-horizontal-outline",
    title: "Swap at the best route",
    body: "Quotes are aggregated across Solana liquidity by Jupiter, so you see the rate and price impact before you sign.",
    highlight: "Powered by Jupiter",
  },
  {
    key: "send",
    icon: "paper-plane-outline",
    title: "Send with your own wallet",
    body: "Connect Phantom, Solflare or any Mobile Wallet Adapter app. Your keys never leave it — SolScan only builds the transaction.",
    highlight: "Your keys stay yours",
  },
];

function ProgressDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View
      style={styles.dotsRow}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: activeIndex + 1 }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={[styles.dot, index === activeIndex && styles.dotActive]}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const hasHydrated = useWalletStore((s) => s.hasHydrated);
  const hasSeenOnboarding = useWalletStore((s) => s.hasSeenOnboarding);
  const completeOnboarding = useWalletStore((s) => s.completeOnboarding);

  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const finish = useCallback(() => {
    completeOnboarding();
    router.replace("/(tabs)");
  }, [completeOnboarding, router]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    const next = index + 1;
    setIndex(next);
    listRef.current?.scrollToOffset({ offset: next * width, animated: true });
  }, [finish, index, isLast, width]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(SLIDES.length - 1, page)));
    },
    [width],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Slide> | null | undefined, itemIndex: number) => ({
      length: width,
      offset: width * itemIndex,
      index: itemIndex,
    }),
    [width],
  );

  const renderSlide = useCallback(
    ({ item }: ListRenderItemInfo<Slide>) => (
      <View style={[styles.slide, { width }]}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name={item.icon} size={38} color="#FFFFFF" />
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{item.highlight}</Text>
          </View>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    ),
    [width],
  );

  const keyExtractor = useMemo(() => (item: Slide) => item.key, []);

  // Wait for AsyncStorage to replay before deciding: reading the flag while it
  // is still at its default would flash onboarding at every returning user.
  if (!hasHydrated) {
    return (
      <View style={styles.bootstrap}>
        <MoonpayBackdrop />
        <StatusBar style="light" />
      </View>
    );
  }

  if (hasSeenOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.root}>
      <MoonpayBackdrop />
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="flash" size={16} color="#6816E8" />
            </View>
            <Text style={styles.brandText}>SolScan</Text>
          </View>

          <TouchableOpacity
            onPress={finish}
            style={styles.skipButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Skip introduction and open the wallet"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <Animated.View entering={FadeIn.duration(300)} style={styles.carousel}>
          <FlatList
            ref={listRef}
            data={SLIDES}
            renderItem={renderSlide}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).springify()}
          style={styles.footer}
        >
          <ProgressDots count={SLIDES.length} activeIndex={index} />

          <TouchableOpacity
            onPress={goNext}
            style={styles.primaryButton}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Get started" : "Next slide"}
          >
            <Text style={styles.primaryButtonText}>
              {isLast ? "Get started" : "Next"}
            </Text>
            <Ionicons
              name={isLast ? "arrow-forward" : "chevron-forward"}
              size={20}
              color="#1A0B33"
            />
          </TouchableOpacity>

          <Text style={styles.footnote}>
            SolScan is a read-only explorer and wallet client. It never asks for
            your seed phrase.
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A0B33",
  },
  // Shown for the frame or two before the persisted flag replays. Backdrop only,
  // so the transition into either destination has no visible seam.
  bootstrap: {
    flex: 1,
    backgroundColor: "#1A0B33",
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  skipButton: {
    minWidth: 64,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  skipText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    fontWeight: "700",
  },
  // flex rather than a fixed height: on a small phone the slide shrinks instead
  // of pushing the call to action off the bottom of the screen.
  carousel: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  heroCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    marginBottom: 34,
  },
  heroIcon: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(20,241,149,0.16)",
    borderWidth: 1,
    borderColor: "rgba(20,241,149,0.35)",
  },
  heroBadgeText: {
    color: "#7CFFC4",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 34,
  },
  body: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 330,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 18,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  dotActive: {
    width: 22,
    backgroundColor: "#FFFFFF",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  primaryButtonText: {
    color: "#1A0B33",
    fontSize: 16,
    fontWeight: "800",
  },
  footnote: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
