"use server";
// Owners choose each admin's level (owner / manager / front desk).
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { getStaffLevel, setStaffLevel, staffLevels, type StaffLevel } from "./staff-roles";

export async function changeStaffLevel(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (me?.role !== "CLUB_ADMIN" || !me.clubId) throw Error("Only club administrators can do this.");
  if ((await getStaffLevel(me.id)) !== "OWNER") throw Error("Only an owner can change admin roles.");
  const memberId = String(formData.get("memberId") ?? "");
  const level = String(formData.get("level") ?? "") as StaffLevel;
  if (!["OWNER", "MANAGER", "FRONT_DESK"].includes(level)) throw Error("Unknown role.");
  const admin = await db.user.findFirst({ where: { id: memberId, clubId: me.clubId, role: "CLUB_ADMIN" }, select: { id: true } });
  if (!admin) return;
  if (level !== "OWNER") {
    // Never leave a club without an owner.
    const admins = await db.user.findMany({ where: { clubId: me.clubId, role: "CLUB_ADMIN" }, select: { id: true } });
    const levels = await staffLevels(admins.map((a) => a.id));
    const owners = admins.filter((a) => a.id !== memberId && levels[a.id] === "OWNER");
    if (!owners.length) throw Error("The club needs at least one owner.");
  }
  await setStaffLevel(memberId, level);
  revalidatePath("/admin", "layout");
}
