// Tournament draws in the database: make the draw from the paid sign-ups,
// schedule it on the club's courts, record results and move winners on.
// The bracket maths lives in tournament-draw.ts.
import { db } from "./db";
import { sendMail } from "./email";
import { type DrawMatch, type Entry, type Format, FORMATS, groupsThenKnockout, roundRobin, scheduleMatches, shuffle, singleElimination, standings, roundName } from "./tournament-draw";

const PLACEHOLDER = /^[A-P][12]$/;

export type DrawResult = { ok: true; matches: number } | { ok: false; error: string };

/** Build (or rebuild) the draw. Refuses once a result has been entered; reset first. */
export async function drawTournament(clubId: string, eventId: string): Promise<DrawResult> {
  const ev = await db.clubEvent.findFirst({ where: { id: eventId, clubId }, include: { signups: { where: { status: "PAID" }, include: { user: { select: { id: true, name: true, email: true, level: true, locale: true } } }, orderBy: { paidAt: "asc" } }, club: { select: { name: true, slug: true, timeZone: true } } } });
  if (!ev) return { ok: false, error: "Arrangementet findes ikke." };
  if (!FORMATS.includes(ev.format as Format)) return { ok: false, error: "Vælg et turneringsformat på arrangementet først." };
  const format = ev.format as Format;
  const played = await db.tournamentMatch.count({ where: { eventId, status: "PLAYED" } });
  if (played) return { ok: false, error: "Der er allerede indtastet resultater. Nulstil lodtrækningen først." };
  const minimum = format === "GROUPS_KNOCKOUT" ? 4 : 2;
  if (ev.signups.length < minimum) return { ok: false, error: `Der skal være mindst ${minimum} tilmeldte.` };

  // Seeding: by level (strongest first), or a blind draw.
  const ordered = ev.seeding === "RANDOM" ? shuffle(ev.signups, `${eventId}:${Date.now()}`) : [...ev.signups].sort((a, b) => b.user.level - a.user.level || a.paidAt!.getTime() - b.paidAt!.getTime());
  const entries: Entry[] = ordered.map((s, i) => ({ id: s.id, seed: i + 1, name: s.user.name }));

  let draw: DrawMatch[];
  let groups: Record<string, Entry[]> = {};
  if (format === "SINGLE_ELIM") draw = singleElimination(entries);
  else if (format === "ROUND_ROBIN") draw = roundRobin(entries, null, "RR");
  else { const g = groupsThenKnockout(entries, ev.groupSize); draw = g.matches; groups = g.groups; }

  // Courts: the club's courts for the sport, as many as the event runs in parallel.
  const courts = await db.court.findMany({ where: { clubId, sport: ev.sport }, orderBy: { name: "asc" }, select: { name: true } });
  const names = courts.slice(0, Math.max(1, ev.parallelCourts)).map((c) => c.name);
  while (names.length < Math.max(1, ev.parallelCourts)) names.push(`Court ${names.length + 1}`);
  const scheduled = scheduleMatches(draw, ev.startsAt, ev.matchMinutes, names);

  const real = (id: string | null) => (id && !PLACEHOLDER.test(id) ? id : null);
  const from = (id: string | null) => (id && PLACEHOLDER.test(id) ? id : null);
  await db.$transaction(async (tx) => {
    await tx.tournamentMatch.deleteMany({ where: { eventId } });
    const ids = new Map<string, string>();
    for (const m of scheduled) {
      const row = await tx.tournamentMatch.create({ data: { eventId, stage: m.stage, group: m.group, round: m.round, slot: m.slot, homeId: real(m.homeId), awayId: real(m.awayId), homeFrom: from(m.homeId), awayFrom: from(m.awayId), winnerId: real(m.winnerId), status: m.status, scheduledAt: m.scheduledAt, courtName: m.courtName, nextSide: m.nextSide } });
      ids.set(m.key, row.id);
    }
    for (const m of scheduled) if (m.nextKey) await tx.tournamentMatch.update({ where: { id: ids.get(m.key)! }, data: { nextMatchId: ids.get(m.nextKey) ?? null } });
    await tx.clubEvent.update({ where: { id: eventId }, data: { drawnAt: new Date() } });
  });

  // Tell everyone when they play first.
  const { formatDate } = await import("./international");
  const { settingsSnapshot } = await import("./settings");
  const link = `${settingsSnapshot().appUrl}/clubs/${ev.club.slug}/events/${ev.id}`;
  const nameOf = new Map(ev.signups.map((s) => [s.id, s.user.name]));
  for (const s of ev.signups) {
    const first = scheduled.filter((m) => (m.homeId === s.id || m.awayId === s.id) && m.scheduledAt).sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())[0];
    const group = Object.entries(groups).find(([, g]) => g.some((e) => e.id === s.id))?.[0];
    const lines = [`Hi ${s.user.name}`, "", `The draw for ${ev.name} at ${ev.club.name} is out.`];
    if (group) lines.push(`You're in group ${group} with ${groups[group].filter((e) => e.id !== s.id).map((e) => e.name).join(", ")}.`);
    if (first) lines.push(`Your first match: ${formatDate(first.scheduledAt!, s.user.locale ?? "en-US", ev.club.timeZone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} on ${first.courtName} against ${nameOf.get(first.homeId === s.id ? first.awayId! : first.homeId!) ?? "to be decided"}.`);
    else lines.push("You have a bye in the first round.");
    lines.push("", `Full draw and schedule: ${link}`);
    await sendMail({ to: s.user.email, subject: `${ev.club.name}: the draw for ${ev.name}`, body: lines.join("\n") }).catch(() => {});
  }
  return { ok: true, matches: scheduled.length };
}

