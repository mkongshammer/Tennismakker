// One-off (13 Nov 2026): the city list was extended at index 268. Jump the city
// cursor straight to the new cities (Florida and Texas first) instead of
// walking past the 268 already-searched ones.
import { db } from "./db";

const FLAG = "oneoff:city-cursor-268:2026-11-13";

export async function jumpCityCursorOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return;
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const key = "sales:dircity:cursor";
  await db.platformSetting.upsert({ where: { key }, create: { key, value: "268" }, update: { value: "268" } });
}
