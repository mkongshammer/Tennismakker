import crypto from "node:crypto";
import net from "node:net";
import { db } from "./db";
import { getAgentConfig } from "./agent-config";
import { getSettings } from "./settings";
import { salesReadiness } from "./sales-readiness";
import { clubSignupPriceBook } from "./club-onboarding";
import { deploymentRegion } from "./region";

const LAST_REPORT_KEY = "sales:autopilot:last-report:v1";

type Prospect = {
  clubName: string;
  sport: string;
  city: string;
  state: string;
  website: string;
  contactEmail: string;
  sourceUrl: string;
  hook: string;
};

export type SalesAutopilotReport = {
  at: string;
  ran: boolean;
  reason?: string;
  market: "US";
  discovered: number;
  verified: number;
  sent: number;
  failed: number;
  skipped: number;
  sentTo: Array<{ clubName: string; website: string; at: string }>;
  detail?: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

function responseText(response: OpenAIResponse) {
  if (response.output_text?.trim()) return response.output_text.trim();
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) if (part.text?.trim()) return part.text.trim();
  }
  return "";
}

async function openAI(apiKey: string, body: Record<string, unknown>): Promise<OpenAIResponse> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json() as OpenAIResponse;
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI returned ${response.status}.`);
  return payload;
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizeHost(raw: string) {
  try { return new URL(raw).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function privateIpv4(host: string) {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

function safePublicUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    const ip = net.isIP(host);
    if (ip === 4 && privateIpv4(host)) return false;
    if (ip === 6 && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80"))) return false;
    return true;
  } catch { return false; }
}

function officialSource(prospect: Prospect) {
  const site = normalizeHost(prospect.website);
  const source = normalizeHost(prospect.sourceUrl);
  return Boolean(site && source && (site === source || source.endsWith(`.${site}`) || site.endsWith(`.${source}`)));
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function verifyEmailPublished(prospect: Prospect) {
  if (!safePublicUrl(prospect.sourceUrl) || !safePublicUrl(prospect.website) || !officialSource(prospect)) return false;
  try {
    const response = await fetch(prospect.sourceUrl, {
      redirect: "follow",
      headers: { "user-agent": "RacketBuddy-SalesResearch/1.0 (+https://racketbuddy.app)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok || !safePublicUrl(response.url)) return false;
    const finalHost = normalizeHost(response.url);
    const siteHost = normalizeHost(prospect.website);
    if (!(finalHost === siteHost || finalHost.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${finalHost}`))) return false;
    const length = Number(response.headers.get("content-length") || "0");
    if (length > 2_000_000) return false;
    const html = (await response.text()).slice(0, 750_000).toLowerCase();
    return html.includes(prospect.contactEmail.toLowerCase());
  } catch { return false; }
}

function easternSchedule(now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  return {
    weekday: parts.weekday,
    hour,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    inWindow: !["Sat", "Sun"].includes(parts.weekday) && hour >= 9 && hour <= 16,
  };
}

async function discoverProspects(apiKey: string, model: string, wanted: number): Promise<Prospect[]> {
  const schema = {
    type: "object",
    properties: {
      prospects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            clubName: { type: "string" },
            sport: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            website: { type: "string" },
            contactEmail: { type: "string" },
            sourceUrl: { type: "string" },
            hook: { type: "string" },
          },
          required: ["clubName", "sport", "city", "state", "website", "contactEmail", "sourceUrl", "hook"],
          additionalProperties: false,
        },
      },
    },
    required: ["prospects"],
    additionalProperties: false,
  };

  const response = await openAI(apiKey, {
    model,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    text: { format: { type: "json_schema", name: "racketbuddy_club_prospects", strict: true, schema } },
    max_output_tokens: 5000,
    input: `Use live web search to find ${wanted} US racket-sports clubs that are plausible customers for RacketBuddy, a court-booking and club-management platform. Target independent/community tennis, padel, pickleball, badminton or multi-racquet clubs. Prefer clubs with multiple courts, memberships, lessons, guest bookings or an existing booking workflow. Avoid schools, government departments, giant national chains, software vendors and clubs already clearly using RacketBuddy.\n\nFor every prospect, use ONLY a public business contact email visibly published on that club's own official website. Never infer an email pattern, never use a private/personal email found on a people-search site, and never use a directory as the source. website must be the official club website. sourceUrl must be the exact page on that same official website where the email is published. hook must be one short factual sentence based on the official site that makes the outreach relevant. If you cannot verify these fields, omit that club. Return structured JSON only.`,
  });

  const parsed = JSON.parse(responseText(response) || "{}") as { prospects?: Prospect[] };
  return Array.isArray(parsed.prospects) ? parsed.prospects : [];
}

