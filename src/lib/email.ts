import {translatePhrase as phrase} from "../../shared/phrase-translation.mjs";
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
    accessLines.push(``, phrase("Adgang til anlægget:",opts.locale??'da'));
    if (opts.access.code) accessLines.push(phrase("Kode: {p0}",opts.locale??'da',{p0:opts.access.code}));
    if (opts.access.instructions) accessLines.push(opts.access.instructions);
  }

  return {
    to: opts.to,
    subject: phrase("Kvittering: {p0}",opts.locale??'da',{p0:opts.what}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.name}),
      ``,
      phrase("Din booking er bekræftet.",opts.locale??'da'),
      ``,
      `${opts.what}`,
      `${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
      phrase("Betalt: {p0}",opts.locale??'da',{p0:formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}),
      ...accessLines,
      ``,
      phrase("Se dine bookinger: {p0}/profil",opts.locale??'da',{p0:baseUrl()}),
      ``,
      phrase("Kan du ikke alligevel? Aflys senest 24 timer før, så får du pengene retur.",opts.locale??'da'),
      ``,
      phrase("Venlig hilsen",opts.locale??'da'),
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
    phrase("Ny gæstebooking i {p0}",opts.locale??'da',{p0:opts.clubName}),
    ``,
    `${opts.courtName} — ${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
    phrase("Spiller: {p0} ({p1})",opts.locale??'da',{p0:opts.playerName,p1:opts.playerEmail}),
    phrase("Betalt: {p0}",opts.locale??'da',{p0:formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}),
    ``,
  ];

  if (opts.needsClubEntry) {
    // Tiden er spærret i klubbens system i forvejen — det krævede vi, da
    // den blev frigivet. Så det her handler om, at klubben kan se, hvem
    // der kommer, ikke om at forhindre en dobbeltbooking.
    lines.push(
      phrase("Skriv {p0} på tiden i {p1},",opts.locale??'da',{p0:opts.playerName,p1:opts.externalSystem ?? "jeres eget bookingsystem"}),
      phrase("så I kan se hvem der kommer. Tiden er spærret dér i forvejen.",opts.locale??'da'),
      ``
    );
  }

  lines.push(phrase("Overblik: {p0}/admin",opts.locale??'da',{p0:baseUrl()}), ``, `RacketBuddy`);

  return {
    to: opts.to,
    subject: phrase("Ny booking: {p0}, {p1}",opts.locale??'da',{p0:opts.courtName,p1:formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}),
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
    subject: phrase("Ny elev: {p0}",opts.locale??'da',{p0:formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.coachName}),
      ``,
      phrase("Du har fået en ny booking.",opts.locale??'da'),
      ``,
      `${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})} · ${opts.length}`,
      phrase("Elev: {p0} ({p1})",opts.locale??'da',{p0:opts.playerName,p1:opts.playerEmail}),
      phrase("Beløb: {p0} — din andel udbetales automatisk",opts.locale??'da',{p0:formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}),
      ``,
      phrase("Din kalender: {p0}/profil",opts.locale??'da',{p0:baseUrl()}),
      ``,
      `RacketBuddy`,
    ].join("\n"),
  };
}

