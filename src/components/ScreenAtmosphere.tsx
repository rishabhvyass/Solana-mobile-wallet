import { StyleSheet, View } from "react-native";
import type { ThemeColors } from "../constants/theme";

interface ScreenAtmosphereProps {
  colors: ThemeColors;
}

export function ScreenAtmosphere({ colors }: ScreenAtmosphereProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.orb,
          styles.topOrb,
          { backgroundColor: colors.accent, opacity: 0.12 },
        ]}
      />
      <View
        style={[
          styles.orb,
          styles.bottomOrb,
          { backgroundColor: colors.primary, opacity: 0.1 },
        ]}
      />
      <View
        style={[
          styles.orb,
          styles.sideOrb,
          { backgroundColor: colors.blue, opacity: 0.08 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  topOrb: {
    width: 260,
    height: 260,
    top: -90,
    right: -70,
  },
  bottomOrb: {
    width: 220,
    height: 220,
    bottom: -70,
    left: -70,
  },
  sideOrb: {
    width: 180,
    height: 180,
    top: 220,
    left: -90,
  },
});
