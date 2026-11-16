// Two themes, the same roles. Night court is the default: deep navy screens,
// navy cards, chalk text, the court's blue for actions and optic yellow from
// the ball for the one thing you should press. Light is the website's light
// palette: cool grey screens, white cards, navy text.
//
// Styles are built once when a screen's file loads, so the theme is read
// here, synchronously, before anything else. Changing it (Profile) saves the
// choice and restarts the app's JavaScript, which takes about a second.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const THEME_KEY = "rb_theme";

const NIGHT = {
  // Surfaces
  screen: "#0B1C33",
  surface: "#0F2138",
  raised: "#1A3A61", // dark feature cards and selected chips: always carries light text
  ink: "#0F2138", // the brand navy itself (icon, graphics)
  inkDeep: "#081527",
  inkSoft: "#1B3554",
  mist: "#0B1C33", // screen background
  // Text
  text: "#F4F8FF",
  chalk: "#FFFFFF", // text on blue and navy
  slate: "#A9B8CC",
  slateLight: "#8596AE",
  // Actions and accents
  court: "#1B62C4",
  courtDark: "#14509F",
  courtLight: "#3B84E8",
  courtText: "#7AB0FF", // links and blue text on the theme's surfaces
  optic: "#D8FF3E",
  border: "rgba(255,255,255,0.12)",
  courtTint: "rgba(59,132,232,0.2)",
  success: "#86E3A8",
  successTint: "rgba(34,160,90,0.2)",
  danger: "#FCA5A5",
  dangerTint: "rgba(220,60,60,0.2)",
};

const LIGHT = {
  ...NIGHT,
  screen: "#F1F5F9",
  surface: "#FFFFFF",
  raised: "#0F2138", // stays navy: it carries light text in both themes
  mist: "#F1F5F9",
  text: "#0F2138",
  slate: "#54677E",
  slateLight: "#8596AE",
  courtText: "#1B62C4",
  border: "rgba(15,33,56,0.14)",
  courtTint: "rgba(27,98,196,0.10)",
  success: "#15803D",
  successTint: "rgba(21,128,61,0.12)",
  danger: "#B91C1C",
  dangerTint: "rgba(185,28,28,0.10)",
};

function storedTheme() {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(THEME_KEY) ?? null;
    return SecureStore.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

/** "night" (default) or "light". */
export const themeName = storedTheme() === "light" ? "light" : "night";
export const isLight = themeName === "light";
export const colors = isLight ? LIGHT : NIGHT;

/** Saves the theme and restarts the app's JavaScript so every screen is drawn in it. */
export async function setTheme(name) {
  const next = name === "light" ? "light" : "night";
  if (next === themeName) return;
  try {
    if (Platform.OS === "web") { globalThis.localStorage?.setItem(THEME_KEY, next); globalThis.location?.reload(); return; }
    SecureStore.setItem(THEME_KEY, next);
  } catch { return; }
  try { await (await import("expo-updates")).reloadAsync(); } catch {
    try { (await import("react-native")).DevSettings?.reload?.(); } catch {}
  }
}

// Shared reading width keeps forms and cards comfortable on larger screens.
export const pageContent = { padding: 20, paddingBottom: 32, width: "100%", maxWidth: 960, alignSelf: "center" };

export const LEVELS = {
  1: "Nybegynder",
  2: "Let øvet",
  3: "Øvet",
  4: "Klubspiller",
  5: "Stærk klubspiller",
  6: "Divisionsspiller",
  7: "Elite",
};

export const MATCH_TYPES = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TRAENING: "Træningsmakker",
};

export const SURFACES = {
  SPORTSGULV: "Sportsgulv / måtte",
  TRAE: "Trægulv",
  BORD: "Bordtennisbord",
  KUNSTGRAES: "Kunstgræs",
  GRUS: "Grus",
  HARD: "Hard court",
  INDE: "Indendørs",
};

// Racquet sports on RacketBuddy (tennis, pickleball and padel first).
export const SPORTS = ["TENNIS", "PICKLEBALL", "PADEL", "BADMINTON", "SQUASH", "BORDTENNIS"];

export const SPORT_LABELS = {
  TENNIS: "Tennis",
  PADEL: "Padel",
  BADMINTON: "Badminton",
  SQUASH: "Squash",
  BORDTENNIS: "Bordtennis",
  PICKLEBALL: "Pickleball",
};

// Samme farver som src/lib/sports.ts på websitet — farve som data, ikke pynt.
export const SPORT_COLORS = {
  TENNIS: "#1B62C4",
  PADEL: "#12796B",
  BADMINTON: "#1B6B45",
  SQUASH: "#B4472C",
  BORDTENNIS: "#123F8C",
  PICKLEBALL: "#6B3FA0",
};

export function sportColor(sport) {
  return SPORT_COLORS[sport] ?? SPORT_COLORS.TENNIS;
}
