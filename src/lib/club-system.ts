// Does this club already take bookings online, and with what?
//
// The sales data says the thing that stops a club is not the price: it is that
// they already have a system and don't want to switch ("we are all set", "not
// interested in switching"). A club that still takes bookings on the phone has
// the opposite problem. So we look at each club's own website and sort the
// list in two, and the two groups get a different first e-mail.
//
// detect.ts does the same job for a club that is signing up, but it only knows
// the Danish systems. This is the US side, and it is read-only: we fetch the
// public homepage, and at most one page behind a "book a court" link, because
// most clubs put the booking system behind that button rather than on the
// front page.
//
// The answer is a guess from a public page, never a fact about the club, and
// it is only ever used to pick which e-mail to send.

export type SystemKind = "booking" | "management" | "scheduler" | "municipal" | "calendar";

export type ClubSystem = { key: string; name: string; kind: SystemKind };

type Signature = ClubSystem & { patterns: RegExp[] };

// Order matters: the specific systems are matched before the general ones, so
// a club website built on Wix that books through CourtReserve counts as
// CourtReserve. A pattern must be specific enough that it cannot match a club
// that merely mentions the word — hence hostnames rather than product names.
const SIGNATURES: Signature[] = [
  // Court booking, racket sports
  { key: "courtreserve", name: "CourtReserve", kind: "booking", patterns: [/courtreserve\.com/i, /app\.courtreserve/i] },
  { key: "playbypoint", name: "PlayByPoint", kind: "booking", patterns: [/playbypoint\.com/i] },
  { key: "clubautomation", name: "Club Automation", kind: "booking", patterns: [/clubautomation\.com/i, /\.clubautomation/i] },
  { key: "skedda", name: "Skedda", kind: "booking", patterns: [/skedda\.com/i] },
  { key: "clubspark", name: "ClubSpark", kind: "booking", patterns: [/clubspark\.com/i, /clubspark\.lta/i] },
  { key: "tennisbookings", name: "Tennis Bookings", kind: "booking", patterns: [/tennisbookings\.com/i] },
  { key: "playtomic", name: "Playtomic", kind: "booking", patterns: [/playtomic\.io/i, /playtomic\.com/i] },
  { key: "podplay", name: "Podplay", kind: "booking", patterns: [/podplay\.app/i] },
  { key: "holdmycourt", name: "Hold My Court", kind: "booking", patterns: [/holdmycourt\.com/i] },
  { key: "courtside", name: "Courtsite / CourtSide", kind: "booking", patterns: [/courtsite\.my/i, /getcourtside\.com/i] },
  { key: "pickleplanner", name: "PicklePlanner", kind: "booking", patterns: [/pickleplanner\.com/i] },
  { key: "playtimescheduler", name: "Playtime Scheduler", kind: "booking", patterns: [/playtimescheduler\.com/i] },
  { key: "courtmaster", name: "CourtMaster", kind: "booking", patterns: [/courtmastersoftware\.com/i] },

  // Club and facility management
  { key: "jonas", name: "Jonas Club Software / ClubHouse Online", kind: "management", patterns: [/clubhouseonline-e3\.com/i, /jonasclub\.com/i, /clubhouseonline\.com/i] },
  { key: "clubessential", name: "Clubessential", kind: "management", patterns: [/clubessential\.com/i, /cepreview\.com/i] },
  { key: "foretees", name: "ForeTees", kind: "management", patterns: [/foretees\.com/i] },
  { key: "northstar", name: "Northstar Club Management", kind: "management", patterns: [/globalnorthstar\.com/i] },
  { key: "clubready", name: "ClubReady", kind: "management", patterns: [/clubready\.com/i] },
  { key: "mindbody", name: "Mindbody", kind: "management", patterns: [/mindbodyonline\.com/i, /mindbody\.io/i] },
  { key: "ezfacility", name: "EZFacility", kind: "management", patterns: [/ezfacility\.com/i, /\.ezfacility/i] },
  { key: "daysmart", name: "DaySmart Recreation", kind: "management", patterns: [/daysmartrecreation\.com/i, /sportsmansoftware\.com/i] },
  { key: "zenplanner", name: "Zen Planner", kind: "management", patterns: [/zenplanner\.com/i] },
  { key: "gymdesk", name: "Gymdesk", kind: "management", patterns: [/gymdesk\.com/i] },
  { key: "omnify", name: "Omnify", kind: "management", patterns: [/getomnify\.com/i, /omnify\.com/i] },
  { key: "amilia", name: "Amilia", kind: "management", patterns: [/amilia\.com/i] },
  { key: "sawyer", name: "Sawyer", kind: "management", patterns: [/hisawyer\.com/i] },
  { key: "leagueapps", name: "LeagueApps", kind: "management", patterns: [/leagueapps\.com/i] },
  { key: "teamsnap", name: "TeamSnap", kind: "management", patterns: [/teamsnap\.com/i] },
  { key: "membersplash", name: "Member Splash", kind: "management", patterns: [/membersplash\.com/i] },
  { key: "clubexpress", name: "ClubExpress", kind: "management", patterns: [/clubexpress\.com/i] },

  // Parks and recreation departments (public courts)
  { key: "activenet", name: "ACTIVE Net", kind: "municipal", patterns: [/anc\.apm\.activecommunities\.com/i, /activecommunities\.com/i, /activenet/i] },
  { key: "rectrac", name: "RecTrac", kind: "municipal", patterns: [/rectrac/i, /vermontsystems\.com/i] },
  { key: "recdesk", name: "RecDesk", kind: "municipal", patterns: [/recdesk\.com/i] },
  { key: "civicrec", name: "CivicRec", kind: "municipal", patterns: [/civicrec\.com/i, /secure\.rec1\.com/i] },
  { key: "myrec", name: "MyRec", kind: "municipal", patterns: [/myrec\.com/i] },
  { key: "communitypass", name: "Community Pass", kind: "municipal", patterns: [/communitypass\.net/i] },

  // General schedulers: a real online booking, but a thin one
  { key: "acuity", name: "Acuity Scheduling", kind: "scheduler", patterns: [/acuityscheduling\.com/i, /squarespacescheduling\.com/i] },
  { key: "calendly", name: "Calendly", kind: "scheduler", patterns: [/calendly\.com/i] },
  { key: "bookeo", name: "Bookeo", kind: "scheduler", patterns: [/bookeo\.com/i] },
  { key: "setmore", name: "Setmore", kind: "scheduler", patterns: [/setmore\.com/i] },
  { key: "simplybook", name: "SimplyBook.me", kind: "scheduler", patterns: [/simplybook\.(me|it)/i] },
  { key: "square", name: "Square Appointments", kind: "scheduler", patterns: [/squareup\.com\/appointments/i, /book\.squareup\.com/i] },
  { key: "wixbookings", name: "Wix Bookings", kind: "scheduler", patterns: [/wixapps\.net\/_api\/bookings/i, /bookings-viewer/i] },
  { key: "signupgenius", name: "SignUpGenius", kind: "scheduler", patterns: [/signupgenius\.com/i] },
  { key: "eventbrite", name: "Eventbrite", kind: "scheduler", patterns: [/eventbrite\.com/i] },

  // A calendar is not a booking system: these clubs still take the booking by
  // hand. Kept apart so we can decide later whether to treat them as "none".
  { key: "calendar", name: "A calendar only", kind: "calendar", patterns: [/calendar\.google\.com\/calendar\/embed/i, /\.ics\b/i, /webcal:/i, /teamup\.com/i] },
];

