// Night court: the same palette as the website's footer, everywhere. Deep
// navy screens, navy cards, chalk text, the court's blue for actions and
// optic yellow from the ball for the one thing you should press. It matches
// the app icon.
export const colors = {
  // Surfaces
  screen: "#0B1C33",
  surface: "#0F2138",
  raised: "#1A3A61",
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
  courtText: "#7AB0FF", // links and blue text on dark surfaces
  optic: "#D8FF3E",
  border: "rgba(255,255,255,0.12)",
  courtTint: "rgba(59,132,232,0.2)",
  success: "#86E3A8",
  successTint: "rgba(34,160,90,0.2)",
  danger: "#FCA5A5",
  dangerTint: "rgba(220,60,60,0.2)",
};

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