export function matchAcceptedNotice(opts: {locale?:string;
  to: string;
  requesterName: string;
  accepterName: string;
  message: string;
  threadId: string;
}): Mail {
  return {
    to: opts.to,
    subject: phrase("{p0} vil spille med dig",opts.locale??'da',{p0:opts.accepterName}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.requesterName}),
      ``,
      phrase("{p0} har slået til på dit opslag:",opts.locale??'da',{p0:opts.accepterName}),
      `"${opts.message}"`,
      ``,
      phrase("Skriv sammen og aftal tid og sted her:",opts.locale??'da'),
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
    subject: phrase("Aflyst: {p0}",opts.locale??'da',{p0:opts.what}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.name}),
      ``,
      phrase("Din booking er aflyst.",opts.locale??'da'),
      ``,
      `${opts.what}`,
      `${formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}`,
      ``,
      opts.refundKr !== null
        ? phrase("Du får {p0} retur. Beløbet er typisk på din konto inden for 5-10 hverdage.",opts.locale??'da',{p0:formatMoney(opts.refundKr,opts.currency??"DKK",opts.locale??"da")})
        : phrase("Aflysningen skete mindre end 24 timer før spilletidspunktet, så beløbet refunderes ikke.",opts.locale??'da'),
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
export function loginCode(opts: {locale?:string;
  to: string;
  name: string;
  code: string;
  minutes: number;
}): Mail {
  return {
    to: opts.to,
    subject: phrase("Din kode til RacketBuddy",opts.locale??'da'),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.name}),
      "",
      phrase("Kode til login:",opts.locale??'da'),
      opts.code,
      "",
      phrase("Koden gælder i {p0} minutter og kan kun bruges én gang.",opts.locale??'da',{p0:opts.minutes}),
      "",
      phrase("Har du ikke selv forsøgt at logge ind, kender nogen din adgangskode.",opts.locale??'da'),
      phrase("Skift den med det samme.",opts.locale??'da'),
    ].join("\n"),
  };
}

/**
 * Linket til at sætte en ny adgangskode.
 *
 * Advarslen nederst er der, fordi en mail, man ikke selv har bedt om, er
 * det tidligste tegn på, at nogen forsøger sig med kontoen.
 */
