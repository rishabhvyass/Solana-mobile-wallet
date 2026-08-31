import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";
import { Buffer } from "buffer";
import { TurboModuleRegistry, type TurboModule } from "react-native";

// 1. Polyfill Buffer
if (typeof (global as any).Buffer === "undefined") {
  (global as any).Buffer = Buffer;
}
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

// 2. Polyfill btoa and atob
const btoaPolyfill = (input: string) =>
  Buffer.from(input, "binary").toString("base64");
const atobPolyfill = (input: string) =>
  Buffer.from(input, "base64").toString("binary");

if (typeof (globalThis as any).btoa === "undefined") {
  (globalThis as any).btoa = btoaPolyfill;
}
if (typeof (globalThis as any).atob === "undefined") {
  (globalThis as any).atob = atobPolyfill;
}

// 3. Polyfill window, window.btoa, window.atob, window.location, event listeners
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}

if (typeof (globalThis as any).window.btoa === "undefined") {
  (globalThis as any).window.btoa = btoaPolyfill;
}
if (typeof (globalThis as any).window.atob === "undefined") {
  (globalThis as any).window.atob = atobPolyfill;
}

if (typeof (globalThis as any).window.location === "undefined") {
  (globalThis as any).window.location = {
    host: "localhost",
    hostname: "localhost",
    href: "http://localhost",
    protocol: "http:",
    assign: () => {},
  };
}

if (typeof (globalThis as any).window.addEventListener === "undefined") {
  (globalThis as any).window.addEventListener = () => {};
}

if (typeof (globalThis as any).window.removeEventListener === "undefined") {
  (globalThis as any).window.removeEventListener = () => {};
}

// 4. Polyfill crypto.getRandomValues
if (typeof (globalThis as any).crypto === "undefined") {
  (globalThis as any).crypto = {};
}

if (typeof (globalThis as any).crypto.getRandomValues === "undefined") {
  (globalThis as any).crypto.getRandomValues = function <
    T extends ArrayBufferView,
  >(array: T): T {
    return expoCryptoGetRandomValues(array as any) as T;
  };
}

if (typeof (globalThis as any).window.crypto === "undefined") {
  (globalThis as any).window.crypto = (globalThis as any).crypto;
}

// 5. Handle missing native TurboModules gracefully (e.g. SolanaMobileWalletAdapter in Expo Go)
if (TurboModuleRegistry) {
  const originalGetEnforcing = TurboModuleRegistry.getEnforcing;
  TurboModuleRegistry.getEnforcing = function <T extends TurboModule>(
    name: string,
  ): T {
    try {
      return originalGetEnforcing.call(TurboModuleRegistry, name) as unknown as T;
    } catch (e) {
      const existing = TurboModuleRegistry.get(name);
      if (existing) return existing as unknown as T;
      console.warn(
        `[Polyfill] Native TurboModule '${name}' is missing from binary (e.g. running in Expo Go). Returning fallback.`,
      );
      return {
        transact: async () => {
          throw new Error(
            "Solana Mobile Wallet Adapter requires a custom Development Build (run 'bun expo run:android'). It is not supported inside Expo Go.",
          );
        },
      } as unknown as T;
    }
  };
}
