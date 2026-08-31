import { THEME_COLORS } from "../constants/theme";
import { useWalletStore } from "../stores/wallet-store";

export function useThemeColors() {
  const theme = useWalletStore((s) => s.theme);
  return THEME_COLORS[theme];
}

