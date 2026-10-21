// Draws and match schedules, as pure functions. Nothing here touches the
// database, so the bracket maths is tested on its own.
//
// Three formats:
//  - SINGLE_ELIM: seeded knockout bracket; byes go to the top seeds.
//  - ROUND_ROBIN: everyone plays everyone (circle method), one table.
//  - GROUPS_KNOCKOUT: snake-seeded groups, round robin in each, then the
//    top two of every group go into a knockout bracket.
//
// A schedule puts rounds into time slots on N parallel courts: a round
// never starts before the previous one has finished, so nobody is asked
// to be on two courts at once.

export type Entry = { id: string; seed: number; name?: string };

export type DrawMatch = {
  key: string;            // stable within the draw, e.g. "KO-1-3" or "G-A-2-1"
  stage: "GROUP" | "KO";
  group: string | null;
  round: number;          // 1-based within the stage
  slot: number;           // 1-based within the round
  homeId: string | null;
  awayId: string | null;
  status: "PENDING" | "BYE";
  winnerId: string | null;
  nextKey: string | null;
  nextSide: "home" | "away" | null;
};

export type Format = "SINGLE_ELIM" | "ROUND_ROBIN" | "GROUPS_KNOCKOUT";
export const FORMATS: Format[] = ["SINGLE_ELIM", "ROUND_ROBIN", "GROUPS_KNOCKOUT"];
export const FORMAT_LABEL: Record<Format | "NONE", string> = { NONE: "No draw", SINGLE_ELIM: "Single elimination", ROUND_ROBIN: "Round robin", GROUPS_KNOCKOUT: "Groups, then knockout" };

export const nextPow2 = (n: number) => { let p = 1; while (p < n) p *= 2; return p; };

/** Bracket positions for a bracket of `size` so that 1 meets 2 in the final, 1 meets 4/3 in the semis, and so on. */
export function seedPositions(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) next.push(s, n + 1 - s);
    order = next;
  }
  return order;
}

export function roundName(round: number, rounds: number) {
  const left = rounds - round;
  if (left === 0) return "Final";
  if (left === 1) return "Semifinals";
  if (left === 2) return "Quarterfinals";
  return `Round of ${2 ** (left + 1)}`;
}

/** Knockout bracket. Entries are seeded 1..n (seed 1 = strongest). */
export function singleElimination(entries: Entry[], prefix = "KO"): DrawMatch[] {
  if (entries.length < 2) return [];
  const size = nextPow2(entries.length);
  const rounds = Math.log2(size);
  const bySeed = new Map(entries.map((e) => [e.seed, e]));
  const positions = seedPositions(size); // positions[i] = seed at bracket slot i
  const matches: DrawMatch[] = [];
  const key = (r: number, s: number) => `${prefix}-${r}-${s}`;
  // Round 1
  for (let i = 0; i < size / 2; i++) {
    const a = bySeed.get(positions[2 * i]) ?? null, b = bySeed.get(positions[2 * i + 1]) ?? null;
    const bye = !a || !b;
    matches.push({ key: key(1, i + 1), stage: "KO", group: null, round: 1, slot: i + 1, homeId: a?.id ?? null, awayId: b?.id ?? null, status: bye ? "BYE" : "PENDING", winnerId: bye ? (a ?? b)!.id : null, nextKey: rounds > 1 ? key(2, Math.floor(i / 2) + 1) : null, nextSide: rounds > 1 ? (i % 2 === 0 ? "home" : "away") : null });
  }
  // Later rounds, empty until results come in (byes are pushed through below).
  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let s = 1; s <= count; s++) matches.push({ key: key(r, s), stage: "KO", group: null, round: r, slot: s, homeId: null, awayId: null, status: "PENDING", winnerId: null, nextKey: r < rounds ? key(r + 1, Math.ceil(s / 2)) : null, nextSide: r < rounds ? (s % 2 === 1 ? "home" : "away") : null });
  }
  // Push bye winners into round 2.
  const byKey = new Map(matches.map((m) => [m.key, m]));
  for (const m of matches) if (m.status === "BYE" && m.nextKey) { const n = byKey.get(m.nextKey)!; if (m.nextSide === "home") n.homeId = m.winnerId; else n.awayId = m.winnerId; }
  return matches;
}