async function alreadyContacted(prospect: Prospect) {
  const emailKey = `sales:sent:email:${hash(prospect.contactEmail)}`;
  const websiteKey = `sales:sent:website:${hash(normalizeHost(prospect.website))}`;
  const suppressedKey = `sales:suppressed:${hash(prospect.contactEmail)}`;
  const rows = await Promise.all([
    db.platformSetting.findUnique({ where: { key: emailKey } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: websiteKey } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: suppressedKey } }).catch(() => null),
  ]);
  return rows.some(Boolean);
}

async function createUnsubscribe(prospect: Prospect, appUrl: string) {
  const token = crypto.randomBytes(24).toString("base64url");
  const key = `sales:unsubscribe:${token}`;
  await db.platformSetting.create({
    data: { key, value: JSON.stringify({ email: prospect.contactEmail, website: prospect.website, createdAt: new Date().toISOString() }) },
  });
  return `${appUrl}/sales/unsubscribe?token=${encodeURIComponent(token)}`;
}

async function sendSalesMail(input: { to: string; replyTo: string; subject: string; body: string }) {
  const settings = await getSettings();
  if (!settings.emailApiKey) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${settings.emailApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: settings.emailFrom, to: [input.to], reply_to: input.replyTo, subject: input.subject, text: input.body }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.error("Sales email rejected:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Sales email failed:", error);
    return false;
  }
}

async function markSent(prospect: Prospect, at: Date) {
  const record = JSON.stringify({
    clubName: prospect.clubName,
    website: prospect.website,
    email: prospect.contactEmail,
    sourceUrl: prospect.sourceUrl,
    sentAt: at.toISOString(),
  });
  await db.$transaction([
    db.platformSetting.upsert({ where: { key: `sales:sent:email:${hash(prospect.contactEmail)}` }, create: { key: `sales:sent:email:${hash(prospect.contactEmail)}`, value: record }, update: { value: record } }),
    db.platformSetting.upsert({ where: { key: `sales:sent:website:${hash(normalizeHost(prospect.website))}` }, create: { key: `sales:sent:website:${hash(normalizeHost(prospect.website))}`, value: record }, update: { value: record } }),
  ]);
}

async function saveReport(report: SalesAutopilotReport) {
  await db.platformSetting.upsert({
    where: { key: LAST_REPORT_KEY },
    create: { key: LAST_REPORT_KEY, value: JSON.stringify(report) },
    update: { value: JSON.stringify(report) },
  });
  return report;
}

export async function getSalesAutopilotStatus(): Promise<SalesAutopilotReport | null> {
  const row = await db.platformSetting.findUnique({ where: { key: LAST_REPORT_KEY } }).catch(() => null);
  if (!row) return null;
  try { return JSON.parse(row.value) as SalesAutopilotReport; } catch { return null; }
}

