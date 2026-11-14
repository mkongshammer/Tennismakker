// One-off (14 Nov 2026): accounts erased before today were named "Slettet
// bruger" (Danish). Renames them to the English name, so old matches and
// bookings that still reference them read right in the US app.
import { db } from "./db";
import { DELETED_NAME } from "./erasure";

const FLAG = "oneoff:rename-deleted:2026-11-14";

export async function renameDeletedOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const r = await db.user.updateMany({ where: { name: "Slettet bruger", email: { endsWith: ".invalid" } }, data: { name: DELETED_NAME } });
  console.log("[rename-deleted]", r.count);
}
