// Access levels inside a club's administration.
//   OWNER      – everything, including the subscription, payments and who the admins are
//   MANAGER    – runs the club: prices, courts, members, events, staff, reports, lights…
//                but not the RacketBuddy subscription or the admin list
//   FRONT_DESK – day-to-day desk work: bookings, open times, members, teams, events, shop
// Admins from before levels existed count as OWNER, so nobody loses access.
import { db } from "./db";

import { STAFF_LEVELS, atLeast, canAccessSection, type StaffLevel } from "./staff-access";
export { STAFF_LEVELS, atLeast, canAccessSection, type StaffLevel };

const key = (userId: string) => `club:staff-level:${userId}`;
const valid = (v: unknown): v is StaffLevel => v === "OWNER" || v === "MANAGER" || v === "FRONT_DESK";

export async function getStaffLevel(userId: string): Promise<StaffLevel> {
  const row = await db.platformSetting.findUnique({ where: { key: key(userId) } }).catch(() => null);
  return valid(row?.value) ? row!.value as StaffLevel : "OWNER";
}
export async function setStaffLevel(userId: string, level: StaffLevel) {
  await db.platformSetting.upsert({ where: { key: key(userId) }, create: { key: key(userId), value: level }, update: { value: level } });
}
export async function staffLevels(userIds: string[]) {
  const rows = await db.platformSetting.findMany({ where: { key: { in: userIds.map(key) } } });
  return Object.fromEntries(userIds.map((id) => [id, (rows.find((r) => r.key === key(id))?.value as StaffLevel | undefined) ?? "OWNER"])) as Record<string, StaffLevel>;
}

export class StaffAccessError extends Error {
  constructor(needed: string) { super(`Your admin role doesn't include ${needed}. Ask the club's owner.`); this.name = "StaffAccessError"; }
}
