// Loads everything the club admin home shows, from real rows only.
import { db } from "./db";
import { subscriptionIsActive } from "./billing";
import { stripeEnabled } from "./stripe";
import { dayKey, wallTime, addCalendarDays } from "./international";
import { dailyStats, dashboardTasks, hoursElapsedToday, percentChange, utilization, type DashboardBooking, type DashboardClub } from "./club-dashboard-core";

export async function loadClubDashboard(clubId: string, now = new Date()) {
  const club = await db.club.findUniqueOrThrow({
    where: { id: clubId },
    include: { courts: { orderBy: { name: "asc" } }, _count: { select: { members: true, rules: true } } },
  });
  const courtIds = club.courts.map((c) => c.id);
  const today = dayKey(now, club.timeZone);
  const dayStart = wallTime(today, 0, 0, club.timeZone)!;
  const dayEnd = wallTime(addCalendarDays(today, 1), 0, 0, club.timeZone)!;
  const twoWeeksAgo = wallTime(addCalendarDays(today, -13), 0, 0, club.timeZone)!;
  const weekAhead = wallTime(addCalendarDays(today, 8), 0, 0, club.timeZone)!;

  const [recent, upcomingRaw, paymentsRecent, releasedSlotCount, stripeOn] = await Promise.all([
    db.booking.findMany({
      where: { courtId: { in: courtIds }, status: "CONFIRMED", startsAt: { gte: twoWeeksAgo, lt: dayEnd } },
      include: { court: { select: { name: true } }, user: { select: { name: true } } },
    }),
    db.booking.findMany({
      where: { courtId: { in: courtIds }, status: { in: ["CONFIRMED", "HOLD"] }, endsAt: { gte: now }, startsAt: { lt: weekAhead } },
      include: { court: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
      take: 60,
    }),
    db.payment.findMany({ where: { status: "PAID", booking: { courtId: { in: courtIds } }, createdAt: { gte: twoWeeksAgo } }, select: { amountKr: true, platformFee: true, createdAt: true, currency: true } }),
    db.guestSlot.count({ where: { courtId: { in: courtIds }, startsAt: { gte: now } } }),
    stripeEnabled(),
  ]);

  const toDashboard = (b: (typeof recent)[number]): DashboardBooking => ({
    id: b.id, startsAt: b.startsAt, endsAt: b.endsAt, status: b.status, priceKr: b.priceKr, courtId: b.courtId, courtName: b.court?.name ?? "", userName: b.user.name, needsClubEntry: b.needsClubEntry, clubEnteredAt: b.clubEnteredAt,
  });
  const recentBookings = recent.map(toDashboard);
  const upcoming = upcomingRaw.map(toDashboard);
  const todayBookings = upcoming.filter((b) => b.startsAt >= dayStart && b.startsAt < dayEnd && b.status === "CONFIRMED");
  const allToday = recentBookings.filter((b) => b.startsAt >= dayStart && b.startsAt < dayEnd);

  const days = dailyStats(recentBookings, club.timeZone, now, 14);
  const thisWeek = days.slice(7), lastWeek = days.slice(0, 7);
  const sum = (list: typeof days, key: "bookings" | "hours" | "revenueKr") => list.reduce((s, d) => s + d[key], 0);
  const capacity = { openHour: club.openHour, closeHour: club.closeHour, courtCount: club.courts.length };

  const dashboardClub: DashboardClub = {
    openHour: club.openHour, closeHour: club.closeHour, timeZone: club.timeZone, courtCount: club.courts.length,
    stripeChargesEnabled: club.stripeChargesEnabled, stripePayoutsEnabled: club.stripePayoutsEnabled,
    subscriptionActive: subscriptionIsActive(club), status: club.status, latitude: club.latitude, longitude: club.longitude,
    address: club.address, tagline: club.tagline, about: club.about, integrationType: club.integrationType, lastSyncError: club.lastSyncError,
    guestRuleCount: club._count.rules, releasedSlotCount, signupManaged: club.signupManaged,
  };

  const paidThisWeek = paymentsRecent.filter((p) => p.createdAt >= wallTime(addCalendarDays(today, -6), 0, 0, club.timeZone)!);
  const paidLastWeek = paymentsRecent.filter((p) => p.createdAt < wallTime(addCalendarDays(today, -6), 0, 0, club.timeZone)!);
  const net = (list: typeof paymentsRecent) => list.reduce((s, p) => s + p.amountKr - p.platformFee, 0);

  return {
    club,
    today: {
      bookings: allToday.length,
      hours: allToday.reduce((s, b) => s + (b.endsAt.getTime() - b.startsAt.getTime()) / 3600000, 0),
      utilization: utilization(allToday.reduce((s, b) => s + (b.endsAt.getTime() - b.startsAt.getTime()) / 3600000, 0), capacity, 1),
      hoursElapsed: hoursElapsedToday(club, now),
      remaining: todayBookings,
      revenueKr: allToday.reduce((s, b) => s + b.priceKr, 0),
    },
    week: {
      bookings: sum(thisWeek, "bookings"),
      bookingsChange: percentChange(sum(thisWeek, "bookings"), sum(lastWeek, "bookings")),
      utilization: utilization(sum(thisWeek, "hours"), capacity, 7),
      utilizationLastWeek: utilization(sum(lastWeek, "hours"), capacity, 7),
      paidOutKr: net(paidThisWeek),
      paidOutChange: percentChange(net(paidThisWeek), net(paidLastWeek)),
      days: thisWeek,
      trend: days,
    },
    upcoming: upcoming.filter((b) => b.status === "CONFIRMED").slice(0, 8),
    tasks: dashboardTasks(dashboardClub, upcoming, stripeOn),
    members: club._count.members,
    stripeOn,
  };
}

export type ClubDashboard = Awaited<ReturnType<typeof loadClubDashboard>>;
