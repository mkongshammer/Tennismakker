import type { PrismaClient } from "@prisma/client";

// Operator-only deployment input. Never exposed by an HTTP route, and never
// updates an existing user or club. Remove the input after provisioning.
export async function provisionPrivateClub(db: PrismaClient, raw?: string) {
  if (!raw) return "disabled";
  const config = JSON.parse(raw);
  const { email, passwordHash, slug, clubName, adminName, city, expiresAt } = config;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || email !== email.trim().toLowerCase()
    || typeof passwordHash !== "string" || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(passwordHash)
    || typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || ![clubName, adminName, city].every(v => typeof v === "string" && v.trim().length > 0)) {
    throw new Error("Invalid private-club deployment input");
  }
  const deadline = Date.parse(expiresAt);
  if (!Number.isFinite(deadline) || deadline <= Date.now()) return "expired";
  if (deadline > Date.now() + 24 * 60 * 60 * 1000) throw new Error("Provisioning window exceeds 24 hours");
  return db.$transaction(async tx => {
    if (await tx.user.findUnique({ where: { email } })) return "existing-email-unchanged";
    if (await tx.club.findUnique({ where: { slug } })) return "existing-club-unchanged";
    const club = await tx.club.create({ data: {
      slug, name: clubName, city, status: "PENDING", approvedAt: null,
      priceHour: 0, integrationType: "MANUAL", billingModel: "SUBSCRIPTION", country: "DK",
    } });
    await tx.user.create({ data: {
      email, passwordHash, name: adminName, role: "CLUB_ADMIN", clubId: club.id,
      area: city, countryChosen: true,
    } });
    return "created-private-club-and-admin";
  });
}
