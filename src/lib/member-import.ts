// Member lists from any old system: CourtReserve, ClubReady, Club Automation,
// PlayByPoint, Skedda, Mindbody, Excel, Google Sheets. The club uploads the
// export as it is; we find the columns ourselves and show what will move.
// Pure functions only (used on the public import check and in the admin).

export const MAX_ROWS = 5000;
export const MAX_BYTES = 3_000_000;

export type ImportedMember = { email: string; name: string; phone: string; membership: string };
export type ColumnMap = { email: number; name: number; first: number; last: number; phone: number; membership: number };
export type ImportPlan = {
  members: ImportedMember[];
  columns: Record<keyof ColumnMap, string | null>;
  rows: number;
  missingEmail: number;
  invalidEmail: number;
  duplicates: number;
  memberships: { name: string; count: number }[];
};

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;

/** CSV, semicolon or tab separated text into rows of cells. */
export function parseTable(text: string): string[][] {
  if (text.length > MAX_BYTES) throw Error("The file is too large. Split it into files under 3 MB.");
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/, 6).join("\n");
  const counts = { ",": (first.match(/,/g) ?? []).length, ";": (first.match(/;/g) ?? []).length, "\t": (first.match(/\t/g) ?? []).length };
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",") as "," | ";" | "\t";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') { if (quoted && clean[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === sep && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); if (row.some((v) => v.trim())) rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  row.push(cell); if (row.some((v) => v.trim())) rows.push(row);
  return rows.map((r) => r.map((v) => v.trim()));
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const HEADER: Record<keyof ColumnMap, RegExp[]> = {
  email: [/^(primary |member |contact |personal |home |work )?e ?mail( address)?( 1)?$/, /^email$/, /^mail$/, /^login$/, /^username$/],
  name: [/^(full |member |display |contact |player )?name$/, /^player$/, /^customer( name)?$/, /^navn$/],
  first: [/^first( name)?$/, /^firstname$/, /^given name$/, /^fornavn$/],
  last: [/^last( name)?$/, /^lastname$/, /^surname$/, /^family name$/, /^efternavn$/],
  phone: [/^((cell|mobile|home|primary|work|main) )?phone( number)?( 1)?$/, /^(cell|mobile)( phone| number)?$/, /^tel(ephone)?$/, /^telefon$/, /^mobil$/],
  membership: [/^membership( type| level| plan| name)?$/, /^member(ship)? ?type$/, /^plan$/, /^package$/, /^category$/, /^tier$/],
};

/** Find the columns by their headers, and the e-mail column by its content if no header says so. */
export function detectColumns(header: string[], sample: string[][], sniff = true): ColumnMap {
  const map: ColumnMap = { email: -1, name: -1, first: -1, last: -1, phone: -1, membership: -1 };
  const used = new Set<number>();
  for (const key of ["email", "first", "last", "name", "membership", "phone"] as (keyof ColumnMap)[]) {
    const i = header.findIndex((h, idx) => !used.has(idx) && HEADER[key].some((re) => re.test(norm(h))));
    if (i >= 0) { map[key] = i; used.add(i); }
  }
  if (map.email < 0 && sniff) {
    let best = -1, bestHits = 0;
    header.forEach((_, idx) => { if (used.has(idx)) return; const hits = sample.filter((r) => EMAIL.test(r[idx] ?? "")).length; if (hits > bestHits) { best = idx; bestHits = hits; } });
    if (best >= 0 && bestHits >= Math.max(1, Math.ceil(sample.length * 0.3))) map.email = best;
  }
  return map;
}

/** Turn a parsed table into the members we'd create, and say what we skipped and why. */
export function planImport(table: string[][]): ImportPlan {
  if (table.length < 2) throw Error("The file has no rows under the header. Export the member list with a header row.");
  // Some exports start with a title line: use the first row that looks like a header.
  let headerIndex = 0;
  for (let i = 0; i < Math.min(5, table.length - 1); i++) { if (detectColumns(table[i], [], false).email >= 0) { headerIndex = i; break; } }
  const header = table[headerIndex], body = table.slice(headerIndex + 1);
  if (body.length > MAX_ROWS) throw Error(`The file has ${body.length} rows. Import up to ${MAX_ROWS} at a time.`);
  const col = detectColumns(header, body.slice(0, 50));
  if (col.email < 0) throw Error("We couldn't find an e-mail column. Make sure the export includes members' e-mail addresses.");
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const seen = new Set<string>();
  const members: ImportedMember[] = [];
  let missingEmail = 0, invalidEmail = 0, duplicates = 0;
  const tally = new Map<string, number>();
  for (const r of body) {
    const email = get(r, col.email).toLowerCase().replace(/^mailto:/, "");
    if (!email) { missingEmail++; continue; }
    if (!EMAIL.test(email)) { invalidEmail++; continue; }
    if (seen.has(email)) { duplicates++; continue; }
    seen.add(email);
    const name = (get(r, col.name) || [get(r, col.first), get(r, col.last)].filter(Boolean).join(" ") || email.split("@")[0]).slice(0, 150);
    const membership = get(r, col.membership).slice(0, 80);
    if (membership) tally.set(membership, (tally.get(membership) ?? 0) + 1);
    members.push({ email, name, phone: get(r, col.phone).slice(0, 40), membership });
  }
  const label = (i: number) => (i >= 0 ? header[i] : null);
  return {
    members, rows: body.length, missingEmail, invalidEmail, duplicates,
    columns: { email: label(col.email), name: label(col.name), first: label(col.first), last: label(col.last), phone: label(col.phone), membership: label(col.membership) },
    memberships: [...tally.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12),
  };
}

/** How to get the member list out of the systems clubs most often come from. */
export const EXPORT_TIPS: { system: string; steps: string }[] = [
  { system: "CourtReserve", steps: "Open the member list (Members), filter to active members if you like, and use the export button to download it as Excel or CSV." },
  { system: "ClubReady / Club Automation", steps: "Run the member or customer report for active members and export it to Excel or CSV." },
  { system: "PlayByPoint", steps: "In the admin, open your members or customers list and export it to CSV." },
  { system: "Skedda", steps: "Open Users, then export the user list to CSV." },
  { system: "Mindbody", steps: "Run the Client Export (or Active Clients) report and download it as Excel." },
  { system: "Excel or Google Sheets", steps: "Use the file as it is. In Google Sheets choose File → Download → CSV." },
  { system: "Another system", steps: "Look for Export, Download or Reports on the member list. Any list with an e-mail column works; names, phone and membership type are picked up automatically." },
];
