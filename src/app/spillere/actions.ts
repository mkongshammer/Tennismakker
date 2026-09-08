"use server";

import { redirect } from "next/navigation";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";

export async function contactPlayer(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const otherId = String(formData.get("playerId") ?? "").trim();
  if (!otherId || otherId === user.id) redirect("/spillere");

  const other = await db.user.findFirst({
    where: {
      id: otherId,
      role: { in: ["PLAYER", "COACH"] },
      country: user.country,
    },
    select: { id: true, name: true, level: true, area: true, sports: true },
  });

  if (!other) redirect("/spillere");

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

  if (existing) redirect(`/beskeder/${existing.id}`);

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

  redirect(`/beskeder/${thread.id}`);
}