export async function resetDraw(clubId: string, eventId: string) {
  const ev = await db.clubEvent.findFirst({ where: { id: eventId, clubId }, select: { id: true } });
  if (!ev) return;
  await db.$transaction([db.tournamentMatch.deleteMany({ where: { eventId } }), db.clubEvent.update({ where: { id: eventId }, data: { drawnAt: null } })]);
}

/** Enter a result. Winners move to the next knockout match; finished groups fill the knockout. */
export async function recordResult(clubId: string, matchId: string, winnerId: string, score: string | null) {
  const m = await db.tournamentMatch.findFirst({ where: { id: matchId, event: { clubId } } });
  if (!m) return { ok: false as const, error: "Kampen findes ikke." };
  if (!m.homeId || !m.awayId) return { ok: false as const, error: "Begge spillere skal være på plads først." };
  if (winnerId !== m.homeId && winnerId !== m.awayId) return { ok: false as const, error: "Vinderen skal være en af de to spillere." };
  if (m.nextMatchId) {
    const next = await db.tournamentMatch.findUnique({ where: { id: m.nextMatchId }, select: { status: true } });
    if (next?.status === "PLAYED") return { ok: false as const, error: "Den næste kamp er allerede spillet." };
  }
  await db.$transaction(async (tx) => {
    await tx.tournamentMatch.update({ where: { id: m.id }, data: { winnerId, score: score?.slice(0, 40) || null, status: "PLAYED" } });
    if (m.nextMatchId) await tx.tournamentMatch.update({ where: { id: m.nextMatchId }, data: m.nextSide === "away" ? { awayId: winnerId } : { homeId: winnerId } });
  });
  if (m.stage === "GROUP") await fillKnockoutFromGroups(m.eventId);
  return { ok: true as const };
}

export async function clearResult(clubId: string, matchId: string) {
  const m = await db.tournamentMatch.findFirst({ where: { id: matchId, event: { clubId } } });
  if (!m || m.status !== "PLAYED") return { ok: false as const, error: "Kampen er ikke spillet." };
  if (m.nextMatchId) {
    const next = await db.tournamentMatch.findUnique({ where: { id: m.nextMatchId }, select: { status: true } });
    if (next?.status === "PLAYED") return { ok: false as const, error: "Den næste kamp er allerede spillet." };
  }
  await db.$transaction(async (tx) => {
    await tx.tournamentMatch.update({ where: { id: m.id }, data: { winnerId: null, score: null, status: "PENDING" } });
    if (m.nextMatchId) await tx.tournamentMatch.update({ where: { id: m.nextMatchId }, data: m.nextSide === "away" ? { awayId: null } : { homeId: null } });
  });
  return { ok: true as const };
}

