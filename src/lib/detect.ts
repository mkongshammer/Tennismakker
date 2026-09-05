// Genkendelse af klubbens bookingsystem.
//
// Formålet er at fjerne det værste spørgsmål fra en klubformands
// synsvinkel: "hvad er det egentlig, I skal bruge fra os?" I stedet for at
// bede om tekniske oplysninger, kigger vi selv på klubbens hjemmeside og
// fortæller, hvad vi fandt, og hvad der er muligt.
//
// Vigtigt: dette er genkendelse, ikke integration. Halbooking har ingen
// offentlig API, så selv når vi genkender det, kan vi ikke læse ledighed
// derfra uden en aftale med Globus Data. Det siger vi rent ud i svaret
// frem for at love noget, vi ikke kan holde.

export type DetectedSystem = {
  key: string;
  name: string;
  /** Kan vi automatisk hente ledighed fra det? */
  canSync: boolean;
  advice: string;
};

const SIGNATURES: {
  key: string;
  name: string;
  patterns: RegExp[];
  canSync: boolean;
  advice: string;
}[] = [
  {
    key: "halbooking",
    name: "Halbooking (Globus Data)",
    patterns: [/halbooking/i, /globusdata/i],
    canSync: false,
    advice:
      "I kan bruge os på to måder. Enten som et supplement: I sætter en regel op — fx “bane 3 og 4, hverdage 9-15” — spærrer de tider i Halbooking, og så sælger vi dem til gæster. Det tager to minutter og skal kun gøres én gang. Eller I flytter det hele til os: booking, faste baner, sæsonhold, kontingent med automatisk fornyelse, klippekort og en ny hjemmeside, I selv redigerer. Vi hjælper med flytningen.",
  },
  {
    key: "matchi",
    name: "Matchi",
    patterns: [/matchi\.se/i, /matchi\.com/i],
    canSync: false,
    advice:
      "I kan bruge os som et supplement — sæt en regel op for de tider, gæster må booke — eller flytte det hele til os: booking, kontingent, hold og en hjemmeside, I selv redigerer.",
  },
  {
    key: "conventus",
    name: "Conventus",
    patterns: [/conventus\.dk/i],
    canSync: false,
    advice:
      "Conventus kan i nogle opsætninger eksportere en kalender. Har I et .ics-link, kan vi spejle jeres ledighed automatisk — ellers sætter I en regel op.",
  },
  {
    key: "klubmodul",
    name: "Klubmodul",
    patterns: [/klubmodul/i],
    canSync: false,
    advice:
      "Klubmodul udstiller ikke ledighed til tredjeparter. Sæt en regel op hos os for de tider, gæster må booke.",
  },
  {
    key: "ical",
    name: "Kalenderfeed",
    patterns: [/\.ics\b/i, /webcal:/i],
    canSync: true,
    advice:
      "Vi fandt en kalender på jeres side. Sætter I den ind, spejler vi jeres ledighed automatisk hvert kvarter.",
  },
];

export type Detection = {
  ok: boolean;
  message: string;
  system?: DetectedSystem;
  icalUrl?: string;
  clubName?: string;
};

/** Henter klubbens hjemmeside og gætter på systemet ud fra sidens indhold. */
export async function detectBookingSystem(rawUrl: string): Promise<Detection> {
  let url: URL;
  try {
    url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { ok: false, message: "Det ser ikke ud som en gyldig webadresse." };
  }

  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RacketBuddy/1.0 (klubopsætning)" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Vi kunne ikke åbne siden (svarede ${res.status}). Tjek adressen, eller spring over — I kan sætte det op i hånden.`,
      };
    }
    html = await res.text();
  } catch {
    return {
      ok: false,
      message:
        "Vi kunne ikke nå siden. Det betyder ikke noget for jeres oprettelse — I kan sætte det op i hånden.",
    };
  }

  // Klubbens navn fra <title>, så formularen kan udfyldes på forhånd
  const titleMatch = /<title[^>]*>([^<]{2,120})<\/title>/i.exec(html);
  const clubName = titleMatch
    ? titleMatch[1].split(/[|–—-]/)[0].trim()
    : undefined;

  // Et kalenderlink, hvis der er et
  const icalMatch =
    /href=["']([^"']+\.ics(?:\?[^"']*)?)["']/i.exec(html) ??
    /href=["'](webcal:\/\/[^"']+)["']/i.exec(html);
  const icalUrl = icalMatch
    ? new URL(icalMatch[1].replace(/^webcal:/, "https:"), url).toString()
    : undefined;

  const hit = SIGNATURES.find((s) => s.patterns.some((p) => p.test(html)));

  if (!hit && !icalUrl) {
    return {
      ok: true,
      message:
        "Vi kunne ikke se hvilket bookingsystem I bruger. Det gør ikke noget — sæt en regel op for de tider, gæster må booke, så virker det uanset system.",
      clubName,
    };
  }

  const system = hit
    ? { key: hit.key, name: hit.name, canSync: hit.canSync, advice: hit.advice }
    : SIGNATURES.find((s) => s.key === "ical")!;

  return {
    ok: true,
    message: `Vi kan se, at I bruger ${system.name}.`,
    system: {
      key: system.key,
      name: system.name,
      canSync: Boolean(icalUrl) || system.canSync,
      advice: icalUrl
        ? "Vi fandt også en kalender på jeres side. Sætter I den ind, spejler vi jeres ledighed automatisk."
        : system.advice,
    },
    icalUrl,
    clubName,
  };
}

/** Prøver et kalenderfeed af og fortæller hvad der blev fundet. */
export async function testFeed(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/calendar" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, message: `Feedet svarede ${res.status}.` };

    const text = await res.text();
    if (!text.toUpperCase().includes("BEGIN:VCALENDAR")) {
      return { ok: false, message: "Adressen svarer, men det er ikke en kalender." };
    }
    const events = (text.match(/BEGIN:VEVENT/gi) ?? []).length;
    return {
      ok: true,
      message:
        events > 0
          ? `Feedet virker. Vi kan se ${events} bookinger i jeres kalender.`
          : "Feedet virker, men der er ingen bookinger i det lige nu.",
    };
  } catch {
    return { ok: false, message: "Vi kunne ikke nå feedet. Tjek adressen." };
  }
}
