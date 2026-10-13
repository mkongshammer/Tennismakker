"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "./db";
import { sendMail } from "./email";
import { getCurrentUser } from "./session";

type TicketResult =
  | { ok: "SENT"; ticketNumber: string }
  | { error: "UNAUTHORIZED" | "INVALID_TYPE" | "SUBJECT_SHORT" | "DETAILS_SHORT" | "CLUB_NOT_FOUND" }
  | null;

const TYPES = new Set(["IMPROVEMENT", "CHANGE", "BUG", "INTEGRATION", "OTHER"]);
const TYPE_LABELS: Record<string, string> = {
  IMPROVEMENT: "Forbedringsforslag",
  CHANGE: "Ændringsønske",
  BUG: "Fejl / problem",
  INTEGRATION: "Ny integration",
  OTHER: "Andet",
};

export async function createClubSupportTicket(
  _prev: TicketResult,
  formData: FormData
): Promise<TicketResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) return { error: "UNAUTHORIZED" };

  const type = String(formData.get("type") ?? "").trim().toUpperCase();
  const priority = String(formData.get("priority") ?? "NORMAL").trim().toUpperCase() === "HIGH" ? "HIGH" : "NORMAL";
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 140);
  const details = String(formData.get("details") ?? "").trim().slice(0, 3_000);
  const page = String(formData.get("page") ?? "").trim().slice(0, 80);

  if (!TYPES.has(type)) return { error: "INVALID_TYPE" };
  if (subject.length < 5) return { error: "SUBJECT_SHORT" };
  if (details.length < 10) return { error: "DETAILS_SHORT" };

  const club = await db.club.findUnique({
    where: { id: user.clubId },
    select: { id: true, name: true, city: true, country: true },
  });
  if (!club) return { error: "CLUB_NOT_FOUND" };

  const id = crypto.randomUUID();
  const ticketNumber = `RB-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const createdAt = new Date();
  const ticket = {
    id,
    ticketNumber,
    status: "NEW",
    priority,
    type,
    typeLabel: TYPE_LABELS[type],
    subject,
    details,
    page: page || null,
    createdAt: createdAt.toISOString(),
    clubId: club.id,
    clubName: club.name,
    city: club.city,
    country: club.country,
    requestedByUserId: user.id,
    requestedByName: user.name,
    requestedByEmail: user.email,
  };

  // Each ticket gets its own append-only key. The database is the source of truth;
  // email is only a notification, so a mail outage cannot lose the request.
  await db.platformSetting.create({
    data: {
      key: `clubSupportTicket:${id}`,
      value: JSON.stringify(ticket),
    },
  });

  await sendMail({
    to: "support@racketbuddy.app",
    subject: `[${ticketNumber}] ${priority === "HIGH" ? "HASTER — " : ""}${TYPE_LABELS[type]} — ${club.name}`,
    body: [
      `Ticket: ${ticketNumber}`,
      `Klub: ${club.name} (${club.city}, ${club.country})`,
      `Kontakt: ${user.name} <${user.email}>`,
      `Type: ${TYPE_LABELS[type]}`,
      `Prioritet: ${priority}`,
      `Side: ${page || "Ikke angivet"}`,
      `Emne: ${subject}`,
      "",
      details,
      "",
      `Internt ID: ${id}`,
    ].join("\n"),
  });

  return { ok: "SENT", ticketNumber };
}
