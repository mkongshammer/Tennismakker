// Over-the-air updates apply right away: when the app opens or comes back to
// the foreground and a newer JS update exists on the build's channel, it is
// downloaded and the app reloads into it, instead of waiting for the next
// cold start.
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

export function LiveUpdates() {
  useEffect(() => {
    if (Platform.OS === "web" || (typeof __DEV__ !== "undefined" && __DEV__)) return;
    let Updates;
    try { Updates = require("expo-updates"); } catch { return; }
    if (!Updates?.isEnabled) return;
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {} finally { busy = false; }
    };
    check();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") check(); });
    return () => sub.remove();
  }, []);
  return null;
}
