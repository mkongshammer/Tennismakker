// Pure staff-level rules (no database), usable in client and server components.
export type StaffLevel = "OWNER" | "MANAGER" | "FRONT_DESK";
export const STAFF_LEVELS: Array<{ id: StaffLevel; label: string; description: string }> = [
  { id: "OWNER", label: "Owner", description: "Everything, including subscription, payments and admins" },
  { id: "MANAGER", label: "Manager", description: "Runs the club: prices, courts, members, events, staff, reports" },
  { id: "FRONT_DESK", label: "Front desk", description: "Bookings, open times, members, teams, events and the shop" },
];

const RANK: Record<StaffLevel, number> = { FRONT_DESK: 1, MANAGER: 2, OWNER: 3 };
const OWNER_ONLY = new Set(["betaling", "indstillinger"]);
const FRONT_DESK_SECTIONS = new Set(["oversigt", "bookinger", "tider", "medlemmer", "hold", "events", "butik", "faste-bookinger"]);

export const atLeast = (level: StaffLevel, needed: StaffLevel) => RANK[level] >= RANK[needed];

/** Which admin section (or custom feature) a level may open. */
export function canAccessSection(level: StaffLevel, section: string) {
  if (level === "OWNER") return true;
  if (OWNER_ONLY.has(section)) return false;
  if (level === "MANAGER") return true;
  return FRONT_DESK_SECTIONS.has(section);
}

