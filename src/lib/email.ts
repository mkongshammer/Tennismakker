// E-mail-lag for RacketBuddy.
//
// Samme mønster som betalingslaget: én abstraktion, så udbyderen kan skiftes
// uden at røre resten af koden. Uden EMAIL_API_KEY logges e-mails til konsollen
// i stedet for at blive sendt — så udvikling ikke kræver en konto nogen steder,
// og så en manglende nøgle i produktion aldrig vælter en booking.

import { getSettings, settingsSnapshot } from "./settings";

type Mail = {
  to: string;
  subject: string;
  body: string; // ren tekst, én besked pr. linje
};

/**
 * Sender en e-mail. Fejler aldrig hårdt: en booking må ikke gå tabt,
 * fordi mailserveren er nede. Fejl logges i stedet.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  // Afsenderen skal ligge på et domæne, der er verificeret hos
  // e-mailudbyderen — ellers afvises mailen, eller den lander i spam.
  const { emailApiKey: key, emailFrom: from } = await getSettings();

  if (!key) {
    console.log("[e-mail ikke sendt — der er ingen mailnøgle]", {
      til: mail.to,
      emne: mail.subject,
    });
    console.log(mail.body);
    return false;
  }

  try {
    // Resend som udbyder. Skal der skiftes til fx Postmark eller SendGrid,
    // er det kun dette kald, der ændres.
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.body,
      }),
    });
    if (!res.ok) {
      console.error("E-mail afvist af udbyder:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("E-mail kunne ikke sendes:", err);
    return false;
  }
}

const DAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

function danishDateTime(d: Date): string {
  const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${DAYS[d.getDay()]} d. ${d.getDate()}. ${MONTHS[d.getMonth()]} kl. ${t}`;
}

// Skabelonerne bygger links synkront, mens de sammensættes, så de læser
// det sidst indlæste snapshot i stedet for at vente på databasen.
const baseUrl = () => settingsSnapshot().appUrl;

// ---------------------------------------------------------------------------
// Skabeloner
// ---------------------------------------------------------------------------

export function bookingReceipt(opts: {
  to: string;
  name: string;
  what: string;
  startsAt: Date;
  priceKr: number;
  bookingId: string;
  access?: { hasLock: boolean; code: string | null; instructions: string | null };
}): Mail {
  const accessLines: string[] = [];
  if (opts.access?.hasLock) {
    accessLines.push(``, `Adgang til anlægget:`);
    if (opts.access.code) accessLines.push(`Kode: ${opts.access.code}`);
    if (opts.access.instructions) accessLines.push(opts.access.instructions);
  }

  return {
    to: opts.to,
    subject: `Kvittering: ${opts.what}`,
    body: [
      `Hej ${opts.name}`,
      ``,
      `Din booking er bekræftet.`,
      ``,
      `${opts.what}`,
      `${danishDateTime(opts.startsAt)}`,
      `Betalt: ${opts.priceKr} kr`,
      ...accessLines,
      ``,
      `Se dine bookinger: ${baseUrl()}/profil`,
      ``,
      `Kan du ikke alligevel? Aflys senest 24 timer før, så får du pengene retur.`,
      ``,
      `Venlig hilsen`,
      `RacketBuddy`,
    ].join("\n"),
  };
}

export function clubBookingNotice(opts: {
  to: string;
  clubName: string;
  courtName: string;
  playerName: string;
  playerEmail: string;
  startsAt: Date;
  priceKr: number;
  needsClubEntry: boolean;
  externalSystem: string | null;
}): Mail {
  const lines = [
    `Ny gæstebooking i ${opts.clubName}`,
    ``,
    `${opts.courtName} — ${danishDateTime(opts.startsAt)}`,
    `Spiller: ${opts.playerName} (${opts.playerEmail})`,
    `Betalt: ${opts.priceKr} kr`,
    ``,
  ];

  if (opts.needsClubEntry) {
    lines.push(
      `VIGTIGT: Før tiden ind i ${opts.externalSystem ?? "jeres eget bookingsystem"},`,
      `så banen ikke bliver dobbeltbooket.`,
      ``
    );
  }

  lines.push(`Overblik: ${baseUrl()}/admin`, ``, `RacketBuddy`);

  return {
    to: opts.to,
    subject: `Ny booking: ${opts.courtName}, ${danishDateTime(opts.startsAt)}`,
    body: lines.join("\n"),
  };
}

export function coachBookingNotice(opts: {
  to: string;
  coachName: string;
  playerName: string;
  playerEmail: string;
  startsAt: Date;
  priceKr: number;
  length: string;
}): Mail {
  return {
    to: opts.to,
    subject: `Ny elev: ${danishDateTime(opts.startsAt)}`,
    body: [
      `Hej ${opts.coachName}`,
      ``,
      `Du har fået en ny booking.`,
      ``,
      `${danishDateTime(opts.startsAt)} · ${opts.length}`,
      `Elev: ${opts.playerName} (${opts.playerEmail})`,
      `Beløb: ${opts.priceKr} kr — din andel udbetales automatisk`,
      ``,
      `Din kalender: ${baseUrl()}/profil`,
      ``,
      `RacketBuddy`,
    ].join("\n"),
  };
}

export function matchAcceptedNotice(opts: {
  to: string;
  requesterName: string;
  accepterName: string;
  message: string;
  threadId: string;
}): Mail {
  return {
    to: opts.to,
    subject: `${opts.accepterName} vil spille med dig`,
    body: [
      `Hej ${opts.requesterName}`,
      ``,
      `${opts.accepterName} har slået til på dit opslag:`,
      `"${opts.message}"`,
      ``,
      `Skriv sammen og aftal tid og sted her:`,
      `${baseUrl()}/beskeder/${opts.threadId}`,
      ``,
      `RacketBuddy`,
    ].join("\n"),
  };
}

export function cancellationNotice(opts: {
  to: string;
  name: string;
  what: string;
  startsAt: Date;
  refundKr: number | null;
}): Mail {
  return {
    to: opts.to,
    subject: `Aflyst: ${opts.what}`,
    body: [
      `Hej ${opts.name}`,
      ``,
      `Din booking er aflyst.`,
      ``,
      `${opts.what}`,
      `${danishDateTime(opts.startsAt)}`,
      ``,
      opts.refundKr !== null
        ? `Du får ${opts.refundKr} kr retur. Beløbet er typisk på din konto inden for 5-10 hverdage.`
        : `Aflysningen skete mindre end 24 timer før spilletidspunktet, så beløbet refunderes ikke.`,
      ``,
      `RacketBuddy`,
    ].join("\n"),
  };
}

/**
 * Engangskoden til et login i to trin.
 *
 * Emnefeltet siger, hvad det handler om, uden at afsløre koden — emner
 * vises på en låst skærm. Advarslen nederst er der, fordi en kode, man
 * ikke selv har bedt om, er det tidligste tegn på, at nogen kender
 * adgangskoden.
 */
export function loginCode(opts: {
  to: string;
  name: string;
  code: string;
  minutes: number;
}): Mail {
  return {
    to: opts.to,
    subject: "Din kode til RacketBuddy",
    body: [
      `Hej ${opts.name}`,
      "",
      "Kode til login:",
      opts.code,
      "",
      `Koden gælder i ${opts.minutes} minutter og kan kun bruges én gang.`,
      "",
      "Har du ikke selv forsøgt at logge ind, kender nogen din adgangskode.",
      "Skift den med det samme.",
    ].join("\n"),
  };
}
