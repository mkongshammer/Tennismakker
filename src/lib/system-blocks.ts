// Spærring af frigivne tider i klubbens eget system.
//
// Når en klub frigiver tider hos os, skal de samme tider spærres i deres
// eget system — ellers kan et medlem booke dem dér, og så er banen solgt
// to gange. Indtil nu gjorde klubben det i hånden.
//
// To faser, og adskillelsen er med vilje:
//
//   ensureBlocks() ser hvilke tider der er til salg, og skriver en række
//   for hver, der mangler at blive spærret. Hurtigt, kun database.
//
//   processBlocks() tager rækkerne og kører browseren. Langsomt, og kan
//   fejle.
//
// Var det ét skridt, ville en klub, der frigiver tyve tider, sidde og
// vente på tyve browsersessioner — og en fejl halvvejs ville efterlade
// halvdelen spærret uden at nogen vidste hvilke.

import { addDays } from "date-fns";
import { db } from "./db";
import { getClubAvailability } from "./integrations";
import { automationConfigured, reserveInClubSystem } from "./automation";

/**
 * Hvor langt frem vi spærrer.
 *
 * Fjorten dage. Længere ville betyde hundredvis af browsersessioner for en
 * klub, der frigiver hverdage året rundt — og en tid, der er spærret et
 * halvt år frem, kan klubben ikke bruge, hvis de skifter mening.
 */
const HORIZON_DAYS = 14;

/** Højst så mange forsøg pr. tid. Fejler den fem gange, er der noget galt, som flere forsøg ikke løser. */
const MAX_ATTEMPTS = 5;

/**
 * Finder tider, der er til salg hos os men ikke spærret hos klubben, og
 * skriver en række for hver.
 *
 * Kun for klubber med et gemt login. En klub uden automatisering spærrer
 * selv og sætter flueben — se requireBlockedFirst i actions.ts.
 */
export async function ensureBlocks(clubId: string): Promise<number> {
  const login = await db.clubSystemLogin.findUnique({ where: { clubId } });
  if (!login) return 0;

  const from = new Date();
  const until = addDays(from, HORIZON_DAYS);

  const { slots } = await getClubAvailability(clubId, from, until);
  if (slots.length === 0) return 0;

  // Hvad er allerede kendt? Ét opslag frem for et pr. tid.
  const known = await db.systemBlock.findMany({
    where: { clubId, startsAt: { gte: from, lte: until } },
    select: { courtId: true, startsAt: true },
  });
  const seen = new Set(known.map((b) => `${b.courtId}_${b.startsAt.getTime()}`));

  let created = 0;
  for (const slot of slots) {
    const key = `${slot.courtId}_${slot.startsAt.getTime()}`;
    if (seen.has(key)) continue;

    // createMany med skipDuplicates ville være hurtigere, men her er der
    // en unik nøgle på (courtId, startsAt), og to samtidige kørsler må
    // ikke vælte på den.
    await db.systemBlock
      .create({ data: { clubId, courtId: slot.courtId, startsAt: slot.startsAt } })
      .then(() => created++)
      .catch(() => {});
  }

  return created;
}

export type BlockRun = { blocked: number; failed: number; skipped: number };

/**
 * Kører de ventende spærringer gennem browseren.
 *
 * `limit` findes, fordi hver spærring er en browsersession på 15-30
 * sekunder. Uden et loft ville et cron-job med to hundrede ventende tider
 * køre i to timer og blive dræbt undervejs.
 */
export async function processBlocks(limit = 10): Promise<BlockRun> {
  const out: BlockRun = { blocked: 0, failed: 0, skipped: 0 };
  if (!automationConfigured()) return out;

  const pending = await db.systemBlock.findMany({
    where: {
      status: "PENDING",
      attempts: { lt: MAX_ATTEMPTS },
      // Tider, der er passeret, spærres ikke. De kan ikke sælges længere.
      startsAt: { gte: new Date() },
    },
    include: { court: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
    take: limit,
  });

  for (const b of pending) {
    const result = await reserveInClubSystem({
      clubId: b.clubId,
      courtName: b.court.name,
      date: toDateString(b.startsAt),
      time: toTimeString(b.startsAt),
    });

    if (result.verified) {
      await db.systemBlock.update({
        where: { id: b.id },
        data: { status: "BLOCKED", blockedAt: new Date(), error: null, attempts: { increment: 1 } },
      });
      out.blocked++;
      continue;
    }

    const attempts = b.attempts + 1;
    await db.systemBlock.update({
      where: { id: b.id },
      data: {
        attempts,
        error: (result.error ?? "Ukendt fejl").slice(0, 500),
        // Efter fem forsøg står den som fejlet, så klubben kan se, at den
        // skal spærre den tid i hånden. En række, der bliver forsøgt i det
        // uendelige, er en fejl, ingen opdager.
        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
      },
    });
    out.failed++;
  }

  return out;
}

/**
 * Fjerner spærringen fra vores side, når en tid ikke længere er til salg.
 *
 * Vi kan ikke fjerne den i klubbens system — det kræver en anden
 * automatisering, og en fejl dér ville frigive en tid, en gæst har
 * betalt for. Rækken slettes, så klubben kan se i deres eget system, at
 * tiden stadig står spærret og selv frigive den.
 */
export async function forgetBlock(courtId: string, startsAt: Date): Promise<void> {
  await db.systemBlock.deleteMany({ where: { courtId, startsAt } });
}

/** Status til klubbens administration. */
export async function blockSummary(clubId: string) {
  const rows = await db.systemBlock.groupBy({
    by: ["status"],
    where: { clubId, startsAt: { gte: new Date() } },
    _count: true,
  });

  const failures = await db.systemBlock.findMany({
    where: { clubId, status: "FAILED", startsAt: { gte: new Date() } },
    include: { court: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
    take: 10,
  });

  const count = (status: string) =>
    rows.find((r: any) => r.status === status)?._count ?? 0;

  return {
    blocked: count("BLOCKED"),
    pending: count("PENDING"),
    failed: count("FAILED"),
    failures: failures.map((f: any) => ({
      court: f.court.name,
      startsAt: f.startsAt,
      error: f.error as string | null,
    })),
  };
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function toTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}
