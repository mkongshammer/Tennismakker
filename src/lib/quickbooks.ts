// QuickBooks Online: the club connects once with OAuth; after that every
// day's revenue is posted as one balanced journal entry.
//
//   Debit  RacketBuddy clearing      net card money (Stripe pays this out)
//   Debit  RacketBuddy fees          the platform fee
//   Debit  Cash on hand              cash taken at the desk
//   Debit  Card terminal clearing    cards taken on the club's own reader
//   Credit Court bookings / Memberships / ... one income account per category
//
// Accounts are looked up by name and created if missing, so a fresh
// QuickBooks company works without setup. Postings are unique per day, so
// running twice never doubles the books.
import crypto from "node:crypto";
import { db } from "./db";
import { seal, open } from "./crypto-box";
import { settingsSnapshot } from "./settings";
import { revenueLines, CATEGORIES, type RevenueLine } from "./reports";
import { dayKey, wallTime } from "./international";

const SCOPE = "com.intuit.quickbooks.accounting";

// INTUIT_ENVIRONMENT=production talks to live QuickBooks; anything else is the
// sandbox. The *_URL overrides exist for the local test double and are ignored
// in production.
const env = () => {
  const production = (process.env.INTUIT_ENVIRONMENT ?? "sandbox") === "production";
  const override = (name: string, fallback: string) => (production ? fallback : process.env[name] || fallback);
  return {
    id: process.env.INTUIT_CLIENT_ID ?? "", secret: process.env.INTUIT_CLIENT_SECRET ?? "", production,
    tokenUrl: override("INTUIT_TOKEN_URL", "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"),
    revokeUrl: override("INTUIT_REVOKE_URL", "https://developer.api.intuit.com/v2/oauth2/tokens/revoke"),
    authUrl: override("INTUIT_AUTH_URL", "https://appcenter.intuit.com/connect/oauth2"),
    apiBase: production ? "https://quickbooks.api.intuit.com" : process.env.INTUIT_API_BASE || "https://sandbox-quickbooks.api.intuit.com",
  };
};
export const quickBooksConfigured = () => Boolean(env().id && env().secret);
const apiBase = () => env().apiBase;
export const redirectUri = () => `${settingsSnapshot().appUrl}/api/quickbooks/callback`;

// ---------- OAuth ----------

// Intuit publishes its OAuth endpoints in a discovery document. We read it
// (cached for a day) and fall back to the well-known addresses if it is
// unreachable, so a moved endpoint never takes the integration down.
const DISCOVERY = { production: "https://developer.api.intuit.com/.well-known/openid_configuration", sandbox: "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration" };
let discovered: { at: number; authorization_endpoint?: string; token_endpoint?: string; revocation_endpoint?: string } | null = null;
async function endpoints() {
  const e = env();
  if (process.env.INTUIT_TOKEN_URL && !e.production) return { auth: e.authUrl, token: e.tokenUrl, revoke: e.revokeUrl }; // the local test double
  if (!discovered || Date.now() - discovered.at > 86_400_000) {
    try {
      const res = await fetch(DISCOVERY[e.production ? "production" : "sandbox"], { signal: AbortSignal.timeout(5000) });
      if (res.ok) discovered = { at: Date.now(), ...(await res.json()) };
    } catch { /* keep the fallback */ }
  }
  return { auth: discovered?.authorization_endpoint ?? e.authUrl, token: discovered?.token_endpoint ?? e.tokenUrl, revoke: discovered?.revocation_endpoint ?? e.revokeUrl };
}


const sign = (s: string) => crypto.createHmac("sha256", process.env.AUTH_SECRET ?? "").update(s).digest("base64url");
export async function authorizeUrl(clubId: string) {
  const state = `${clubId}.${Date.now()}`;
  const q = new URLSearchParams({ client_id: env().id, response_type: "code", scope: SCOPE, redirect_uri: redirectUri(), state: `${state}.${sign(state)}` });
  return `${(await endpoints()).auth}?${q}`;
}
export function clubFromState(state: string): string | null {
  const [clubId, ts, sig] = state.split(".");
  if (!clubId || !ts || !sig || sign(`${clubId}.${ts}`) !== sig) return null;
  if (Date.now() - Number(ts) > 30 * 60_000) return null;
  return clubId;
}

export class QuickBooksAuthError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }

async function tokenRequest(body: Record<string, string>) {
  const basic = Buffer.from(`${env().id}:${env().secret}`).toString("base64");
  const res = await fetch((await endpoints()).token, { method: "POST", headers: { Authorization: `Basic ${basic}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; x_refresh_token_expires_in?: number; error?: string; error_description?: string };
  const tid = res.headers.get("intuit_tid");
  if (!res.ok || !json.access_token || !json.refresh_token) {
    console.error("QuickBooks token error", { status: res.status, error: json.error, intuit_tid: tid });
    throw new QuickBooksAuthError(json.error ?? `http_${res.status}`, `QuickBooks token error: ${json.error_description ?? json.error ?? res.status}${tid ? ` (intuit_tid ${tid})` : ""}`);
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token, accessExpiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000), refreshExpiresAt: new Date(Date.now() + (json.x_refresh_token_expires_in ?? 100 * 86_400) * 1000) };
}

/** Finish the OAuth dance: store sealed tokens, read the company name, make sure the accounts exist. */
export async function connectQuickBooks(clubId: string, code: string, realmId: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  const acct = await db.clubAccounting.upsert({
    where: { clubId },
    create: { clubId, realmId, accessToken: seal(t.accessToken), refreshToken: seal(t.refreshToken), accessExpiresAt: t.accessExpiresAt, refreshExpiresAt: t.refreshExpiresAt },
    update: { realmId, accessToken: seal(t.accessToken), refreshToken: seal(t.refreshToken), accessExpiresAt: t.accessExpiresAt, refreshExpiresAt: t.refreshExpiresAt, lastError: null },
  });
  const company = await qbo(acct.id, `companyinfo/${realmId}`).catch(() => null) as { CompanyInfo?: { CompanyName?: string } } | null;
  await ensureAccounts(acct.id);
  await db.clubAccounting.update({ where: { id: acct.id }, data: { companyName: company?.CompanyInfo?.CompanyName ?? null } });
  return acct;
}

export async function disconnectQuickBooks(clubId: string) {
  const acct = await db.clubAccounting.findUnique({ where: { clubId } });
  if (!acct) return;
  const basic = Buffer.from(`${env().id}:${env().secret}`).toString("base64");
  await fetch((await endpoints()).revoke, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" }, body: JSON.stringify({ token: open(acct.refreshToken) }) }).catch(() => {});
  await db.clubAccounting.delete({ where: { id: acct.id } });
}

async function freshAccessToken(accountingId: string) {
  const acct = await db.clubAccounting.findUniqueOrThrow({ where: { id: accountingId } });
  if (acct.accessExpiresAt > new Date()) return { token: open(acct.accessToken), realmId: acct.realmId };
  if (acct.refreshExpiresAt < new Date()) throw Error("The QuickBooks connection has expired. Connect again.");
  let t;
  try {
    t = await tokenRequest({ grant_type: "refresh_token", refresh_token: open(acct.refreshToken) });
  } catch (e) {
    // invalid_grant means the refresh token is dead (revoked in QuickBooks, or
    // rotated elsewhere): mark the connection expired so the club is asked to reconnect.
    if (e instanceof QuickBooksAuthError && /invalid_grant|invalid_token/.test(e.code)) await db.clubAccounting.update({ where: { id: accountingId }, data: { refreshExpiresAt: new Date(0), lastError: "The QuickBooks connection was revoked. Connect again." } });
    throw e;
  }
  await db.clubAccounting.update({ where: { id: accountingId }, data: { accessToken: seal(t.accessToken), refreshToken: seal(t.refreshToken), accessExpiresAt: t.accessExpiresAt, refreshExpiresAt: t.refreshExpiresAt } });
  return { token: t.accessToken, realmId: acct.realmId };
}

/** One call to the accounting API, JSON in and out. */
export async function qbo(accountingId: string, path: string, init?: { method?: string; body?: unknown }) {
  const { token, realmId } = await freshAccessToken(accountingId);
  const url = `${apiBase()}/v3/company/${realmId}/${path}${path.includes("?") ? "&" : "?"}minorversion=75`;
  const res = await fetch(url, { method: init?.method ?? "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, body: init?.body ? JSON.stringify(init.body) : undefined });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // intuit_tid is the request id Intuit support asks for; it goes in the log and the error.
    const tid = res.headers.get("intuit_tid");
    const fault = (json as { Fault?: { Error?: { Message?: string; Detail?: string; code?: string }[] } }).Fault?.Error?.[0];
    console.error("QuickBooks API error", { status: res.status, path: path.split("?")[0], code: fault?.code, message: fault?.Message, detail: fault?.Detail, intuit_tid: tid });
    if (res.status === 401) await db.clubAccounting.update({ where: { id: accountingId }, data: { accessExpiresAt: new Date(0) } }).catch(() => {}); // force a refresh next time
    throw Error(`QuickBooks ${res.status}: ${fault?.Detail ?? fault?.Message ?? "request failed"}${tid ? ` (intuit_tid ${tid})` : ""}`);
  }
  return json;
}

// ---------- Accounts ----------

type AccountRole = "clearing" | "cash" | "deskCard" | "fees" | `income:${RevenueLine["category"]}`;
const ACCOUNT_SPECS: Record<string, { name: string; AccountType: string; AccountSubType: string }> = {
  clearing: { name: "RacketBuddy clearing", AccountType: "Other Current Asset", AccountSubType: "OtherCurrentAssets" },
  cash: { name: "Cash on hand", AccountType: "Bank", AccountSubType: "CashOnHand" },
  deskCard: { name: "Card terminal clearing", AccountType: "Other Current Asset", AccountSubType: "OtherCurrentAssets" },
  fees: { name: "RacketBuddy fees", AccountType: "Expense", AccountSubType: "BankCharges" },
  ...Object.fromEntries(CATEGORIES.map((c) => [`income:${c}`, { name: c, AccountType: "Income", AccountSubType: c === "Pro shop" || c === "Gift cards" ? "SalesOfProductIncome" : "ServiceFeeIncome" }])),
};

/** Look every account up by name, create the ones that don't exist, remember the ids. */
export async function ensureAccounts(accountingId: string) {
  const acct = await db.clubAccounting.findUniqueOrThrow({ where: { id: accountingId } });
  const map = JSON.parse(acct.accountsJson || "{}") as Record<string, string>;
  for (const [role, spec] of Object.entries(ACCOUNT_SPECS)) {
    if (map[role]) continue;
    const q = `select Id, Name from Account where Name = '${spec.name.replace(/'/g, "\\'")}'`;
    const found = (await qbo(accountingId, `query?query=${encodeURIComponent(q)}`)) as { QueryResponse?: { Account?: { Id: string }[] } };
    let id = found.QueryResponse?.Account?.[0]?.Id;
    if (!id) {
      const created = (await qbo(accountingId, "account", { method: "POST", body: { Name: spec.name, AccountType: spec.AccountType, AccountSubType: spec.AccountSubType } })) as { Account?: { Id: string } };
      id = created.Account?.Id;
    }
    if (id) map[role] = id;
  }
  await db.clubAccounting.update({ where: { id: accountingId }, data: { accountsJson: JSON.stringify(map) } });
  return map;
}

