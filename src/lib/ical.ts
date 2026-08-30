// Minimal iCalendar-parser (RFC 5545) til at læse optaget-tider fra klubbens
// eksisterende bookingsystem.
//
// Bevidst begrænset: vi læser DTSTART, DTEND, SUMMARY og simple ugentlige
// RRULE'er. Det dækker de feeds, klubbernes systemer typisk udstiller.
// Vi bruger den kun til at vide hvad der er OPTAGET — aldrig til at skrive.

export type IcalEvent = {
  start: Date;
  end: Date;
  summary: string | null;
  /** Rå værdi af LOCATION/SUMMARY brugt til at gætte hvilken ink eventet hører til */
  raw: string;
};

/** Folder linjer sammen igen: iCal bryder lange linjer med CRLF + mellemrum/tab. */
function unfold(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Parser DTSTART/DTEND-værdier: 20260901T140000Z, 20260901T140000, 20260901 */
function parseIcalDate(value: string): Date | null {
  const v = value.trim();
  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v);
  if (utc) {
    const [, y, mo, d, h, mi, s] = utc;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }
  const local = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (local) {
    const [, y, mo, d, h, mi, s] = local;
    return new Date(+y, +mo - 1, +d, +h, +mi, +s);
  }
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return new Date(+y, +mo - 1, +d);
  }
  return null;
}

/**
 * Parser en .ics-tekst til konkrete events inden for [from, until].
 * Ugentlige RRULE'er foldes ud til enkelte forekomster i perioden.
 */
export function parseIcal(text: string, from: Date, until: Date): IcalEvent[] {
  const lines = unfold(text);
  const events: IcalEvent[] = [];

  let inEvent = false;
  let start: Date | null = null;
  let end: Date | null = null;
  let summary: string | null = null;
  let location: string | null = null;
  let rrule: string | null = null;

  const push = () => {
    if (!start || !end) return;
    const raw = [summary, location].filter(Boolean).join(" ");
    const durationMs = end.getTime() - start.getTime();

    if (rrule && /FREQ=WEEKLY/i.test(rrule)) {
      // Fold ugentlig gentagelse ud. UNTIL/COUNT respekteres hvis angivet.
      const untilMatch = /UNTIL=([0-9TZ]+)/i.exec(rrule);
      const countMatch = /COUNT=(\d+)/i.exec(rrule);
      const ruleUntil = untilMatch ? parseIcalDate(untilMatch[1]) : null;
      const maxCount = countMatch ? +countMatch[1] : Infinity;
      const hardStop = ruleUntil && ruleUntil < until ? ruleUntil : until;

      let occurrence = new Date(start);
      let n = 0;
      while (occurrence <= hardStop && n < maxCount && n < 400) {
        const occEnd = new Date(occurrence.getTime() + durationMs);
        if (occEnd > from) {
          events.push({ start: new Date(occurrence), end: occEnd, summary, raw });
        }
        occurrence = new Date(occurrence.getTime() + 7 * 24 * 60 * 60 * 1000);
        n++;
      }
    } else if (end > from && start < until) {
      events.push({ start, end, summary, raw });
    }
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      start = end = null;
      summary = location = rrule = null;
      continue;
    }
    if (upper.startsWith("END:VEVENT")) {
      if (inEvent) push();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const name = line.slice(0, sep).toUpperCase();
    const value = line.slice(sep + 1);

    if (name.startsWith("DTSTART")) start = parseIcalDate(value);
    else if (name.startsWith("DTEND")) end = parseIcalDate(value);
    else if (name.startsWith("SUMMARY")) summary = value;
    else if (name.startsWith("LOCATION")) location = value;
    else if (name.startsWith("RRULE")) rrule = value;
  }

  return events;
}
