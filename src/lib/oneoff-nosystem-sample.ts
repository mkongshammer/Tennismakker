// One-off (17 Nov 2026): is the "no online booking" group actually that?
//
// The campaign now writes to 882 clubs we decided take bookings by hand. That
// decision comes from reading a public homepage, and there is one way it can
// be wrong that matters: a club whose booking sits behind a member login. We
// never see the system, so the club looks like it has none — and it is
// exactly the kind of club that answers "we are all set".
//
// So rather than ask anyone to open 25 websites, this re-reads a sample and
// reports the one thing that gives it away: does the site have a member
// login or portal? A sample where many do means the group is noisy and the
// reply rate we measure won't mean what we think it means.
import { db } from "./db";

const FLAG = "oneoff:nosystem-sample:2026-11-17";
const SAMPLE = 25;

const LOGIN = /member\s*(login|portal|area|sign[\s-]?in)|my\s*account|club\s*portal|resident\s*login/i;
const BOOKY = /book\s*(a\s*)?(court|time|lesson)|reserve\s*(a\s*)?court|court\s*reservation|make\s*a\s*reservation/i;

/** Pure: what a homepage gives away beyond the systems we can name. */
export function readSignals(html: string) {
  const text = String(html ?? "");
  const anchors = [...text.matchAll(/<a\b[^>]*href=["']([^"']{2,300})["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)]
    .map((m) => ({ href: m[1], label: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }));
  const login = anchors.find((a) => LOGIN.test(a.label) || LOGIN.test(a.href));
  const booky = anchors.find((a) => BOOKY.test(a.label) || BOOKY.test(a.href));
  return {
    hasLogin: Boolean(login),
    loginHref: login?.href,
    hasBookWord: Boolean(booky) || BOOKY.test(text),
    bookHref: booky?.href,
    phoneOnly: /call\s*(us|the\s*(pro\s*shop|front\s*desk|office))|call\s*\(?\d{3}/i.test(text),
  };
}

export async function sampleNoSystemOnce() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } }).catch(() => null)) return { done: true };
  await db.platformSetting.create({ data: { key: FLAG, value: new Date().toISOString() } });
  const { tellOwner } = await import("./founding-offer");
  try {
    const { allLeads } = await import("./lead-harvest");
    const { takesBookingsByHand } = await import("./club-system");
    const rows = (await allLeads("club")).map((r) => r.lead as { clubName: string; website: string; city?: string; state?: string; system?: string });
    const byHand = rows.filter((l) => takesBookingsByHand(l.system) && l.website);
    // Evenly spaced through the list rather than the first 25, so the sample
    // isn't all from one state or one harvest run.
    const step = Math.max(1, Math.floor(byHand.length / SAMPLE));
    const picked = Array.from({ length: Math.min(SAMPLE, byHand.length) }, (_, i) => byHand[i * step]).filter(Boolean);

    const lines: string[] = [];
    let login = 0, bookWord = 0, dead = 0;
    await Promise.all(picked.map(async (l, i) => {
      let note = "";
      try {
        const res = await fetch(/^https?:/i.test(l.website) ? l.website : `https://${l.website}`, {
          redirect: "follow",
          headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", accept: "text/html,*/*" },
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) { dead++; note = `site svarer ${res.status}`; }
        else {
          const s = readSignals((await res.text()).slice(0, 400_000));
          if (s.hasLogin) login++;
          if (s.hasBookWord) bookWord++;
          note = [s.hasLogin ? `HAR MEDLEMSLOGIN (${(s.loginHref ?? "").slice(0, 60)})` : null,
                  s.hasBookWord ? `siger "book/reserve"${s.bookHref ? ` → ${s.bookHref.slice(0, 60)}` : ""}` : null,
                  s.phoneOnly ? "beder folk ringe" : null].filter(Boolean).join(" · ") || "ingen tegn på booking";
        }
      } catch (e) { dead++; note = `kunne ikke hentes: ${e instanceof Error ? e.message : String(e)}`; }
      lines[i] = `${l.clubName} (${l.city ?? "?"}, ${l.state ?? "?"})\n   ${l.website}\n   ${note}`;
    }));

    const n = picked.length;
    const verdict = login / Math.max(1, n) > 0.25
      ? "ADVARSEL: mere end hver fjerde har medlemslogin. De har sandsynligvis et bookingsystem bag login, som vi ikke kan se — gruppen er for urolig til at måle på."
      : login === 0
        ? "Ser rent ud: ingen af dem har medlemslogin."
        : `${login} ud af ${n} har medlemslogin. Det er lavt nok til at tallene kan bruges, men værd at holde øje med.`;

    await tellOwner(
      `RacketBuddy: stikprøve på ${n} klubber uden online booking`,
      [
        `Gruppen er på ${byHand.length} klubber. Her er ${n} af dem, jævnt fordelt ned gennem listen.`,
        "",
        verdict,
        `Tal: medlemslogin ${login}/${n} · nævner "book/reserve" ${bookWord}/${n} · hjemmeside kunne ikke læses ${dead}/${n}`,
        "",
        ...lines.filter(Boolean),
      ].join("\n"),
    ).catch(() => null);
    return { sampled: n, login, bookWord, dead, pool: byHand.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await tellOwner("RacketBuddy: stikprøven fejlede", msg).catch(() => null);
    return { error: msg };
  }
}