/** Pure: which system a page's HTML gives away, or null. First match wins. */
export function classifyBookingSystem(html: string): ClubSystem | null {
  const text = String(html ?? "");
  if (!text) return null;
  for (const s of SIGNATURES) {
    if (s.patterns.some((p) => p.test(text))) return { key: s.key, name: s.name, kind: s.kind };
  }
  return null;
}

/** Pure: the one link on a club's homepage most likely to lead to its booking. */
export function bookingLink(html: string, base: string): string | null {
  const text = String(html ?? "");
  // Anchor text or href that reads like booking a court. The href comes first
  // so a button whose label is an image still matches.
  const re = /<a\b[^>]*href=["']([^"'#]{3,300})["'][^>]*>([\s\S]{0,120}?)<\/a>/gi;
  const wanted = /book|reserve|reservation|court\s*time|schedule|sign[-\s]?up|member\s*login|portal/i;
  const unwanted = /lesson|coach|camp|clinic|party|event|newsletter|donate|instagram|facebook|\.pdf$|\.jpg$|\.png$|mailto:|tel:/i;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const candidates: { url: string; score: number }[] = [];
  while ((m = re.exec(text))) {
    const href = m[1].trim();
    const label = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (unwanted.test(href) || unwanted.test(label)) continue;
    if (!wanted.test(href) && !wanted.test(label)) continue;
    let url: string;
    try { url = new URL(href, base).toString(); } catch { continue; }
    if (!/^https?:/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    // An off-site link is worth following first: it is usually the system itself.
    let score = 0;
    try { score += new URL(url).host.replace(/^www\./, "") === new URL(base).host.replace(/^www\./, "") ? 0 : 2; } catch { /* keep 0 */ }
    if (/book|reserv/i.test(label)) score += 1;
    candidates.push({ url, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? null;
}

export type SystemDetection = {
  /** A system key, "none" when the site shows no online booking, or "unknown" when we couldn't look. */
  system: string;
  name?: string;
  kind?: SystemKind;
  /** Where we found it. */
  via?: "home" | "link";
  error?: string;
};

const get = async (url: string) => {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "RacketBuddyBot/1.0 (+https://racketbuddy.app)", accept: "text/html,*/*" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`http-${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type && !/html|text/i.test(type)) throw new Error("not-html");
  // A club homepage is small; a big one is cut off rather than pulled in whole.
  return (await res.text()).slice(0, 600_000);
};

/**
 * Looks at a club's public website and guesses whether it already books online.
 * Never throws: a site we cannot reach comes back as "unknown", not as "none",
 * so a club is never put in the no-system group because its server was down.
 */
export async function detectClubSystem(website: string, fetchPage: (url: string) => Promise<string> = get): Promise<SystemDetection> {
  const raw = String(website ?? "").trim();
  if (!raw) return { system: "unknown", error: "no-website" };
  let url: string;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString(); }
  catch { return { system: "unknown", error: "bad-url" }; }

  let home: string;
  try { home = await fetchPage(url); }
  catch (e) { return { system: "unknown", error: e instanceof Error ? e.message : String(e) }; }

  const found = (s: ClubSystem, via: "home" | "link"): SystemDetection => ({ system: s.key, name: s.name, kind: s.kind, via });

  const onHome = classifyBookingSystem(home);
  if (onHome && onHome.kind !== "calendar") return found(onHome, "home");

  // Nothing on the front page: most clubs hide the system behind one button.
  const next = bookingLink(home, url);
  if (next) {
    try {
      const page = await fetchPage(next);
      const behind = classifyBookingSystem(page) ?? classifyBookingSystem(next);
      if (behind) return found(behind, "link");
    } catch { /* the homepage is the answer then */ }
  }
  if (onHome) return found(onHome, "home"); // a calendar and nothing more
  return { system: "none" };
}

/** True for the clubs that get the new first e-mail: nothing online, or a calendar only. */
export function takesBookingsByHand(system: string | undefined) {
  return system === "none" || system === "calendar";
}
