import crypto from "crypto";
import { db } from "./db";
import { SPORTS } from "./sports";

function intentKey(email: string) {
  const hash = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `buddy-sports-intent:${hash}`;
}

function chosenKey(userId: string) {
  return `buddy-sports-chosen:${userId}`;
}

export function normaliseBuddySports(values: string[]) {
  return Array.from(new Set(values.filter((s) => (SPORTS as readonly string[]).includes(s))));
}

export async function hasChosenBuddySports(userId: string) {
  return Boolean(await db.platformSetting.findUnique({ where: { key: chosenKey(userId) } }));
}

export async function markBuddySportsChosen(userId: string) {
  await db.platformSetting.upsert({
    where: { key: chosenKey(userId) },
    update: { value: new Date().toISOString() },
    create: { key: chosenKey(userId), value: new Date().toISOString() },
  });
}

export async function saveSignupSportsIntent(email: string, sports: string[]) {
  const valid = normaliseBuddySports(sports);
  if (!email.includes("@") || valid.length === 0) return;
  await db.platformSetting.upsert({
    where: { key: intentKey(email) },
    update: { value: JSON.stringify(valid) },
    create: { key: intentKey(email), value: JSON.stringify(valid) },
  });
}

export async function consumeSignupSportsIntent(user: { id: string; email: string; role: string }) {
  const key = intentKey(user.email);
  const setting = await db.platformSetting.findUnique({ where: { key } });
  if (!setting) return false;

  let values: string[] = [];
  try {
    values = normaliseBuddySports(JSON.parse(setting.value));
  } catch {
    values = [];
  }
  if (values.length === 0) return false;

  const sports = values.join(",");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { sports } }),
    ...(user.role === "COACH"
      ? [db.coachProfile.updateMany({ where: { userId: user.id }, data: { sports } })]
      : []),
    db.platformSetting.upsert({
      where: { key: chosenKey(user.id) },
      update: { value: new Date().toISOString() },
      create: { key: chosenKey(user.id), value: new Date().toISOString() },
    }),
    db.platformSetting.delete({ where: { key } }),
  ]);
  return true;
}
