// Keeps count of the mail RacketBuddy sends through Resend, so a free plan's
// limits (100 a day, 3,000 a month) never silently drop booking mail:
//  - the owner gets one warning at 80% of the day's or the month's quota;
//  - bulk mail (member invitations) only uses what's left after a reserve
//    for booking mail, and the rest goes out automatically on later days.
// MAIL_DAILY_LIMIT / MAIL_MONTHLY_LIMIT override the defaults; set both to 0
// after upgrading to a plan without these limits.
import { db } from "./db";

const num = (v: string | undefined, d: number) => (v === undefined || v === "" ? d : Math.max(0, Number(v) || 0));
export const dailyLimit = () => num(process.env.MAIL_DAILY_LIMIT, 100);
export const monthlyLimit = () => num(process.env.MAIL_MONTHLY_LIMIT, 3000);
/** Kept free each day for booking confirmations, receipts and password resets. */
export const DAILY_RESERVE = 30;

const dayKey = (now: Date) => `mail:count:day:${now.toISOString().slice(0, 10)}`;
const monthKey = (now: Date) => `mail:count:month:${now.toISOString().slice(0, 7)}`;

async function bump(key: string, n: number) {
  const row = await db.platformSetting.upsert({ where: { key }, create: { key, value: "0" }, update: {} });
  const next = (Number(row.value) || 0) + n;
  await db.platformSetting.update({ where: { key }, data: { value: String(next) } });
  return next;
}

export async function mailUsage(now = new Date()) {
  const rows = await db.platformSetting.findMany({ where: { key: { in: [dayKey(now), monthKey(now)] } } });
  const v = (k: string) => Number(rows.find((r) => r.key === k)?.value ?? 0) || 0;
  return { today: v(dayKey(now)), month: v(monthKey(now)), dailyLimit: dailyLimit(), monthlyLimit: monthlyLimit() };
}

/** How many bulk mails may still go out today without eating the reserve or the month. 0 limits = unlimited. */
export async function bulkHeadroom(now = new Date()) {
  const u = await mailUsage(now);
  const day = u.dailyLimit ? u.dailyLimit - DAILY_RESERVE - u.today : Infinity;
  const month = u.monthlyLimit ? u.monthlyLimit - DAILY_RESERVE * 3 - u.month : Infinity;
  return Math.max(0, Math.min(day, month));
}

/** Called after mail is accepted by Resend. Never throws. */
export async function countMail(n: number, warn: (subject: string, body: string) => Promise<unknown>, now = new Date()) {
  if (n <= 0) return;
  try {
    const today = await bump(dayKey(now), n);
    const month = await bump(monthKey(now), n);
    const d = dailyLimit(), m = monthlyLimit();
    const checks: Array<[string, number, number, string]> = [
      [`mail:warned:${dayKey(now)}`, today, d, "i dag"],
      [`mail:warned:${monthKey(now)}`, month, m, "denne måned"],
    ];
    for (const [key, used, limit, when] of checks) {
      if (!limit || used < limit * 0.8) continue;
      try { await db.platformSetting.create({ data: { key, value: now.toISOString() } }); } catch { continue; } // warned already
      await warn(
        `RacketBuddy: ${used} af ${limit} mails brugt ${when}`,
        [
          `RacketBuddy har sendt ${used} af de ${limit} mails, Resends gratis plan tillader ${when}.`,
          "Når grænsen nås, bliver bookingbekræftelser, kvitteringer og nulstilling af adgangskoder ikke sendt.",
          "",
          "Opgrader til Resend Pro ($20/md, 50.000 mails, ingen dagsgrænse): https://resend.com/settings/billing",
          "Sig derefter til, så fjerner vi grænserne i RacketBuddy (MAIL_DAILY_LIMIT=0 og MAIL_MONTHLY_LIMIT=0 på Render).",
          "",
          "Medlemsinvitationer venter automatisk til næste dag, så de ikke bruger grænsen op.",
        ].join("\n"),
      );
    }
  } catch (e) { console.error("[mail-quota]", e instanceof Error ? e.message : e); }
}
