import { StyleSheet, View } from "react-native";

type MoonpayBackdropProps = {
  softened?: boolean;
};

export function MoonpayBackdrop({ softened = false }: MoonpayBackdropProps) {
  return (
    <View pointerEvents="none" style={styles.fill}>
      <View style={[styles.base, softened && styles.baseSoft]} />
      <View style={[styles.glow, styles.topGlow]} />
      <View style={[styles.glow, styles.centerGlow]} />
      <View style={[styles.glow, styles.rightGlow]} />
      <View style={[styles.glow, styles.leftBlob]} />
      <View style={[styles.glow, styles.rightBlob]} />
      <View style={[styles.glow, styles.centerBlob]} />
      <View style={[styles.glow, styles.footerBeam]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  base: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#6816E8",
  },
  baseSoft: {
    backgroundColor: "#5E19CF",
  },
  glow: {
    position: "absolute",
    borderRadius: 999,
  },
  topGlow: {
    width: 360,
    height: 360,
    top: -120,
    left: "50%",
    marginLeft: -180,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  centerGlow: {
    width: 420,
    height: 420,
    top: 110,
    left: "50%",
    marginLeft: -210,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  rightGlow: {
    width: 240,
    height: 240,
    right: -70,
    bottom: 200,
    backgroundColor: "rgba(104,255,192,0.30)",
  },
  leftBlob: {
    width: 210,
    height: 210,
    left: -80,
    bottom: 220,
    backgroundColor: "rgba(68,0,255,0.60)",
  },
  centerBlob: {
    width: 80,
    height: 80,
    left: "50%",
    marginLeft: -40,
    bottom: 300,
    backgroundColor: "rgba(245,234,205,0.34)",
  },
  rightBlob: {
    width: 120,
    height: 120,
    right: 110,
    bottom: 360,
    backgroundColor: "rgba(255,240,217,0.20)",
  },
  footerBeam: {
    left: 48,
    right: 48,
    bottom: 110,
    height: 84,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
});