/** When every group match is played, the top two of each group take their knockout places. */
async function fillKnockoutFromGroups(eventId: string) {
  const all = await db.tournamentMatch.findMany({ where: { eventId } });
  const groupMatches = all.filter((m) => m.stage === "GROUP");
  if (!groupMatches.length || !all.some((m) => m.stage === "KO") || groupMatches.some((m) => m.status !== "PLAYED")) return;
  const placing = new Map<string, string>();
  for (const letter of new Set(groupMatches.map((m) => m.group!))) {
    const inGroup = groupMatches.filter((m) => m.group === letter);
    const members = [...new Set(inGroup.flatMap((m) => [m.homeId!, m.awayId!]))];
    const table = standings(members, inGroup);
    table.slice(0, 2).forEach((s, i) => placing.set(`${letter}${i + 1}`, s.id));
  }
  await db.$transaction(async (tx) => {
    for (const m of all.filter((m) => m.stage === "KO")) {
      const data: Record<string, string | null> = {};
      if (m.homeFrom && placing.get(m.homeFrom)) data.homeId = placing.get(m.homeFrom)!;
      if (m.awayFrom && placing.get(m.awayFrom)) data.awayId = placing.get(m.awayFrom)!;
      if (Object.keys(data).length) await tx.tournamentMatch.update({ where: { id: m.id }, data });
    }
    // Byes in the knockout skeleton: the one player present goes straight through.
    const ko = await tx.tournamentMatch.findMany({ where: { eventId, stage: "KO", status: "BYE" } });
    for (const m of ko) {
      const through = m.homeId ?? m.awayId;
      if (!through || !m.nextMatchId) continue;
      await tx.tournamentMatch.update({ where: { id: m.id }, data: { winnerId: through } });
      await tx.tournamentMatch.update({ where: { id: m.nextMatchId }, data: m.nextSide === "away" ? { awayId: through } : { homeId: through } });
    }
  });
}

export type MatchView = { id: string; stage: string; group: string | null; round: number; slot: number; roundName: string; home: { id: string; name: string; userId: string } | null; away: { id: string; name: string; userId: string } | null; homeFrom: string | null; awayFrom: string | null; winnerId: string | null; score: string | null; status: string; scheduledAt: Date | null; courtName: string | null };
export type GroupView = { letter: string; table: { id: string; name: string; userId: string; played: number; wins: number; losses: number; points: number; setsFor: number; setsAgainst: number }[] };

/** Everything a bracket page needs. */
export async function tournamentView(eventId: string): Promise<{ matches: MatchView[]; groups: GroupView[]; koRounds: number; champion: { name: string } | null }> {
  const rows = await db.tournamentMatch.findMany({ where: { eventId }, orderBy: [{ stage: "asc" }, { round: "asc" }, { slot: "asc" }], include: { home: { include: { user: { select: { id: true, name: true } } } }, away: { include: { user: { select: { id: true, name: true } } } } } });
  const koRounds = Math.max(0, ...rows.filter((m) => m.stage === "KO").map((m) => m.round));
  const side = (s: typeof rows[number]["home"]) => (s ? { id: s.id, name: s.user.name, userId: s.user.id } : null);
  const matches: MatchView[] = rows.map((m) => ({ id: m.id, stage: m.stage, group: m.group, round: m.round, slot: m.slot, roundName: m.stage === "KO" ? roundName(m.round, koRounds) : `Round ${m.round}`, home: side(m.home), away: side(m.away), homeFrom: m.homeFrom, awayFrom: m.awayFrom, winnerId: m.winnerId, score: m.score, status: m.status, scheduledAt: m.scheduledAt, courtName: m.courtName }));
  const groups: GroupView[] = [];
  const letters = [...new Set(rows.filter((m) => m.stage === "GROUP").map((m) => m.group ?? ""))].sort();
  for (const letter of letters) {
    const inGroup = rows.filter((m) => m.stage === "GROUP" && (m.group ?? "") === letter);
    const people = new Map<string, { name: string; userId: string }>();
    for (const m of inGroup) { if (m.home) people.set(m.home.id, { name: m.home.user.name, userId: m.home.user.id }); if (m.away) people.set(m.away.id, { name: m.away.user.name, userId: m.away.user.id }); }
    const table = standings([...people.keys()], inGroup).map((s) => ({ ...s, name: people.get(s.id)!.name, userId: people.get(s.id)!.userId }));
    groups.push({ letter, table });
  }
  const final = rows.find((m) => m.stage === "KO" && m.round === koRounds && m.status === "PLAYED");
  const champion = final ? (final.winnerId === final.homeId ? final.home : final.away) : null;
  // Round robin without knockout: the table winner once all is played.
  const rrDone = !final && rows.length > 0 && rows.every((m) => m.stage === "GROUP" && m.status === "PLAYED") && groups.length === 1;
  return { matches, groups, koRounds, champion: champion ? { name: champion.user.name } : rrDone ? { name: groups[0].table[0].name } : null };
}