/** Everyone plays everyone. Circle method: fix the first, rotate the rest. */
export function roundRobin(entries: Entry[], group: string | null = null, prefix = "RR"): DrawMatch[] {
  const list: (Entry | null)[] = [...entries].sort((a, b) => a.seed - b.seed);
  if (list.length < 2) return [];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length, rounds = n - 1;
  const matches: DrawMatch[] = [];
  let ring = list.slice(1);
  for (let r = 1; r <= rounds; r++) {
    const left = [list[0], ...ring.slice(0, n / 2 - 1)];
    const right = [...ring.slice(n / 2 - 1)].reverse();
    let slot = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = left[i], b = right[i];
      if (!a || !b) continue; // the bye this round
      // Alternate who is "home" so the fixed player isn't always listed first.
      const [h, w] = r % 2 === 0 ? [b, a] : [a, b];
      matches.push({ key: `${prefix}${group ? `-${group}` : ""}-${r}-${++slot}`, stage: "GROUP", group, round: r, slot, homeId: h.id, awayId: w.id, status: "PENDING", winnerId: null, nextKey: null, nextSide: null });
    }
    ring = [ring[ring.length - 1], ...ring.slice(0, -1)];
  }
  return matches;
}

export const GROUP_LETTERS = "ABCDEFGHIJKLMNOP";

/** Snake-seed into groups of about `groupSize`, round robin inside each, knockout for the top two of each group. */
export function groupsThenKnockout(entries: Entry[], groupSize = 4): { groups: Record<string, Entry[]>; matches: DrawMatch[] } {
  const sorted = [...entries].sort((a, b) => a.seed - b.seed);
  const groupCount = Math.max(1, Math.round(sorted.length / groupSize));
  const groups: Record<string, Entry[]> = {};
  for (let g = 0; g < groupCount; g++) groups[GROUP_LETTERS[g]] = [];
  sorted.forEach((e, i) => {
    const lap = Math.floor(i / groupCount), pos = i % groupCount;
    const g = lap % 2 === 0 ? pos : groupCount - 1 - pos;
    groups[GROUP_LETTERS[g]].push(e);
  });
  const matches: DrawMatch[] = [];
  for (const [letter, members] of Object.entries(groups)) matches.push(...roundRobin(members, letter, "G"));
  // Knockout skeleton: 2 per group, filled when the groups finish. Placeholders carry
  // the group position in the id so the bracket can be drawn before it is filled.
  if (groupCount >= 2) {
    // Group winners are seeded 1..G. Runners-up are placed so that nobody meets
    // their own group again in the first round: try the two natural orders and
    // keep the one with the fewest same-group pairings.
    const letters = Object.keys(groups);
    const build = (runnerSeed: (gi: number) => number) => {
      const placeholders: Entry[] = [];
      letters.forEach((letter, gi) => { placeholders.push({ id: `${letter}1`, seed: gi + 1 }); placeholders.push({ id: `${letter}2`, seed: runnerSeed(gi) }); });
      return singleElimination(placeholders, "KO");
    };
    const clashes = (ms: DrawMatch[]) => ms.filter((m) => m.round === 1 && m.homeId && m.awayId && m.homeId[0] === m.awayId[0]).length;
    const a = build((gi) => groupCount + gi + 1), b = build((gi) => groupCount * 2 - gi);
    matches.push(...(clashes(a) <= clashes(b) ? a : b));
  }
  return { groups, matches };
}

export type Standing = { id: string; played: number; wins: number; losses: number; setsFor: number; setsAgainst: number; gamesFor: number; gamesAgainst: number; points: number };

/** "6-3 4-6 10-7" → sets and games for the home side. Tolerates "6:3", "6/3", commas. */
export function parseScore(score: string | null | undefined): { setsHome: number; setsAway: number; gamesHome: number; gamesAway: number } | null {
  if (!score) return null;
  const sets = score.trim().split(/[,\s]+/).map((s) => s.split(/[-:/]/).map((x) => parseInt(x, 10))).filter((p) => p.length === 2 && p.every((x) => Number.isFinite(x)));
  if (!sets.length) return null;
  let setsHome = 0, setsAway = 0, gamesHome = 0, gamesAway = 0;
  for (const [h, a] of sets) { gamesHome += h; gamesAway += a; if (h > a) setsHome++; else if (a > h) setsAway++; }
  return { setsHome, setsAway, gamesHome, gamesAway };
}

