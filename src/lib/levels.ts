// Fælles niveauskala for hele platformen (1-7).
// Bruges i matching, spillerprofiler og ranglister.
export const LEVELS: Record<number, { label: string; desc: string }> = {
  1: { label: "Nybegynder", desc: "Har spillet få gange" },
  2: { label: "Let øvet", desc: "Kan holde en rally kørende" },
  3: { label: "Øvet", desc: "Spiller jævnligt, stabil grundslag" },
  4: { label: "Klubspiller", desc: "Spiller holdkampe eller turneringer" },
  5: { label: "Stærk klubspiller", desc: "Øverste rækker i klubben" },
  6: { label: "Divisionsspiller", desc: "Konkurrerer på højt niveau" },
  7: { label: "Elite", desc: "Rangliste / tidligere elite" },
};

/**
 * The 1–7 scale as Americans describe it, with the NTRP rating most US
 * players already know. The stored number does not change.
 */
export const LEVELS_EN: Record<number, { label: string; ntrp: string; desc: string }> = {
  1: { label: "Beginner", ntrp: "1.5–2.0", desc: "Just getting started, learning to rally" },
  2: { label: "Advanced beginner", ntrp: "2.5", desc: "Can keep a slow rally going" },
  3: { label: "Intermediate", ntrp: "3.0", desc: "Plays regularly with consistent groundstrokes" },
  4: { label: "Club player", ntrp: "3.5", desc: "Plays league matches or tournaments" },
  5: { label: "Strong club player", ntrp: "4.0", desc: "Top of the club ladder" },
  6: { label: "Tournament player", ntrp: "4.5–5.0", desc: "Competes at a high level" },
  7: { label: "Elite", ntrp: "5.5+", desc: "Ranked or former elite" },
};

export function levelLabel(level: number, locale = "da"): string {
  if (locale === "en-US" || locale === "en") return LEVELS_EN[level]?.label ?? `Level ${level}`;
  return LEVELS[level]?.label ?? `Niveau ${level}`;
}

export function levelNtrp(level: number): string | null {
  return LEVELS_EN[level]?.ntrp ?? null;
}

export const SURFACES: Record<string, string> = {
  KUNSTGRAES: "Kunstgræs",
  SPORTSGULV: "Sportsgulv / måtte",
  TRAE: "Trægulv",
  BORD: "Bordtennisbord",
  GRUS: "Grus",
  HARD: "Hard court",
  INDE: "Indendørs",
};

export const MATCH_TYPES: Record<string, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TRAENING: "Træningsmakker",
};
