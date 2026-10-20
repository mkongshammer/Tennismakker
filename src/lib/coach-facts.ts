// The fixed facts on a coach's profile that answer the questions players ask
// before a first lesson: who the lessons are for, where they happen and what
// to bring. Fixed codes (not free text) so they can be shown consistently and
// filtered on later.
export const COACH_LEVELS = [
  { code: "BEGINNER", label: "Beginners" },
  { code: "INTERMEDIATE", label: "Intermediate" },
  { code: "ADVANCED", label: "Advanced" },
  { code: "COMPETITIVE", label: "Competitive / tournament" },
] as const;

export const COACH_AGES = [
  { code: "KIDS", label: "Kids (under 12)" },
  { code: "TEENS", label: "Teens (12–17)" },
  { code: "ADULTS", label: "Adults" },
  { code: "SENIORS", label: "Seniors (65+)" },
] as const;

const FACT_TEXT_MAX = 300;

/** Keeps only known codes, in the canonical order, as a comma list. */
export function cleanCodes(values: unknown[], allowed: readonly { code: string }[]): string {
  const wanted = new Set(values.map((v) => String(v).trim().toUpperCase()));
  return allowed.filter((a) => wanted.has(a.code)).map((a) => a.code).join(",");
}

export function labelsFor(list: string | null | undefined, allowed: readonly { code: string; label: string }[]): string[] {
  const codes = new Set(String(list ?? "").split(",").map((c) => c.trim()).filter(Boolean));
  return allowed.filter((a) => codes.has(a.code)).map((a) => a.label);
}

export function cleanFactText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, FACT_TEXT_MAX) : null;
}

/** True when the coach has filled in enough for the "About the lessons" box to be useful. */
export function hasLessonFacts(p: { levels?: string | null; ages?: string | null; lessonPlace?: string | null; whatToBring?: string | null }) {
  return Boolean(p.levels || p.ages || p.lessonPlace || p.whatToBring);
}
