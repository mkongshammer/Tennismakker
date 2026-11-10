// Over-the-air updates without ever pulling the app out from under someone.
//
// - At launch (while the boot screen is still showing) a newer update is
//   downloaded and the app reloads into it straight away.
// - After the app has been in the background for 5+ minutes, the same happens
//   when it comes back, which feels like a fresh start.
// - Any other time (Face ID sheet, Control Center, a quick app switch) an
//   update is only downloaded; it applies the next time the app starts.
//   Reloading mid-use used to look like being thrown out of the app.
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

const LAUNCH_WINDOW_MS = 8000;
const AWAY_MS = 5 * 60_000;

export function LiveUpdates() {
  useEffect(() => {
    if (Platform.OS === "web" || (typeof __DEV__ !== "undefined" && __DEV__)) return;
    let Updates;
    try { Updates = require("expo-updates"); } catch { return; }
    if (!Updates?.isEnabled) return;
    const startedAt = Date.now();
    let busy = false;
    let backgroundAt = 0;
    const check = async (mayReload) => {
      if (busy) return;
      busy = true;
      try {
        const res = await Updates.checkForUpdateAsync();
        if (!res.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (mayReload()) await Updates.reloadAsync();
      } catch {} finally { busy = false; }
    };
    check(() => Date.now() - startedAt < LAUNCH_WINDOW_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") { backgroundAt = Date.now(); return; }
      if (s !== "active" || !backgroundAt) return;
      const away = Date.now() - backgroundAt;
      backgroundAt = 0;
      const resumedAt = Date.now();
      check(() => away >= AWAY_MS && Date.now() - resumedAt < LAUNCH_WINDOW_MS);
    });
    return () => sub.remove();
  }, []);
  return null;
}