// ---------- Posting ----------

export type JournalLine = { account: AccountRole; side: "Debit" | "Credit"; amount: number; description: string };

/** The balanced entry for one day's lines. Pure, so it is tested on its own. */
export function journalFor(allLines: RevenueLine[]): JournalLine[] {
  const out: JournalLine[] = [];
  const lines = allLines.filter((l) => l.method !== "Free" && l.amountKr > 0); // a waived membership moves no money
  const byCategory = new Map<string, number>();
  let cash = 0, desk = 0, stripeGross = 0, fees = 0;
  for (const l of lines) {
    byCategory.set(l.category, (byCategory.get(l.category) ?? 0) + l.amountKr);
    if (l.method === "Cash" || l.method === "Cash/check") cash += l.amountKr;
    else if (l.method === "Card (desk)") desk += l.amountKr;
    else { stripeGross += l.amountKr; fees += l.feeKr; }
  }
  for (const [category, amount] of byCategory) out.push({ account: `income:${category}` as AccountRole, side: "Credit", amount, description: `${category} (${lines.filter((l) => l.category === category).length})` });
  if (cash > 0) out.push({ account: "cash", side: "Debit", amount: cash, description: "Cash at the desk" });
  if (desk > 0) out.push({ account: "deskCard", side: "Debit", amount: desk, description: "Cards on the club's terminal" });
  if (stripeGross - fees > 0) out.push({ account: "clearing", side: "Debit", amount: stripeGross - fees, description: "Card payments through RacketBuddy, net of fees" });
  if (fees > 0) out.push({ account: "fees", side: "Debit", amount: fees, description: "RacketBuddy platform fee" });
  return out;
}

export const balanced = (j: JournalLine[]) => j.filter((l) => l.side === "Debit").reduce((s, l) => s + l.amount, 0) === j.filter((l) => l.side === "Credit").reduce((s, l) => s + l.amount, 0);

