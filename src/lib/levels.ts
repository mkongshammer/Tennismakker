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

export function levelLabel(level: number): string {
  return LEVELS[level]?.label ?? `Niveau ${level}`;
}

export const SURFACES: Record<string, string> = {
  GRUS: "Grus",
  HARD: "Hard court",
  INDE: "Indendørs",
};

export const MATCH_TYPES: Record<string, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TRAENING: "Træningsmakker",
};
