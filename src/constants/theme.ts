export type AppTheme = "dark" | "light";

export type ThemeColors = Readonly<{
  background: string;
  backgroundAlt: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  /**
   * Readable "gain"/success text colour. `primary` is #14F195 in both themes,
   * which only reaches ~1.5:1 on the light theme's white surfaces — never use
   * `primary` for text on a surface. Use these for values, deltas and labels.
   */
  positive: string;
  negative: string;
  danger: string;
  warning: string;
  accent: string;
  accentSoft: string;
  blue: string;
  blueSoft: string;
  iconBg: string;
}>;

export const THEME_COLORS: Record<AppTheme, ThemeColors> = {
  dark: {
    background: "#080B12",
    backgroundAlt: "#050709",
    surface: "#131825",
    surface2: "#181F30",
    surface3: "#0E1220",
    border: "rgba(255,255,255,0.07)",
    borderStrong: "rgba(255,255,255,0.12)",
    text: "#EEF0F8",
    textMuted: "#6B7498",
    textSubtle: "#9AA0B8",
    primary: "#14F195",
    primaryText: "#050709",
    primarySoft: "rgba(20,241,149,0.14)",
    positive: "#14F195",
    negative: "#FF6B6B",
    danger: "#EF4444",
    warning: "#F59E0B",
    accent: "#9945FF",
    accentSoft: "rgba(153,69,255,0.14)",
    blue: "#00C2FF",
    blueSoft: "rgba(0,194,255,0.14)",
    iconBg: "#1A2030",
  },
  light: {
    background: "#F7F8FA",
    backgroundAlt: "#EEF1F8",
    surface: "#FFFFFF",
    surface2: "#F3F4F6",
    surface3: "#EDF1F8",
    border: "#E5E7EB",
    borderStrong: "#D6DCE8",
    text: "#111827",
    textMuted: "#6B7280",
    textSubtle: "#4B5563",
    primary: "#14F195",
    primaryText: "#0B1F16",
    primarySoft: "rgba(20,241,149,0.16)",
    positive: "#047857",
    negative: "#DC2626",
    danger: "#DC2626",
    warning: "#D97706",
    accent: "#7C3AED",
    accentSoft: "rgba(124,58,237,0.12)",
    blue: "#0284C7",
    blueSoft: "rgba(2,132,199,0.10)",
    iconBg: "#F3F4F6",
  },
} as const;
