import { db } from "./db";
import { salesReadiness } from "./sales-readiness";

export type AgentToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: true;
};

const noArgs = { type: "object", properties: {}, required: [], additionalProperties: false };

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    type: "function",
    name: "platform_snapshot",
    description: "Read a compact operational snapshot of RacketBuddy users, clubs and bookings. Read-only.",
    parameters: noArgs,
    strict: true,
  },
  {
    type: "function",
    name: "onboarding_pipeline",
    description: "Read the current club onboarding and subscription pipeline, including blocked or pending clubs. Read-only.",
    parameters: noArgs,
    strict: true,
  },
  {
    type: "function",
    name: "integration_health",
    description: "Read health information for clubs using browser automation or external booking integrations. Read-only.",
    parameters: noArgs,
    strict: true,
  },
  {
    type: "function",
    name: "club_control_health",
    description: "Read health information for enabled Shelly light/door controls. Never operates physical hardware. Read-only.",
    parameters: noArgs,
    strict: true,
  },
  {
    type: "function",
    name: "support_queue",
    description: "Read recent club support tickets stored by RacketBuddy. Read-only.",
    parameters: noArgs,
    strict: true,
  },
  {
    type: "function",
    name: "sales_readiness",
    description: "Run the existing read-only international sales readiness checks for pricing, Stripe, tax, portal and terms.",
    parameters: noArgs,
    strict: true,
  },
  {
    type: "function",
    name: "club_lookup",
    description: "Look up a club by exact id or partial name/slug and return operational fields. Read-only.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Club id, name or slug." } },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
];

async function platformSnapshot() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [users, approvedClubs, pendingClubs, suspendedClubs, bookings7d, confirmed7d, coaches] = await Promise.all([
    db.user.count(),
    db.club.count({ where: { status: "APPROVED" } }),
    db.club.count({ where: { status: "PENDING" } }),
    db.club.count({ where: { status: "SUSPENDED" } }),
    db.booking.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.booking.count({ where: { createdAt: { gte: sevenDaysAgo }, status: "CONFIRMED" } }),
    db.coachProfile.count(),
  ]);
  return { at: now.toISOString(), users, coaches, clubs: { approved: approvedClubs, pending: pendingClubs, suspended: suspendedClubs }, bookingsLast7Days: { total: bookings7d, confirmed: confirmed7d } };
}

async function onboardingPipeline() {
  return db.club.findMany({
    where: { OR: [{ signupManaged: true }, { status: { in: ["PENDING", "SUSPENDED"] } }] },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      name: true,
      country: true,
      status: true,
      solutionMode: true,
      signupManaged: true,
      signupPaidAt: true,
      subscriptionStatus: true,
      subscriptionRenewsAt: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      integrationType: true,
      lastSyncAt: true,
      lastSyncError: true,
      createdAt: true,
    },
  });
}

async function integrationHealth() {
  const [logins, syncProblems] = await Promise.all([
    db.clubSystemLogin.findMany({
      take: 50,
      select: { clubId: true, baseUrl: true, lastTriedAt: true, lastOkAt: true, lastError: true },
    }),
    db.club.findMany({
      where: { integrationType: { not: "NATIVE" } },
      take: 50,
      select: { id: true, name: true, integrationType: true, externalSystem: true, lastSyncAt: true, lastSyncError: true },
    }),
  ]);
  const ids = [...new Set(logins.map((row) => row.clubId))];
  const clubs = ids.length ? await db.club.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(clubs.map((c) => [c.id, c.name]));
  return {
    browserAutomation: logins.map((row) => ({ ...row, clubName: names.get(row.clubId) ?? row.clubId })),
    externalIntegrations: syncProblems,
  };
}

async function clubControlHealth() {
  const controls = await db.clubControl.findMany({
    where: { enabled: true },
    take: 50,
    select: { clubId: true, lastCheckedAt: true, lastError: true, enabled: true },
  });
  const ids = controls.map((row) => row.clubId);
  const clubs = ids.length ? await db.club.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(clubs.map((c) => [c.id, c.name]));
  return controls.map((row) => ({ ...row, clubName: names.get(row.clubId) ?? row.clubId }));
}

async function supportQueue() {
  const rows = await db.platformSetting.findMany({
    where: { key: { startsWith: "clubSupportTicket:" } },
    take: 40,
    orderBy: { key: "desc" },
    select: { key: true, value: true },
  });
  return rows.map((row) => {
    try {
      const ticket = JSON.parse(row.value);
      return {
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        priority: ticket.priority,
        type: ticket.typeLabel ?? ticket.type,
        subject: ticket.subject,
        clubName: ticket.clubName,
        page: ticket.page,
        createdAt: ticket.createdAt,
      };
    } catch {
      return { key: row.key, error: "Ticket could not be parsed." };
    }
  });
}

async function clubLookup(query: string) {
  const q = query.trim();
  if (!q) return [];
  return db.club.findMany({
    where: {
      OR: [
        { id: q },
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 10,
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      country: true,
      status: true,
      solutionMode: true,
      integrationType: true,
      externalSystem: true,
      lastSyncAt: true,
      lastSyncError: true,
      subscriptionStatus: true,
      subscriptionRenewsAt: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      domainStatus: true,
      customDomain: true,
      createdAt: true,
    },
  });
}

export async function executeAgentTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "platform_snapshot": return platformSnapshot();
    case "onboarding_pipeline": return onboardingPipeline();
    case "integration_health": return integrationHealth();
    case "club_control_health": return clubControlHealth();
    case "support_queue": return supportQueue();
    case "sales_readiness": return salesReadiness();
    case "club_lookup": return clubLookup(String(args.query ?? ""));
    default: throw new Error(`Unknown agent tool: ${name}`);
  }
}