/** Post one club-local day. Idempotent: a day already posted is returned as is. */
export async function postDay(accountingId: string, day: string) {
  const acct = await db.clubAccounting.findUniqueOrThrow({ where: { id: accountingId }, include: { club: { select: { id: true, timeZone: true, name: true } } } });
  const existing = await db.accountingPosting.findUnique({ where: { accountingId_day: { accountingId, day } } });
  if (existing && existing.status !== "FAILED") return existing;
  const from = wallTime(day, 0, 0, acct.club.timeZone)!, to = new Date(from.getTime() + 86_400_000);
  const lines = await revenueLines(acct.club.id, from, to, acct.club.timeZone);
  const journal = journalFor(lines);
  const data = { grossCents: lines.reduce((s, l) => s + l.amountKr, 0) * 100, feeCents: lines.reduce((s, l) => s + l.feeKr, 0) * 100, lines: lines.length };
  if (!journal.length) return db.accountingPosting.upsert({ where: { accountingId_day: { accountingId, day } }, create: { accountingId, day, ...data, status: "SKIPPED" }, update: { ...data, status: "SKIPPED", error: null } });
  if (!balanced(journal)) throw Error(`Journal for ${day} does not balance`);
  const map = await ensureAccounts(accountingId);
  try {
    const body = {
      TxnDate: day,
      PrivateNote: `RacketBuddy · ${lines.length} transactions · ${acct.club.name}`,
      Line: journal.map((l) => ({ Amount: l.amount, DetailType: "JournalEntryLineDetail", Description: l.description, JournalEntryLineDetail: { PostingType: l.side, AccountRef: { value: map[l.account] } } })),
    };
    const res = (await qbo(accountingId, "journalentry", { method: "POST", body })) as { JournalEntry?: { Id: string } };
    return await db.accountingPosting.upsert({ where: { accountingId_day: { accountingId, day } }, create: { accountingId, day, ...data, status: "POSTED", externalId: res.JournalEntry?.Id ?? null }, update: { ...data, status: "POSTED", externalId: res.JournalEntry?.Id ?? null, error: null } });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.accountingPosting.upsert({ where: { accountingId_day: { accountingId, day } }, create: { accountingId, day, ...data, status: "FAILED", error }, update: { ...data, status: "FAILED", error } });
    throw e;
  }
}

const nextDay = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

/** Post every unposted day up to yesterday, oldest first. At most 62 days per call. */
export async function postPending(accountingId: string) {
  const acct = await db.clubAccounting.findUniqueOrThrow({ where: { id: accountingId }, include: { club: { select: { timeZone: true } } } });
  const today = dayKey(new Date(), acct.club.timeZone);
  let day = acct.lastPostedDay ? nextDay(acct.lastPostedDay) : dayKey(acct.connectedAt, acct.club.timeZone);
  let posted = 0, skipped = 0;
  try {
    for (let i = 0; i < 62 && day < today; i++, day = nextDay(day)) {
      const r = await postDay(accountingId, day);
      if (r.status === "POSTED") posted++; else skipped++;
      await db.clubAccounting.update({ where: { id: accountingId }, data: { lastPostedDay: day, lastError: null } });
    }
  } catch (e) {
    await db.clubAccounting.update({ where: { id: accountingId }, data: { lastError: e instanceof Error ? e.message : String(e) } });
    return { posted, skipped, error: e instanceof Error ? e.message : String(e) };
  }
  return { posted, skipped, error: null };
}

/** Nightly: every connected club with automatic posting on. */
export async function runQuickBooksPosting() {
  if (!quickBooksConfigured()) return { clubs: 0, posted: 0, failed: 0 };
  const all = await db.clubAccounting.findMany({ where: { autoPost: true }, select: { id: true } });
  let posted = 0, failed = 0;
  for (const a of all) { const r = await postPending(a.id).catch((e) => ({ posted: 0, skipped: 0, error: String(e) })); posted += r.posted; if (r.error) failed++; }
  return { clubs: all.length, posted, failed };
}

/** What the admin page shows. */
export async function accountingStatus(clubId: string) {
  const acct = await db.clubAccounting.findUnique({ where: { clubId }, include: { postings: { orderBy: { day: "desc" }, take: 14 } } });
  if (!acct) return null;
  return { companyName: acct.companyName, realmId: acct.realmId, connectedAt: acct.connectedAt, lastPostedDay: acct.lastPostedDay, autoPost: acct.autoPost, lastError: acct.lastError, expired: acct.refreshExpiresAt < new Date(), sandbox: !env().production,
    postings: acct.postings.map((p) => ({ day: p.day, status: p.status, grossCents: p.grossCents, feeCents: p.feeCents, lines: p.lines, externalId: p.externalId, error: p.error })) };
}
