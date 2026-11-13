// One-off (13 Nov 2026): the owner asked to delete two of his own old accounts.
// Uses the app's normal account deletion (eraseAccount). Never touches the
// Google/Apple review account or his login accounts.
import { db } from "./db";

const FLAG = "oneoff:delete-magnus-accounts:2026-11-13";
const TARGETS = [
  { id: "cmvs1xgq500015hq79ego9l5t", email: "mkongsyou@gmail.com" },
  { id: "cmvz5r3vd0000clmcydeo5fes", email: "magnuskongs1@gmail.com" },
];

export async function deleteMagnusAccountsOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const { eraseAccount } = await import("./erasure");
  const lines: string[] = [];
  for (const t of TARGETS) {
    const u = await db.user.findUnique({ where: { id: t.id }, select: { email: true } }).catch(() => null);
    // Only if id and e-mail still match, so nothing else can be hit by mistake.
    if (!u || u.email?.toLowerCase() !== t.email) { lines.push(`- ${t.email}: ikke fundet (måske allerede slettet)`); continue; }
    try { await eraseAccount(t.id); lines.push(`- ${t.email}: slettet`); }
    catch (e) { lines.push(`- ${t.email}: kunne ikke slettes (${e instanceof Error ? e.message : String(e)})`); }
  }
  const { tellOwner } = await import("./founding-offer");
  await tellOwner("RacketBuddy: dine gamle konti er slettet", `${lines.join("\n")}\n\nm.kongshammer@icloud.com, magnus@racketbuddy.app og Google Review-kontoen er ikke rørt.`).catch(() => null);
}
