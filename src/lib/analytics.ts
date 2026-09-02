// Tal om, hvordan det går.
//
// To ting tælles forskelligt, og det er værd at kende forskellen:
//
// - Brugere, klubber, bookinger og opslag tælles ud fra `createdAt` på
//   rækkerne selv. Det er præcist og kræver ingen ekstra registrering.
// - Sidevisninger tælles i en tæller pr. dag. Vi gemmer hverken IP-adresse,
//   cookie eller sti, så det er sidevisninger, ikke besøgende — og det
//   siger tabellen også, frem for at love noget, tallet ikke kan holde.
//
// Der er ingen persondata i det her overhovedet. Det er med vilje: et tal
// på en skærm er ikke værd at bygge et samtykkebanner op omkring.

import { db } from "./db";

/** Robotter tæller ikke med. Grov, men den fanger de fleste. */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|headless/i;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tæller én sidevisning.
 *
 * Fejler stille: et tal på en oversigtsside er aldrig værd at vælte en
 * sidevisning for.
 */
export async function recordView(userAgent: string | null): Promise<void> {
  if (userAgent && BOT.test(userAgent)) return;
  try {
    await db.dailyView.upsert({
      where: { day: today() },
      create: { day: today(), views: 1 },
      update: { views: { increment: 1 } },
    });
  } catch {
    // med vilje tavs
  }
}

export type Period = { key: string; label: string; since: Date | null };

/** Perioderne i oversigten. `since: null` betyder alt, fra begyndelsen. */
export function periods(): Period[] {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(startOfDay);
  // Mandag som ugens første dag — søndag er dag 0 i JavaScript.
  startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return [
    { key: "dag", label: "I dag", since: startOfDay },
    { key: "uge", label: "Denne uge", since: startOfWeek },
    { key: "maaned", label: "Denne måned", since: startOfMonth },
    { key: "aar", label: "I år", since: startOfYear },
    { key: "alt", label: "I alt", since: null },
  ];
}

export type Row = { label: string; note?: string; values: number[] };

const since = (d: Date | null) => (d ? { createdAt: { gte: d } } : {});

/** Hele oversigten: hver række et tal, hver søjle en periode. */
export async function overview(): Promise<{ periods: Period[]; rows: Row[] }> {
  const ps = periods();

  const count = (fn: (p: Period) => Promise<number>) => Promise.all(ps.map(fn));

  const [users, players, coaches, clubs, courtBookings, coachBookings, posts, views] =
    await Promise.all([
      count((p) => db.user.count({ where: since(p.since) })),
      count((p) => db.user.count({ where: { role: "PLAYER", ...since(p.since) } })),
      count((p) => db.user.count({ where: { role: "COACH", ...since(p.since) } })),
      count((p) => db.club.count({ where: { status: "APPROVED", ...since(p.since) } })),
      count((p) =>
        db.booking.count({ where: { kind: "COURT", status: "CONFIRMED", ...since(p.since) } })
      ),
      count((p) =>
        db.booking.count({ where: { kind: "COACH", status: "CONFIRMED", ...since(p.since) } })
      ),
      count((p) => db.matchRequest.count({ where: since(p.since) })),
      Promise.all(
        ps.map(async (p) => {
          const result = await db.dailyView.aggregate({
            _sum: { views: true },
            where: p.since ? { day: { gte: p.since.toISOString().slice(0, 10) } } : {},
          });
          return result._sum.views ?? 0;
        })
      ),
    ]);

  return {
    periods: ps,
    rows: [
      { label: "Brugere i alt", values: users },
      { label: "Spillere", values: players },
      { label: "Trænere", values: coaches },
      { label: "Klubber", note: "godkendte", values: clubs },
      { label: "Banebookinger", note: "betalte", values: courtBookings },
      { label: "Trænertimer", note: "betalte", values: coachBookings },
      { label: "Makker-opslag", values: posts },
      { label: "Sidevisninger", note: "robotter fraregnet", values: views },
    ],
  };
}

export type MoneyRow = { label: string; note?: string; values: string[] };

const kr = (n: number) => `${n.toLocaleString("da-DK")} kr`;

/**
 * Hvad der faktisk kom ind.
 *
 * Kun betalinger med status PAID tælles. En reservation, der aldrig blev
 * betalt, er ikke omsætning — og et tal, der tæller hensigter med, er
 * værre end intet tal, fordi man tror på det.
 *
 * Abonnementerne står for sig: de opkræves månedligt af Stripe og optræder
 * ikke som Payment-rækker her. Beløbet er derfor det, der løber lige nu,
 * ikke det der er kommet ind i perioden.
 */
export async function economy(): Promise<{
  periods: Period[];
  rows: MoneyRow[];
  subscriptionMonthly: number;
  subscriptionClubs: number;
}> {
  const ps = periods();

  const sums = await Promise.all(
    ps.map((p) =>
      db.payment.aggregate({
        _sum: { amountKr: true, platformFee: true },
        _count: true,
        where: { status: "PAID", ...(p.since ? { createdAt: { gte: p.since } } : {}) },
      })
    )
  );

  const subscribers = await db.club.findMany({
    where: { billingModel: "SUBSCRIPTION", subscriptionStatus: { in: ["active", "trialing"] } },
    select: { subscriptionKr: true },
  });

  return {
    periods: ps,
    rows: [
      {
        label: "Betalinger",
        note: "gennemført",
        values: sums.map((s) => String(s._count)),
      },
      {
        label: "Beløb gennem platformen",
        note: "klubbens og vores tilsammen",
        values: sums.map((s) => kr(s._sum.amountKr ?? 0)),
      },
      {
        label: "Vores andel",
        note: "før Stripes gebyr",
        values: sums.map((s) => kr(s._sum.platformFee ?? 0)),
      },
    ],
    subscriptionMonthly: subscribers.reduce((sum, c) => sum + c.subscriptionKr, 0),
    subscriptionClubs: subscribers.length,
  };
}