export function passwordResetLink(opts: {locale?:string;
  to: string;
  name: string;
  url: string;
  minutes: number;
}): Mail {
  return {
    to: opts.to,
    subject: phrase("Ny adgangskode til RacketBuddy",opts.locale??'da'),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.name}),
      "",
      phrase("Åbn linket her for at sætte en ny adgangskode:",opts.locale??'da'),
      opts.url,
      "",
      phrase("Linket virker i {p0} minutter og kan kun bruges én gang.",opts.locale??'da',{p0:opts.minutes}),
      "",
      phrase("Har du ikke selv bedt om det, kan du se bort fra mailen.",opts.locale??'da'),
      phrase("Din nuværende adgangskode virker stadig.",opts.locale??'da'),
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
      subject: phrase("{p0} kan ikke tage timen {p1}",opts.locale??'da',{p0:opts.coachName,p1:when}),
      body: [
        phrase("Hej {p0}",opts.locale??'da',{p0:opts.playerName}),
        "",
        phrase("{p0} kan desværre ikke tage timen {p1}.",opts.locale??'da',{p0:opts.coachName,p1:when}),
        "",
        phrase("Der er ikke trukket penge, og der er ikke brugt et klip.",opts.locale??'da'),
        "",
        phrase("Find en anden tid: {p0}/traenere",opts.locale??'da',{p0:baseUrl()}),
      ].join("\n"),
    };
  }

  if (opts.paidWithCredit) {
    return {
      to: opts.to,
      subject: phrase("Timen {p0} er bekræftet",opts.locale??'da',{p0:when}),
      body: [
        phrase("Hej {p0}",opts.locale??'da',{p0:opts.playerName}),
        "",
        phrase("{p0} har sagt ja til timen {p1}.",opts.locale??'da',{p0:opts.coachName,p1:when}),
        "",
        phrase("Der er brugt et klip fra dit pakkeforløb, så der er ingenting at betale.",opts.locale??'da'),
        "",
        phrase("Se den her: {p0}/profil",opts.locale??'da',{p0:baseUrl()}),
      ].join("\n"),
    };
  }

  return {
    to: opts.to,
    subject: phrase("{p0} har sagt ja — betal for timen {p1}",opts.locale??'da',{p0:opts.coachName,p1:when}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.playerName}),
      "",
      phrase("{p0} har sagt ja til timen {p1}.",opts.locale??'da',{p0:opts.coachName,p1:when}),
      "",
      phrase("Timen er din, når den er betalt. Du har et døgn, derefter frigives tiden igen:",opts.locale??'da'),
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
    subject: phrase("Ny anmodning: {p0}",opts.locale??'da',{p0:formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"})}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.coachName}),
      "",
      phrase("{p0} (niveau {p1}) vil booke en time hos dig:",opts.locale??'da',{p0:opts.playerName,p1:opts.playerLevel}),
      formatDate(opts.startsAt,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long",timeStyle:"short"}),
      opts.withCredit ? phrase("Betales med klip fra et pakkeforløb.",opts.locale??'da') : `${formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}`,
      "",
      phrase("Tiden er spærret, indtil du svarer. Der er ikke trukket penge endnu.",opts.locale??'da'),
      "",
      phrase("Godkend eller afvis her: {p0}/profil",opts.locale??'da',{p0:baseUrl()}),
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
  const period = `${formatDate(opts.fromDate,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long"})} – ${formatDate(opts.toDate,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long"})}`;

  return {
    to: opts.to,
    subject: phrase("Kontingent i {p0} — {p1}",opts.locale??'da',{p0:opts.clubName,p1:opts.seasonName}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.name}),
      "",
      phrase("Dit medlemskab i {p0} er registreret.",opts.locale??'da',{p0:opts.clubName}),
      "",
      phrase("Type: {p0}",opts.locale??'da',{p0:opts.typeName}),
      phrase("Sæson: {p0}",opts.locale??'da',{p0:opts.seasonName}),
      phrase("Gælder: {p0}",opts.locale??'da',{p0:period}),
      opts.priceKr > 0 ? phrase("Betalt: {p0}",opts.locale??'da',{p0:formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}) : phrase("Pris: gratis",opts.locale??'da'),
      "",
      phrase("Du kan nu booke klubbens baner til medlemspris. Se dine bookinger",opts.locale??'da'),
      phrase("her: {p0}/profil",opts.locale??'da',{p0:baseUrl()}),
      "",
      phrase("Denne mail er din kvittering. Gem den til dit eget regnskab.",opts.locale??'da'),
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
    subject: phrase("{p0}: dit kontingent fornyes {p1}",opts.locale??'da',{p0:opts.clubName,p1:formatDate(opts.chargeDate,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long"})}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.name}),
      "",
      phrase("Dit medlemskab i {p0} fornyes automatisk til den nye sæson.",opts.locale??'da',{p0:opts.clubName}),
      "",
      phrase("Sæson: {p0} ({p1})",opts.locale??'da',{p0:opts.seasonName,p1:opts.typeName}),
      phrase("Beløb: {p0}",opts.locale??'da',{p0:formatMoney(opts.priceKr,opts.currency??"DKK",opts.locale??"da")}),
      phrase("Trækkes: {p0}",opts.locale??'da',{p0:formatDate(opts.chargeDate,opts.locale??"da",opts.timeZone??"Europe/Copenhagen",{dateStyle:"long"})}),
      "",
      phrase("Skal det ikke fornyes, kan du slå det fra her — så sker der ingenting:",opts.locale??'da'),
      `${baseUrl()}/profil`,
      "",
      phrase("Du kan slå det fra indtil dagen før.",opts.locale??'da'),
    ].join("\n"),
  };
}

/** Fornyelsen kunne ikke gennemføres. */
export function renewalFailed(opts: {locale?:string;
  to: string;
  name: string;
  clubName: string;
  seasonName: string;
  reason: string;
  clubSlug: string;
}): Mail {
  return {
    to: opts.to,
    subject: phrase("{p0}: kontingentet blev ikke fornyet",opts.locale??'da',{p0:opts.clubName}),
    body: [
      phrase("Hej {p0}",opts.locale??'da',{p0:opts.name}),
      "",
      phrase("Vi kunne ikke fornye dit medlemskab til {p0}.",opts.locale??'da',{p0:opts.seasonName}),
      "",
      phrase("Årsag: {p0}",opts.locale??'da',{p0:opts.reason}),
      "",
      phrase("Der er ikke trukket noget. Vil du stadig være medlem, kan du tilmelde",opts.locale??'da'),
      phrase("dig her: {p0}/klub/{p1}",opts.locale??'da',{p0:baseUrl(),p1:opts.clubSlug}),
    ].join("\n"),
  };
}
