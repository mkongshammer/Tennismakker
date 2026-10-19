// "Add to calendar": one booking as a standard .ics file for the person who
// made it. Works with Apple Calendar, Google Calendar and Outlook without
// an integration — the file carries the venue time zone as UTC instants.
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";

export const dynamic = "force-dynamic";

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = " " + rest.slice(73);
  }
  out.push(rest);
  return out.join("\r\n");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const booking = await db.booking.findUnique({
    where: { id },
    include: { court: { include: { club: true } }, coachProfile: { include: { user: true } } },
  });
  if (!booking || booking.userId !== user.id) return new Response("Not found", { status: 404 });
  if (booking.status !== "CONFIRMED") return new Response("Booking is not confirmed", { status: 409 });

  const club = booking.court?.club;
  const summary = booking.kind === "COURT" && club && booking.court ? `${club.name} · ${booking.court.name}` : `Lesson with ${booking.coachProfile?.user.name ?? "coach"}`;
  const location = club ? [club.address, club.address?.includes(club.city) ? null : club.city].filter(Boolean).join(", ") : booking.coachProfile?.area ?? "";
  const description = [
    booking.kind === "COURT" ? "Court reservation via RacketBuddy." : "Coaching session via RacketBuddy.",
    club?.hasLock && club.accessCode ? `Access code: ${club.accessCode}` : null,
    club?.accessInstructions ?? null,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RacketBuddy//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@racketbuddy.app`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(booking.startsAt)}`,
    `DTEND:${icsDate(booking.endsAt)}`,
    fold(`SUMMARY:${escapeText(summary)}`),
    location ? fold(`LOCATION:${escapeText(location)}`) : null,
    description ? fold(`DESCRIPTION:${escapeText(description)}`) : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="racketbuddy-${booking.id.slice(-6)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
