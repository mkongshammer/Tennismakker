// Counts of what lives in this service's database, so the owner can decide
// whether the EU service can be switched off. Counts only, no personal data.
import { internalRequestAuthorized } from "../../../../lib/internal-auth";
import { db } from "../../../../lib/db";
import { deploymentRegion } from "../../../../lib/region";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!internalRequestAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const since = new Date(Date.now() - 90 * 86400_000);
  const now = new Date();
  const [clubs, approvedClubs, payingClubs, users, bookings, recentBookings, futureBookings, connectedStripe] = await Promise.all([
    db.club.count(),
    db.club.count({ where: { status: "APPROVED" } }),
    db.club.count({ where: { subscriptionStatus: { in: ["active", "trialing", "past_due"] } } }),
    db.user.count(),
    db.booking.count(),
    db.booking.count({ where: { startsAt: { gte: since } } }),
    db.booking.count({ where: { startsAt: { gte: now }, status: { not: "CANCELLED" } } }),
    db.club.count({ where: { stripeAccountId: { not: null } } }),
  ]);
  const clubList = await db.club.findMany({ where: { OR: [{ status: "APPROVED" }, { subscriptionStatus: { in: ["active", "trialing", "past_due"] } }] }, select: { name: true, country: true, status: true, subscriptionStatus: true, billingCurrency: true, createdAt: true }, take: 50 });
  return Response.json({ region: deploymentRegion(), clubs, approvedClubs, payingClubs, users, bookings, recentBookings90d: recentBookings, futureBookings, connectedStripe, clubList });
}
