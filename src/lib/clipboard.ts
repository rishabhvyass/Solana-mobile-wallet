import { Clipboard } from "react-native";

/**
 * `Clipboard` is deprecated in react-native core and its getter logs a warning
 * on every access. Reading it once here keeps that to a single warning and
 * leaves one place to swap in `@react-native-clipboard/clipboard` later.
 */
const nativeClipboard = Clipboard;

export function copyToClipboard(text: string) {
  nativeClipboard.setString(text);
}
