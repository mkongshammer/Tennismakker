// One-off (11 Nov 2026): lists the owner's own and look-alike accounts so he
// can confirm which to delete. Reads only; mails the list to the owner.
import { db } from "./db";

const FLAG = "oneoff:list-magnus-accounts:2026-11-11";

export async function listMagnusAccountsOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const users = await db.user.findMany({
    where: { OR: [{ name: { contains: "magnus", mode: "insensitive" } }, { name: { contains: "kongshammer", mode: "insensitive" } }, { email: { contains: "kongshammer", mode: "insensitive" } }, { email: { endsWith: "@racketbuddy.app" } }, { email: { endsWith: "@mindrepaaspil.dk" } }, { name: "Google Review" }] },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const lines = await Promise.all(users.map(async (u) => {
    const [bookings, sent, sessions] = await Promise.all([
      db.booking.count({ where: { userId: u.id } }).catch(() => -1),
      db.message.count({ where: { senderId: u.id } }).catch(() => -1),
      db.mobileSession.findFirst({ where: { userId: u.id }, orderBy: { lastUsedAt: "desc" }, select: { lastUsedAt: true } }).catch(() => null),
    ]);
    return `- ${u.name} <${u.email}> · ${u.role} · oprettet ${u.createdAt.toISOString().slice(0, 10)} · ${bookings} bookinger · ${sent} beskeder · app sidst brugt ${sessions?.lastUsedAt.toISOString().slice(0, 10) ?? "aldrig"} · id ${u.id}`;
  }));
  const { tellOwner } = await import("./founding-offer");
  await tellOwner("RacketBuddy: dine konti (til Claude)", `Konti der ligner dine egne, eller som er Googles/Apples testkonto:\n\n${lines.join("\n")}\n\nIntet er slettet. Svar Claude, hvilke der skal væk.`);
}
