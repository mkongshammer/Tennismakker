import {formatMoney,formatDate} from "./international";
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

/** Kun dato. En sæson har ikke et klokkeslæt. */
function danishDate(d: Date): string {
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

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
  currency?:string;
  locale?:string;timeZone?:string;
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
      `${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
      `Betalt: ${formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}`,
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
  currency?:string;
  locale?:string;timeZone?:string;
  needsClubEntry: boolean;
  externalSystem: string | null;
}): Mail {
  const lines = [
    `Ny gæstebooking i ${opts.clubName}`,
    ``,
    `${opts.courtName} — ${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
    `Spiller: ${opts.playerName} (${opts.playerEmail})`,
    `Betalt: ${formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}`,
    ``,
  ];

  if (opts.needsClubEntry) {
    // Tiden er spærret i klubbens system i forvejen — det krævede vi, da
    // den blev frigivet. Så det her handler om, at klubben kan se, hvem
    // der kommer, ikke om at forhindre en dobbeltbooking.
    lines.push(
      `Skriv ${opts.playerName} på tiden i ${opts.externalSystem ?? "jeres eget bookingsystem"},`,
      `så I kan se hvem der kommer. Tiden er spærret dér i forvejen.`,
      ``
    );
  }

  lines.push(`Overblik: ${baseUrl()}/admin`, ``, `RacketBuddy`);

  return {
    to: opts.to,
    subject: `Ny booking: ${opts.courtName}, ${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
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
  currency?:string;
  locale?:string;timeZone?:string;
  length: string;
}): Mail {
  return {
    to: opts.to,
    subject: `Ny elev: ${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
    body: [
      `Hej ${opts.coachName}`,
      ``,
      `Du har fået en ny booking.`,
      ``,
      `${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})} · ${opts.length}`,
      `Elev: ${opts.playerName} (${opts.playerEmail})`,
      `Beløb: ${formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")} — din andel udbetales automatisk`,
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
  currency?:string;locale?:string;timeZone?:string;
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
      `${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
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

/**
 * Linket til at sætte en ny adgangskode.
 *
 * Advarslen nederst er der, fordi en mail, man ikke selv har bedt om, er
 * det tidligste tegn på, at nogen forsøger sig med kontoen.
 */
export function passwordResetLink(opts: {
  to: string;
  name: string;
  url: string;
  minutes: number;
}): Mail {
  return {
    to: opts.to,
    subject: "Ny adgangskode til RacketBuddy",
    body: [
      `Hej ${opts.name}`,
      "",
      "Åbn linket her for at sætte en ny adgangskode:",
      opts.url,
      "",
      `Linket virker i ${opts.minutes} minutter og kan kun bruges én gang.`,
      "",
      "Har du ikke selv bedt om det, kan du se bort fra mailen.",
      "Din nuværende adgangskode virker stadig.",
    ].join("\n"),
  };
}

/**
 * Trænerens svar på en anmodning om en time.
 *
 * Ét skabelon til både ja og nej. Et afslag skal ikke se ud som en fejl —
 * det er et almindeligt svar, og eleven skal kunne se, at der ikke er
 * trukket penge.
 */
export function coachDecision(opts: {
  to: string;
  playerName: string;
  coachName: string;
  startsAt: Date;
  approved: boolean;
  currency?:string;locale?:string;timeZone?:string;
  paidWithCredit: boolean;
  bookingId: string;
}): Mail {
  const when = formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"});

  if (!opts.approved) {
    return {
      to: opts.to,
      subject: `${opts.coachName} kan ikke tage timen ${when}`,
      body: [
        `Hej ${opts.playerName}`,
        "",
        `${opts.coachName} kan desværre ikke tage timen ${when}.`,
        "",
        "Der er ikke trukket penge, og der er ikke brugt et klip.",
        "",
        `Find en anden tid: ${baseUrl()}/traenere`,
      ].join("\n"),
    };
  }

  if (opts.paidWithCredit) {
    return {
      to: opts.to,
      subject: `Timen ${when} er bekræftet`,
      body: [
        `Hej ${opts.playerName}`,
        "",
        `${opts.coachName} har sagt ja til timen ${when}.`,
        "",
        "Der er brugt et klip fra dit pakkeforløb, så der er ingenting at betale.",
        "",
        `Se den her: ${baseUrl()}/profil`,
      ].join("\n"),
    };
  }

  return {
    to: opts.to,
    subject: `${opts.coachName} har sagt ja — betal for timen ${when}`,
    body: [
      `Hej ${opts.playerName}`,
      "",
      `${opts.coachName} har sagt ja til timen ${when}.`,
      "",
      "Timen er din, når den er betalt. Du har et døgn, derefter frigives tiden igen:",
      `${baseUrl()}/checkout/${opts.bookingId}/start`,
    ].join("\n"),
  };
}


/**
 * Ny anmodning til træneren.
 *
 * Uden den ville en anmodning ligge og spærre en tid, indtil træneren
 * tilfældigvis åbnede sin profil. Eleven venter, tiden er låst, og ingen
 * ved det.
 */
export function coachRequestNotice(opts: {
  to: string;
  coachName: string;
  playerName: string;
  playerLevel: number;
  startsAt: Date;
  priceKr: number;
  currency?:string;
  locale?:string;timeZone?:string;
  withCredit: boolean;
}): Mail {
  return {
    to: opts.to,
    subject: `Ny anmodning: ${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
    body: [
      `Hej ${opts.coachName}`,
      "",
      `${opts.playerName} (niveau ${opts.playerLevel}) vil booke en time hos dig:`,
      formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"}),
      opts.withCredit ? "Betales med klip fra et pakkeforløb." : `${formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}`,
      "",
      "Tiden er spærret, indtil du svarer. Der er ikke trukket penge endnu.",
      "",
      `Godkend eller afvis her: ${baseUrl()}/profil`,
    ].join("\n"),
  };
}

/**
 * Kvittering for kontingent.
 *
 * Et kontingent er ofte over tusind kroner, og et medlem skal have noget på
 * skrift — både for sin egen skyld og til klubbens bogføring. Beløbet og
 * perioden står med i klartekst, så mailen kan bruges som dokumentation.
 */
export function membershipReceipt(opts: {
  to: string;
  name: string;
  clubName: string;
  typeName: string;
  seasonName: string;
  fromDate: Date;
  toDate: Date;
  priceKr: number;
  currency?:string;
  locale?:string;timeZone?:string;
}): Mail {
  const period = `${danishDate(opts.fromDate)} – ${danishDate(opts.toDate)}`;

  return {
    to: opts.to,
    subject: `Kontingent i ${opts.clubName} — ${opts.seasonName}`,
    body: [
      `Hej ${opts.name}`,
      "",
      `Dit medlemskab i ${opts.clubName} er registreret.`,
      "",
      `Type: ${opts.typeName}`,
      `Sæson: ${opts.seasonName}`,
      `Gælder: ${period}`,
      opts.priceKr > 0 ? `Betalt: ${formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}` : "Pris: gratis",
      "",
      "Du kan nu booke klubbens baner til medlemspris. Se dine bookinger",
      `her: ${baseUrl()}/profil`,
      "",
      "Denne mail er din kvittering. Gem den til dit eget regnskab.",
    ].join("\n"),
  };
}

/**
 * Besked 14 dage før en automatisk fornyelse.
 *
 * Den er ikke høflighed, den er en forudsætning. En tilbagevendende
 * betaling uden varsel er både dårlig skik og noget, forbrugerbeskyttelse
 * ser skævt til. Linket til at slå den fra står tydeligt, ikke i en
 * fodnote.
 */
export function renewalNotice(opts: {
  to: string;
  name: string;
  clubName: string;
  typeName: string;
  seasonName: string;
  priceKr: number;
  currency?:string;
  locale?:string;timeZone?:string;
  chargeDate: Date;
  clubSlug: string;
}): Mail {
  return {
    to: opts.to,
    subject: `${opts.clubName}: dit kontingent fornyes ${danishDate(opts.chargeDate)}`,
    body: [
      `Hej ${opts.name}`,
      "",
      `Dit medlemskab i ${opts.clubName} fornyes automatisk til den nye sæson.`,
      "",
      `Sæson: ${opts.seasonName} (${opts.typeName})`,
      `Beløb: ${formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}`,
      `Trækkes: ${danishDate(opts.chargeDate)}`,
      "",
      "Skal det ikke fornyes, kan du slå det fra her — så sker der ingenting:",
      `${baseUrl()}/profil`,
      "",
      "Du kan slå det fra indtil dagen før.",
    ].join("\n"),
  };
}

/** Fornyelsen kunne ikke gennemføres. */
export function renewalFailed(opts: {
  to: string;
  name: string;
  clubName: string;
  seasonName: string;
  reason: string;
  clubSlug: string;
}): Mail {
  return {
    to: opts.to,
    subject: `${opts.clubName}: kontingentet blev ikke fornyet`,
    body: [
      `Hej ${opts.name}`,
      "",
      `Vi kunne ikke fornye dit medlemskab til ${opts.seasonName}.`,
      "",
      `Årsag: ${opts.reason}`,
      "",
      "Der er ikke trukket noget. Vil du stadig være medlem, kan du tilmelde",
      `dig her: ${baseUrl()}/klub/${opts.clubSlug}`,
    ].join("\n"),
  };
}
