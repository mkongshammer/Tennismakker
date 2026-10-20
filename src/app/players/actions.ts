"use server";

import { redirect } from "next/navigation";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { coachChatGate } from "../../lib/coach-messaging";

export async function contactPlayer(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const otherId = String(formData.get("playerId") ?? "").trim();
  if (!otherId || otherId === user.id) redirect("/players");

  const other = await db.user.findFirst({
    where: {
      id: otherId,
      role: { in: ["PLAYER", "COACH"] },
      country: user.country,
    },
    select: { id: true, name: true, level: true, area: true, sports: true },
  });

  if (!other) redirect("/players");
  // Coach ↔ player: no chat before a paid lesson. Back to where they came from, with the reason.
  if (!(await coachChatGate(user.id, other.id)).allowed) {
    const coach = await db.coachProfile.findUnique({ where: { userId: other.id }, select: { id: true } });
    redirect(coach ? `/coaches/${coach.id}?chat=locked` : "/players?chat=locked");
  }

  const existing = await db.matchRequest.findFirst({
    where: {
      source: "DIRECT",
      OR: [
        { requesterId: user.id, acceptedById: other.id },
        { requesterId: other.id, acceptedById: user.id },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) redirect(`/messages/${existing.id}`);

  const sport = other.sports
    .split(",")
    .map((s) => s.trim())
    .find(Boolean) ?? "TENNIS";

  const thread = await db.matchRequest.create({
    data: {
      status: "MATCHED",
      message: `Samtale med ${other.name}`,
      area: other.area ?? user.area ?? "Danmark",
      level: other.level,
      sport,
      matchType: "TRAENING",
      source: "DIRECT",
      requesterId: user.id,
      acceptedById: other.id,
    },
  });

  redirect(`/messages/${thread.id}`);
}
