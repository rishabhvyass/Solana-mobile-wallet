import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// define the shape of your state
interface WalletState {
  // data
  favorites: string[];
  searchHistory: string[];
  isDevnet: boolean;
  connectedPublicKey: string | null;
  activeAddress: string | null;
  theme: "dark" | "light";
  hasSeenOnboarding: boolean;
  /** False until AsyncStorage has replayed the persisted state. */
  hasHydrated: boolean;

  // actions
  addFavorite: (address: string) => void;
  removeFavorite: (address: string) => void;
  isFavorite: (address: string) => boolean;
  addToHistory: (address: string) => void;
  removeFromHistory: (address: string) => void;
  clearHistory: () => void;
  toggleNetwork: () => void;
  setConnectedPublicKey: (publicKey: string | null) => void;
  setActiveAddress: (address: string | null) => void;
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;
  completeOnboarding: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // initial state
      favorites: [],
      searchHistory: [],
      isDevnet: false,
      connectedPublicKey: null,
      activeAddress: null,
      theme: "light",
      hasSeenOnboarding: false,
      hasHydrated: false,

      // actions
      addFavorite: (address) =>
        set((state) => ({
          favorites: state.favorites.includes(address)
            ? state.favorites
            : [address, ...state.favorites],
        })),

      removeFavorite: (address) =>
        set((state) => ({
          favorites: state.favorites.filter((a) => a !== address),
        })),

      isFavorite: (address) => get().favorites.includes(address),

      addToHistory: (address) =>
        set((state) => ({
          searchHistory: [
            address,
            ...state.searchHistory.filter((a) => a !== address),
          ].slice(0, 20),
        })),

      removeFromHistory: (address) =>
        set((state) => ({
          searchHistory: state.searchHistory.filter((a) => a !== address),
        })),

      clearHistory: () => set({ searchHistory: [] }),

      toggleNetwork: () => set((state) => ({ isDevnet: !state.isDevnet })),

      setConnectedPublicKey: (publicKey) => set({ connectedPublicKey: publicKey }),

      setActiveAddress: (address) => set({ activeAddress: address }),

      setTheme: (theme) => set({ theme }),

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),

      completeOnboarding: () => set({ hasSeenOnboarding: true }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "wallet-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // connectedPublicKey is deliberately NOT persisted: a Mobile Wallet
      // Adapter session does not survive a cold start, so restoring the address
      // would make the app claim to be connected when it cannot sign anything.
      partialize: (state) => ({
        favorites: state.favorites,
        searchHistory: state.searchHistory,
        isDevnet: state.isDevnet,
        activeAddress: state.activeAddress,
        theme: state.theme,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
      // Set the flag through the store rather than the callback's `state`
      // argument, which is undefined when rehydration throws. Going through
      // setState means a corrupted storage payload still releases the gate and
      // the app boots with defaults instead of hanging on the splash forever.
      onRehydrateStorage: () => () => {
        useWalletStore.setState({ hasHydrated: true });
      },
    }
  )
);
