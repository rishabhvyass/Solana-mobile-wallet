import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWalletStore } from "../stores/wallet-store";
import { TouchableOpacity } from "react-native";
import { useThemeColors } from "../hooks/useThemeColors";


interface Props {
  address: string;
}

export function FavoriteButton({ address }: Props) {
  const colors = useThemeColors();
  const addFavorite = useWalletStore((s) => s.addFavorite);
  const removeFavorite = useWalletStore((s) => s.removeFavorite);
  const favorites = useWalletStore((s) => s.favorites);
  const favorited = favorites.includes(address);

  return (
    <TouchableOpacity
      onPress={() => {
        if (favorited) {
          removeFavorite(address);
        } else {
          addFavorite(address);
        }
      }}
      style={styles.button}
    >
      <Ionicons
        name={favorited ? "heart" : "heart-outline"}
        size={24}
        color={favorited ? colors.danger : colors.textMuted}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});
