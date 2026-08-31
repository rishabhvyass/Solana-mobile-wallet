import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { encodeQr } from "../lib/qrcode";

interface QRCodeProps {
  value: string;
  /** Target width in dp, including the quiet zone. */
  size?: number;
  dark?: string;
  light?: string;
  /** Quiet-zone width in modules. The spec requires 4; scanners rely on it. */
  quietZone?: number;
}

type Run = { start: number; length: number };

/**
 * Collapse a row of modules into runs of dark cells so a 33x33 code renders as
 * a few dozen Views instead of 1,089 of them.
 */
function darkRuns(row: boolean[]): Run[] {
  const runs: Run[] = [];
  let start = -1;

  row.forEach((dark, index) => {
    if (dark && start < 0) start = index;
    if (!dark && start >= 0) {
      runs.push({ start, length: index - start });
      start = -1;
    }
  });

  if (start >= 0) runs.push({ start, length: row.length - start });
  return runs;
}

export function QRCode({
  value,
  size = 232,
  dark = "#000000",
  light = "#FFFFFF",
  quietZone = 4,
}: QRCodeProps) {
  const matrix = useMemo(() => encodeQr(value), [value]);

  const layout = useMemo(() => {
    if (!matrix) return null;
    const total = matrix.size + quietZone * 2;
    // Whole-dp modules keep adjacent runs flush; fractional widths leave
    // hairline seams that break scanning at small sizes.
    const cell = Math.max(1, Math.floor(size / total));
    return {
      cell,
      side: cell * total,
      offset: cell * quietZone,
      rows: matrix.modules.map(darkRuns),
    };
  }, [matrix, quietZone, size]);

  if (!matrix || !layout) {
    return (
      <View style={[styles.fallback, { width: size, height: size }]}>
        <Text style={styles.fallbackText}>QR unavailable</Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="QR code for this wallet address"
      style={[
        styles.canvas,
        { width: layout.side, height: layout.side, backgroundColor: light },
      ]}
    >
      {layout.rows.map((runs, rowIndex) => (
        <View
          key={rowIndex}
          style={{
            position: "absolute",
            top: layout.offset + rowIndex * layout.cell,
            left: layout.offset,
            height: layout.cell,
          }}
        >
          {runs.map((run) => (
            <View
              key={run.start}
              style={{
                position: "absolute",
                left: run.start * layout.cell,
                width: run.length * layout.cell,
                height: layout.cell,
                backgroundColor: dark,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    overflow: "hidden",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  fallbackText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
  },
});