/** Table for one group (or the whole round robin). Points: 2 per win. Ties: head to head, then set diff, then game diff. */
export type ResultLike = { homeId: string | null; awayId: string | null; winnerId: string | null; score?: string | null };
export function standings(members: string[], matches: ResultLike[]): Standing[] {
  const table = new Map<string, Standing>(members.map((id) => [id, { id, played: 0, wins: 0, losses: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0, points: 0 }]));
  const played = matches.filter((m) => m.winnerId && m.homeId && m.awayId);
  for (const m of played) {
    const h = table.get(m.homeId!), a = table.get(m.awayId!);
    if (!h || !a) continue;
    h.played++; a.played++;
    const win = m.winnerId === m.homeId ? h : a, lose = win === h ? a : h;
    win.wins++; win.points += 2; lose.losses++;
    const s = parseScore(m.score);
    if (s) { h.setsFor += s.setsHome; h.setsAgainst += s.setsAway; a.setsFor += s.setsAway; a.setsAgainst += s.setsHome; h.gamesFor += s.gamesHome; h.gamesAgainst += s.gamesAway; a.gamesFor += s.gamesAway; a.gamesAgainst += s.gamesHome; }
  }
  const headToHead = (x: string, y: string) => { const m = played.find((m) => (m.homeId === x && m.awayId === y) || (m.homeId === y && m.awayId === x)); return m ? (m.winnerId === x ? -1 : 1) : 0; };
  const diff = (x: Standing, y: Standing) => (y.setsFor - y.setsAgainst) - (x.setsFor - x.setsAgainst) || (y.gamesFor - y.gamesAgainst) - (x.gamesFor - x.gamesAgainst) || members.indexOf(x.id) - members.indexOf(y.id);
  // Points first. A two-way tie is settled by the match between them; a
  // three-way tie (a beat b beat c beat a) goes on sets and games instead.
  const byPoints = [...table.values()].sort((x, y) => y.points - x.points);
  const out: Standing[] = [];
  for (let i = 0; i < byPoints.length;) {
    let j = i; while (j < byPoints.length && byPoints[j].points === byPoints[i].points) j++;
    const tied = byPoints.slice(i, j);
    out.push(...(tied.length === 2 ? tied.sort((x, y) => headToHead(x.id, y.id) || diff(x, y)) : tied.sort(diff)));
    i = j;
  }
  return out;
}

export type Scheduled<T> = T & { scheduledAt: Date; courtName: string };

/**
 * Lay matches out in time. Group rounds first (all groups' round 1 together,
 * then round 2, ...), then knockout rounds. Within a round, matches fill the
 * courts; a round that doesn't fit in one slot spills into the next.
 * Byes take no court time.
 */
export function scheduleMatches<T extends Pick<DrawMatch, "stage" | "round" | "status">>(matches: T[], start: Date, matchMinutes: number, courts: string[]): (T & { scheduledAt: Date | null; courtName: string | null })[] {
  const names = courts.length ? courts : ["Court 1"];
  const order = (m: T) => (m.stage === "GROUP" ? 0 : 1000) + m.round;
  const rounds = [...new Set(matches.map(order))].sort((a, b) => a - b);
  let slotIndex = 0;
  const out: (T & { scheduledAt: Date | null; courtName: string | null })[] = [];
  for (const r of rounds) {
    const inRound = matches.filter((m) => order(m) === r);
    let i = 0;
    for (const m of inRound) {
      if (m.status === "BYE") { out.push({ ...m, scheduledAt: null, courtName: null }); continue; }
      const slot = slotIndex + Math.floor(i / names.length);
      out.push({ ...m, scheduledAt: new Date(start.getTime() + slot * matchMinutes * 60_000), courtName: names[i % names.length] });
      i++;
    }
    slotIndex += Math.max(1, Math.ceil(i / names.length));
  }
  return out;
}

/** Deterministic shuffle so a "random" draw can be reproduced from its seed string. */
export function shuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
