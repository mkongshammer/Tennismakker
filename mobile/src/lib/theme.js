// Samme designsystem som websitet: hardcourt frem for grus. Kølig grå-blå
// baggrund, banens blå som primær handling, kridhvide linjer. Optic-gult
// fra bolden er reserveret til enkeltstående fremhævninger.
export const colors = {
  ink: "#0F2138",
  inkDeep: "#081527",
  inkSoft: "#1B3554",
  court: "#1B62C4",
  courtDark: "#14509F",
  courtLight: "#3B84E8",
  optic: "#D8FF3E",
  mist: "#F1F5F9",
  chalk: "#FFFFFF",
  slate: "#54677E",
  slateLight: "#8496AB",
  border: "#E2E8F0", // tynd kant, ligesom border-slate/10 på websitet
};

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
  GRUS: "Grus",
  HARD: "Hard court",
  KUNSTGRAES: "Kunstgræs",
  INDE: "Indendørs",
};

export const SPORTS = ["TENNIS", "PADEL", "BADMINTON", "SQUASH", "BORDTENNIS", "PICKLEBALL"];

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