export async function runSalesAutopilot(now = new Date(), options?: { force?: boolean }) {
  const base: SalesAutopilotReport = {
    at: now.toISOString(), ran: false, market: "US", discovered: 0, verified: 0, sent: 0, failed: 0, skipped: 0, sentTo: [],
  };
  const config = await getAgentConfig();
  if (deploymentRegion() === "US") return saveReport({ ...base, reason: "primary-region-only", detail: "Sales outreach runs only from the primary EU service to prevent duplicate sends." });
  if (!config.enabled || !config.apiKeySet || !config.salesEnabled) return saveReport({ ...base, reason: "disabled-or-unconfigured" });

  const settings = await getSettings();
  if (!settings.emailApiKey) return saveReport({ ...base, reason: "email-unconfigured", detail: "Configure the production email provider before autonomous sales can send." });
  if (!settings.ordersEmail) return saveReport({ ...base, reason: "reply-email-missing", detail: "Set the sales/support reply email in Platform settings before autonomous sales can send." });
  if (config.salesPostalAddress.trim().length < 8) return saveReport({ ...base, reason: "postal-address-missing", detail: "Add RacketBuddy's valid business postal address in AI Agents before commercial outreach can send." });

  const schedule = easternSchedule(now);
  if (!options?.force && !schedule.inWindow) return { ...base, reason: "outside-us-business-hours" };
  const dayKey = `sales:autopilot:day:${schedule.date}`;
  if (!options?.force) {
    try {
      await db.platformSetting.create({ data: { key: dayKey, value: now.toISOString() } });
    } catch {
      return { ...base, reason: "already-ran-today" };
    }
  }

  const readiness = await salesReadiness();
  const blocked = readiness.filter((check) => check.status === "blocked");
  if (blocked.length) return saveReport({
    ...base,
    ran: true,
    reason: "sales-readiness-blocked",
    detail: blocked.map((check) => `${check.name}: ${check.detail}`).join(" | ").slice(0, 3000),
  });

  const prices = await clubSignupPriceBook();
  const limit = Math.max(1, Math.min(10, config.salesDailyLimit));
  let prospects: Prospect[] = [];
  try {
    prospects = await discoverProspects(config.apiKey, config.smartModel, Math.max(12, limit * 4));
  } catch (error) {
    return saveReport({ ...base, ran: true, reason: "discovery-failed", detail: error instanceof Error ? error.message : String(error) });
  }

  base.ran = true;
  base.discovered = prospects.length;
  const seen = new Set<string>();

  for (const raw of prospects) {
    if (base.sent >= limit) break;
    const prospect: Prospect = {
      clubName: String(raw.clubName || "").trim(), sport: String(raw.sport || "").trim(), city: String(raw.city || "").trim(),
      state: String(raw.state || "").trim(), website: String(raw.website || "").trim(), contactEmail: String(raw.contactEmail || "").trim().toLowerCase(),
      sourceUrl: String(raw.sourceUrl || "").trim(), hook: String(raw.hook || "").replace(/\s+/g, " ").trim().slice(0, 260),
    };
    const unique = `${prospect.contactEmail}|${normalizeHost(prospect.website)}`;
    if (!prospect.clubName || !validEmail(prospect.contactEmail) || !prospect.hook || seen.has(unique)) { base.skipped++; continue; }
    seen.add(unique);
    if (await alreadyContacted(prospect)) { base.skipped++; continue; }
    if (!(await verifyEmailPublished(prospect))) { base.skipped++; continue; }
    base.verified++;

    const unsubscribe = await createUnsubscribe(prospect, settings.appUrl);
    const customLine = prices.USD.custom ? ` Custom club-specific setup is available when a club needs integrations or tailored features.` : "";
    const body = [
      `Hi ${prospect.clubName} team,`,
      "",
      prospect.hook,
      "",
      `I’m reaching out from RacketBuddy. We give racket-sports clubs one simple platform for court booking, members, coaches, guest payments and day-to-day club administration. Standard is $${prices.USD.standard}/month for US clubs.${customLine}`,
      "",
      `You can see RacketBuddy here: ${settings.appUrl}`,
      "",
      "If it looks useful for your club, reply to this email and we can get you set up without a sales call.",
      "",
      "Best,",
      "RacketBuddy",
      "",
      "This is a commercial email from RacketBuddy.",
      config.salesPostalAddress,
      `Unsubscribe: ${unsubscribe}`,
    ].join("\n");
    const subject = `A simpler booking setup for ${prospect.clubName}`.slice(0, 140);

    const sent = await sendSalesMail({ to: prospect.contactEmail, replyTo: settings.ordersEmail, subject, body });
    if (!sent) { base.failed++; continue; }
    await markSent(prospect, now);
    base.sent++;
    base.sentTo.push({ clubName: prospect.clubName, website: prospect.website, at: now.toISOString() });
  }

  return saveReport({
    ...base,
    detail: base.sent
      ? `Sent ${base.sent} verified first-touch email${base.sent === 1 ? "" : "s"}. No automatic follow-up is sent until reply detection is connected.`
      : "No eligible, publicly verified club contact passed all checks in this run.",
  });
}
