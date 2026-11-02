"use server";
// Player notification settings: push categories (shared with the mobile app),
// the inspiration e-mails, and the private calendar subscription link.
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { optoutKey } from "./engagement-emails";
import { calendarToken } from "./calendar-feed";

type State = { ok?: string; error?: string } | null;

export async function notificationSettings() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [push, optout] = await Promise.all([
    db.pushPreference.findUnique({ where: { userId: user.id } }),
    db.platformSetting.findUnique({ where: { key: optoutKey(user.id) } }),
  ]);
  return {
    bookings: push?.bookings ?? true,
    reminders: push?.reminders ?? true,
    messages: push?.messages ?? true,
    coaching: push?.coaching ?? true,
    tips: !optout,
  };
}

export async function saveNotificationSettings(_prev: State, form: FormData): Promise<State> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const on = (k: string) => form.get(k) === "on";
  const data = { bookings: on("bookings"), reminders: on("reminders"), messages: on("messages"), coaching: on("coaching") };
  await db.pushPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  if (on("tips")) await db.platformSetting.deleteMany({ where: { key: optoutKey(user.id) } });
  else await db.platformSetting.upsert({ where: { key: optoutKey(user.id) }, create: { key: optoutKey(user.id), value: new Date().toISOString() }, update: {} });
  revalidatePath("/profile/settings");
  return { ok: "Notification settings saved." };
}

export async function calendarLink(rotate = false) {
  const user = await getCurrentUser();
  if (!user) return null;
  const token = await calendarToken(user.id, rotate);
  return `https://racketbuddy.app/calendar/${token}.ics`;
}

export async function newCalendarLink(_prev: State): Promise<State> {
  const link = await calendarLink(true);
  if (!link) return { error: "Sign in first." };
  revalidatePath("/profile/settings");
  return { ok: "New link made. The old link no longer works — add the new one to your calendar." };
}
