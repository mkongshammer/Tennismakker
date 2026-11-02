"use server";
// Two-step login (a code by e-mail at every sign-in on the website).
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { clubTwoStepKey, twoStepKey } from "./twofactor";

type State = { ok?: string; error?: string } | null;

async function setFlag(key: string, on: boolean) {
  if (on) await db.platformSetting.upsert({ where: { key }, create: { key, value: "1" }, update: { value: "1" } });
  else await db.platformSetting.deleteMany({ where: { key } });
}

export async function setTwoStepLogin(_prev: State, form: FormData): Promise<State> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const on = form.get("twoStep") === "on";
  await setFlag(twoStepKey(user.id), on);
  revalidatePath("/profile/settings");
  return { ok: on ? "Two-step login is on. Next time you sign in, we'll e-mail you a 6-digit code." : "Two-step login is off." };
}

export async function setClubTwoStepRequirement(_prev: State, form: FormData): Promise<State> {
  const user = await getCurrentUser();
  if (user?.role !== "CLUB_ADMIN" || !user.clubId) return { error: "Only club administrators can do this." };
  const { getStaffLevel } = await import("./staff-roles");
  if ((await getStaffLevel(user.id)) !== "OWNER") return { error: "Only an owner can change this." };
  const on = form.get("required") === "on";
  await setFlag(clubTwoStepKey(user.clubId), on);
  revalidatePath("/admin", "layout");
  return { ok: on ? "All admins now get a login code by e-mail when they sign in." : "Two-step login is no longer required for admins." };
}

export async function twoStepStatus() {
  const user = await getCurrentUser();
  if (!user) return { own: false, club: false };
  const rows = await db.platformSetting.findMany({ where: { key: { in: [twoStepKey(user.id), ...(user.clubId ? [clubTwoStepKey(user.clubId)] : [])] } } });
  return { own: rows.some((r) => r.key === twoStepKey(user.id)), club: user.role === "CLUB_ADMIN" && rows.some((r) => r.key.startsWith("club:")) };
}
