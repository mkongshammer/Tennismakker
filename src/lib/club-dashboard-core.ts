// Pure computations behind the club admin home. No database here, so every
// number on the dashboard can be checked in a unit test.
import { dayKey, wallTime, addCalendarDays, wallParts } from "./international";

export type DashboardBooking = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  priceKr: number;
  courtId: string | null;
  courtName: string;
  userName: string;
  needsClubEntry: boolean;
  clubEnteredAt: Date | null;
};

export type DashboardPayment = { amountKr: number; platformFee: number; createdAt: Date; currency: string };

export type DayStat = { key: string; label: string; bookings: number; hours: number; revenueKr: number };

export type DashboardClub = {
  openHour: number;
  closeHour: number;
  timeZone: string;
  courtCount: number;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  subscriptionActive: boolean;
  status: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  tagline: string | null;
  about: string | null;
  integrationType: string;
  lastSyncError: string | null;
  guestRuleCount: number;
  releasedSlotCount: number;
  signupManaged: boolean;
};

export type DashboardTask = { id: string; tone: "danger" | "warning" | "info"; title: string; body: string; href: string; cta: string };

const hoursBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 3600000);

/** Bookings per venue day for the last `days` days, newest last. */
export function dailyStats(bookings: DashboardBooking[], timeZone: string, now: Date, days = 14): DayStat[] {
  const today = dayKey(now, timeZone);
  const out: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = addCalendarDays(today, -i);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(wallTime(key, 12, 0, timeZone)!);
    out.push({ key, label: weekday, bookings: 0, hours: 0, revenueKr: 0 });
  }
  const byKey = new Map(out.map((d) => [d.key, d]));
  for (const b of bookings) {
    if (b.status !== "CONFIRMED") continue;
    const stat = byKey.get(dayKey(b.startsAt, timeZone));
    if (!stat) continue;
    stat.bookings += 1;
    stat.hours += hoursBetween(b.startsAt, b.endsAt);
    stat.revenueKr += b.priceKr;
  }
  return out;
}

/** Share of bookable court-hours that are booked over a window of days. */
export function utilization(bookedHours: number, club: Pick<DashboardClub, "openHour" | "closeHour" | "courtCount">, days: number) {
  const capacity = Math.max(0, club.closeHour - club.openHour) * club.courtCount * days;
  if (capacity === 0) return 0;
  return Math.min(1, bookedHours / capacity);
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** The hours of today, in venue time, that are already behind us. */
export function hoursElapsedToday(club: Pick<DashboardClub, "openHour" | "closeHour" | "timeZone">, now: Date) {
  const parts = wallParts(now, club.timeZone);
  const elapsed = parts.hour + parts.minute / 60 - club.openHour;
  return Math.max(0, Math.min(club.closeHour - club.openHour, elapsed));
}

/**
 * What a manager should act on, in order of consequence. Every task maps to
 * a real condition in the data and a real place in the admin to fix it.
 */
export function dashboardTasks(club: DashboardClub, upcoming: DashboardBooking[], stripeConfigured: boolean): DashboardTask[] {
  const tasks: DashboardTask[] = [];
  if (club.status !== "APPROVED") {
    tasks.push({ id: "approval", tone: "info", title: "Your club is not public yet", body: club.signupManaged ? "Once your subscription payment is confirmed we review the club and switch it on." : "RacketBuddy reviews new clubs before they appear in search.", href: "/club-start", cta: "Check status" });
  }
  if (stripeConfigured && !club.stripeChargesEnabled) {
    tasks.push({ id: "payouts", tone: "danger", title: "Guests can’t pay you yet", body: "Connect your Stripe account so bookings can be paid and paid out to the club. About ten minutes.", href: "/admin/betaling", cta: "Set up payouts" });
  }
  if (!club.subscriptionActive && club.signupManaged) {
    tasks.push({ id: "subscription", tone: "danger", title: "Subscription is not active", body: "New times can’t be released until the club subscription is active.", href: "/admin/betaling", cta: "Fix billing" });
  }
  if (club.courtCount === 0) {
    tasks.push({ id: "courts", tone: "danger", title: "Add your courts", body: "There is nothing to book until the club has at least one court.", href: "/admin/baner", cta: "Add courts" });
  }
  const toEnter = upcoming.filter((b) => b.needsClubEntry && !b.clubEnteredAt).length;
  if (toEnter > 0) {
    tasks.push({ id: "enter", tone: "warning", title: `${toEnter} paid ${toEnter === 1 ? "booking needs" : "bookings need"} to go into your own system`, body: "Guests have paid here. Enter the times in your booking system so the court isn’t double-booked.", href: "/admin/bookinger", cta: "See bookings" });
  }
  if (club.lastSyncError) {
    tasks.push({ id: "sync", tone: "warning", title: "Calendar sync is failing", body: club.lastSyncError, href: "/admin/integrationer", cta: "Check integration" });
  }
  if (club.integrationType === "MANUAL" && club.guestRuleCount === 0 && club.releasedSlotCount === 0) {
    tasks.push({ id: "release", tone: "warning", title: "No times released to guests", body: "Guests only see the times you release. Add a weekly rule or release single times.", href: "/admin/tider", cta: "Release times" });
  }
  if (club.address && club.latitude == null) {
    tasks.push({ id: "map", tone: "info", title: "Not on the map yet", body: "We couldn’t place your address. Check the street, city, state and ZIP so players can find you by distance.", href: "/admin/hjemmeside", cta: "Check address" });
  }
  if (!club.tagline && !club.about) {
    tasks.push({ id: "profile", tone: "info", title: "Tell players about the club", body: "A one-line tagline and a short description make your listing stand out in search.", href: "/admin/hjemmeside", cta: "Edit club page" });
  }
  return tasks;
}
