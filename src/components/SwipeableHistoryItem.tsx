import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { useThemeColors } from "../hooks/useThemeColors";
import type { ThemeColors } from "../constants/theme";

const short = (value: string, size = 4) =>
  `${value.slice(0, size)}...${value.slice(-size)}`;

interface SwipeableHistoryItemProps {
  address: string;
  index: number;
  onPress: () => void;
  onDelete: () => void;
}

export function SwipeableHistoryItem({
  address,
  index,
  onPress,
  onDelete,
}: SwipeableHistoryItemProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      translateX.value = Math.min(0, event.translationX);
    })
    .onEnd((event) => {
      if (event.translationX < -100) {
        translateX.value = withSpring(-280);
        runOnJS(onDelete)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 110),
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(150 + index * 50).springify()}
      style={styles.container}
    >
      <Animated.View style={[styles.deleteBackground, deleteStyle]}>
        <Ionicons name="trash" size={18} color="#FFFFFF" />
        <Text style={styles.deleteText}>Delete</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <TouchableOpacity
            style={styles.item}
            onPress={onPress}
            activeOpacity={0.88}
          >
            <Animated.View style={styles.iconWrap}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
            </Animated.View>
            <Text style={styles.address} numberOfLines={1}>
              {short(address, 8)}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginBottom: 10,
      position: "relative",
    },
    deleteBackground: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 116,
      borderRadius: 18,
      backgroundColor: colors.danger,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    deleteText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 13,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 15,
      paddingHorizontal: 16,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    address: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      fontFamily: "monospace",
    },
  });
