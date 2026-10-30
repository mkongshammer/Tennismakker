import {translatePhrase as phrase} from "../../shared/phrase-translation.mjs";
import {formatMoney,formatDate} from "./international";
// E-mail-lag for RacketBuddy.
//
// Samme mønster som betalingslaget: én abstraktion, så udbyderen kan skiftes
// uden at røre resten af koden. Uden EMAIL_API_KEY logges e-mails til konsollen
// i stedet for at blive sendt — så udvikling ikke kræver en konto nogen steder,
// og så en manglende nøgle i produktion aldrig vælter en booking.

import { getSettings, settingsSnapshot } from "./settings";
import { messageLocale, messageTimeZone, messageCurrency } from "./mail-locale";

type Mail = {
  to: string;
  subject: string;
  body: string; // ren tekst, én besked pr. linje
  /** Svar går hertil i stedet for til afsenderen, fx klubbens kasserer. */
  replyTo?: string;
  /** Internal: the quota warning itself is not counted (no warning loop). */
  uncounted?: boolean;
};

/** Counts accepted mail against the Resend plan and warns the owner at 80%. */
export async function countSent(n: number) {
  const { countMail } = await import("./mail-quota");
  await countMail(n, async (subject, body) => {
    const { db } = await import("./db");
    const to = (process.env.SALES_DIGEST_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!to.length) to.push(...(await db.user.findMany({ where: { role: "SUPERADMIN" }, select: { email: true } })).map((u) => u.email));
    for (const t of to) await sendMail({ to: t, subject, body, uncounted: true });
  });
}

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
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("E-mail afvist af udbyder:", res.status, await res.text());
      return false;
    }
    if (!mail.uncounted) void countSent(1);
    return true;
  } catch (err) {
    console.error("E-mail kunne ikke sendes:", err);
    return false;
  }
}

/**
 * Many e-mails at once (member invitations). Uses the provider's batch
 * endpoint, 100 per call, so a 5,000-member club is invited in under a
 * minute. Returns how many were accepted.
 */
export async function sendMailBatch(mails: Mail[]): Promise<number> {
  const { emailApiKey: key, emailFrom: from } = await getSettings();
  if (!key) { console.log("[e-mails ikke sendt — der er ingen mailnøgle]", mails.length); return 0; }
  let sent = 0;
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((m) => ({ from, to: [m.to], subject: m.subject, text: m.body, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }))),
      });
      if (res.ok) { sent += chunk.length; void countSent(chunk.length); } else console.error("Batch afvist:", res.status, (await res.text()).slice(0, 300));
    } catch (err) { console.error("Batch kunne ikke sendes:", err); }
    if (i + 100 < mails.length) await new Promise((r) => setTimeout(r, 600));
  }
  return sent;
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
    accessLines.push(``, phrase("Adgang til anlægget:",messageLocale(opts.locale)));
    if (opts.access.code) accessLines.push(phrase("Kode: {p0}",messageLocale(opts.locale),{p0:opts.access.code}));
    if (opts.access.instructions) accessLines.push(opts.access.instructions);
  }

  return {
    to: opts.to,
    subject: phrase("Kvittering: {p0}",messageLocale(opts.locale),{p0:opts.what}),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.name}),
      ``,
      phrase("Din booking er bekræftet.",messageLocale(opts.locale)),
      ``,
      `${opts.what}`,
      `${formatDate(opts.startsAt,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"})}`,
      phrase("Betalt: {p0}",messageLocale(opts.locale),{p0:formatMoney(opts.priceKr,messageCurrency(opts.currency),messageLocale(opts.locale))}),
      ...accessLines,
      ``,
      phrase("Se dine bookinger: {p0}/profile",messageLocale(opts.locale),{p0:baseUrl()}),
      ``,
      phrase("Kan du ikke alligevel? Aflys senest 24 timer før, så får du pengene retur.",messageLocale(opts.locale)),
      ``,
      phrase("Venlig hilsen",messageLocale(opts.locale)),
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
    phrase("Ny gæstebooking i {p0}",messageLocale(opts.locale),{p0:opts.clubName}),
    ``,
    `${opts.courtName} — ${formatDate(opts.startsAt,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"})}`,
    phrase("Spiller: {p0} ({p1})",messageLocale(opts.locale),{p0:opts.playerName,p1:opts.playerEmail}),
    phrase("Betalt: {p0}",messageLocale(opts.locale),{p0:formatMoney(opts.priceKr,messageCurrency(opts.currency),messageLocale(opts.locale))}),
    ``,
  ];

  if (opts.needsClubEntry) {
    // Tiden er spærret i klubbens system i forvejen — det krævede vi, da
    // den blev frigivet. Så det her handler om, at klubben kan se, hvem
    // der kommer, ikke om at forhindre en dobbeltbooking.
    lines.push(
      phrase("Skriv {p0} på tiden i {p1},",messageLocale(opts.locale),{p0:opts.playerName,p1:opts.externalSystem ?? "jeres eget bookingsystem"}),
      phrase("så I kan se hvem der kommer. Tiden er spærret dér i forvejen.",messageLocale(opts.locale)),
      ``
    );
  }

  lines.push(phrase("Overblik: {p0}/admin",messageLocale(opts.locale),{p0:baseUrl()}), ``, `RacketBuddy`);

  return {
    to: opts.to,
    subject: phrase("Ny booking: {p0}, {p1}",messageLocale(opts.locale),{p0:opts.courtName,p1:formatDate(opts.startsAt,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"})}),
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
    subject: phrase("Ny elev: {p0}",messageLocale(opts.locale),{p0:formatDate(opts.startsAt,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"})}),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.coachName}),
      ``,
      phrase("Du har fået en ny booking.",messageLocale(opts.locale)),
      ``,
      `${formatDate(opts.startsAt,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"})} · ${opts.length}`,
      phrase("Elev: {p0} ({p1})",messageLocale(opts.locale),{p0:opts.playerName,p1:opts.playerEmail}),
      phrase("Beløb: {p0} — din andel udbetales automatisk",messageLocale(opts.locale),{p0:formatMoney(opts.priceKr,messageCurrency(opts.currency),messageLocale(opts.locale))}),
      ``,
      phrase("Din kalender: {p0}/profile",messageLocale(opts.locale),{p0:baseUrl()}),
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
    subject: phrase("{p0} vil spille med dig",messageLocale(opts.locale),{p0:opts.accepterName}),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.requesterName}),
      ``,
      phrase("{p0} har slået til på dit opslag:",messageLocale(opts.locale),{p0:opts.accepterName}),
      `"${opts.message}"`,
      ``,
      phrase("Skriv sammen og aftal tid og sted her:",messageLocale(opts.locale)),
      `${baseUrl()}/messages/${opts.threadId}`,
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
  /** Amount refunded in major units; null when nothing was refunded. */
  refundKr: number | null;
  /** Whether the customer had actually paid. False for holds/requests. */
  charged?: boolean;
  cancelledBy?: "PLAYER" | "CLUB" | "COACH" | "SYSTEM";
  /** Club or coach name, used when they are the ones cancelling. */
  counterparty?: string;
  reason?: string;
  currency?:string;locale?:string;timeZone?:string;
}): Mail {
  const locale=messageLocale(opts.locale);
  const by=opts.cancelledBy??'PLAYER';
  const charged=opts.charged ?? opts.refundKr!==null;
  const who=opts.counterparty??'';
  const intro=
    by==='CLUB' ? phrase("{p0} har desværre måttet aflyse din booking.",locale,{p0:who||phrase("Klubben",locale)})
    : by==='COACH' ? phrase("{p0} har desværre måttet aflyse din time.",locale,{p0:who||phrase("Træneren",locale)})
    : phrase("Din booking er aflyst.",locale);
  const money=
    !charged ? phrase("Der er ikke trukket penge.",locale)
    : opts.refundKr !== null
      ? phrase("Du får {p0} retur. Beløbet er typisk på din konto inden for 5-10 hverdage.",locale,{p0:formatMoney(opts.refundKr,messageCurrency(opts.currency),locale)})
      : phrase("Aflysningen skete mindre end 24 timer før spilletidspunktet, så beløbet refunderes ikke.",locale);
  return {
    to: opts.to,
    subject: phrase("Aflyst: {p0}",locale,{p0:opts.what}),
    body: [
      phrase("Hej {p0}",locale,{p0:opts.name}),
      ``,
      intro,
      ...(opts.reason && by!=='PLAYER' ? [``, phrase("Begrundelse: {p0}",locale,{p0:opts.reason})] : []),
      ``,
      `${opts.what}`,
      `${formatDate(opts.startsAt,locale,messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"})}`,
      ``,
      money,
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
    subject: phrase("Din kode til RacketBuddy",messageLocale(opts.locale)),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.name}),
      "",
      phrase("Kode til login:",messageLocale(opts.locale)),
      opts.code,
      "",
      phrase("Koden gælder i {p0} minutter og kan kun bruges én gang.",messageLocale(opts.locale),{p0:opts.minutes}),
      "",
      phrase("Har du ikke selv forsøgt at logge ind, kender nogen din adgangskode.",messageLocale(opts.locale)),
      phrase("Skift den med det samme.",messageLocale(opts.locale)),
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
    subject: phrase("Ny adgangskode til RacketBuddy",messageLocale(opts.locale)),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.name}),
      "",
      phrase("Åbn linket her for at sætte en ny adgangskode:",messageLocale(opts.locale)),
      opts.url,
      "",
      phrase("Linket virker i {p0} minutter og kan kun bruges én gang.",messageLocale(opts.locale),{p0:opts.minutes}),
      "",
      phrase("Har du ikke selv bedt om det, kan du se bort fra mailen.",messageLocale(opts.locale)),
      phrase("Din nuværende adgangskode virker stadig.",messageLocale(opts.locale)),
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
/** A quoted personal note in a lesson e-mail ("Note from Sam:"), or nothing. */
function noteLines(note: string | null | undefined, from: string, locale?: string): string[] {
  const text = (note ?? "").trim();
  if (!text) return [];
  const label = messageLocale(locale) === "da" ? `Besked fra ${from}:` : `Note from ${from}:`;
  return ["", label, ...text.split(/\r?\n/).map((line) => `> ${line}`)];
}

export function coachDecision(opts: {
  to: string;
  playerName: string;
  coachName: string;
  startsAt: Date;
  approved: boolean;
  currency?:string;locale?:string;timeZone?:string;
  paidWithCredit: boolean;
  bookingId: string;
  /** The coach's optional note with the answer. */
  note?: string | null;
}): Mail {
  const note = noteLines(opts.note, opts.coachName, opts.locale);
  const when = formatDate(opts.startsAt,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"});

  if (!opts.approved) {
    return {
      to: opts.to,
      subject: phrase("{p0} kan ikke tage timen {p1}",messageLocale(opts.locale),{p0:opts.coachName,p1:when}),
      body: [
        phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.playerName}),
        "",
        phrase("{p0} kan desværre ikke tage timen {p1}.",messageLocale(opts.locale),{p0:opts.coachName,p1:when}),
        ...note,
        "",
        phrase("Der er ikke trukket penge, og der er ikke brugt et klip.",messageLocale(opts.locale)),
        "",
        phrase("Find en anden tid: {p0}/coaches",messageLocale(opts.locale),{p0:baseUrl()}),
      ].join("\n"),
    };
  }

  if (opts.paidWithCredit) {
    return {
      to: opts.to,
      subject: phrase("Timen {p0} er bekræftet",messageLocale(opts.locale),{p0:when}),
      body: [
        phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.playerName}),
        "",
        phrase("{p0} har sagt ja til timen {p1}.",messageLocale(opts.locale),{p0:opts.coachName,p1:when}),
        ...note,
        "",
        phrase("Der er brugt et klip fra dit pakkeforløb, så der er ingenting at betale.",messageLocale(opts.locale)),
        "",
        phrase("Se den her: {p0}/profile",messageLocale(opts.locale),{p0:baseUrl()}),
      ].join("\n"),
    };
  }

  return {
    to: opts.to,
    subject: phrase("{p0} har sagt ja — betal for timen {p1}",messageLocale(opts.locale),{p0:opts.coachName,p1:when}),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.playerName}),
      "",
      phrase("{p0} har sagt ja til timen {p1}.",messageLocale(opts.locale),{p0:opts.coachName,p1:when}),
      ...note,
      "",
      phrase("Timen er din, når den er betalt. Du har et døgn, derefter frigives tiden igen:",messageLocale(opts.locale)),
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
  /** The player's optional note with the request. */
  note?: string | null;
}): Mail {
  return {
    to: opts.to,
    subject: phrase("Ny anmodning: {p0}",messageLocale(opts.locale),{p0:formatDate(opts.startsAt,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"})}),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.coachName}),
      "",
      phrase("{p0} (niveau {p1}) vil booke en time hos dig:",messageLocale(opts.locale),{p0:opts.playerName,p1:opts.playerLevel}),
      formatDate(opts.startsAt,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long",timeStyle:"short"}),
      opts.withCredit ? phrase("Betales med klip fra et pakkeforløb.",messageLocale(opts.locale)) : `${formatMoney(opts.priceKr,messageCurrency(opts.currency),messageLocale(opts.locale))}`,
      ...noteLines(opts.note, opts.playerName, opts.locale),
      "",
      phrase("Tiden er spærret, indtil du svarer. Der er ikke trukket penge endnu.",messageLocale(opts.locale)),
      "",
      phrase("Godkend eller afvis her: {p0}/profile",messageLocale(opts.locale),{p0:baseUrl()}),
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
  const period = `${formatDate(opts.fromDate,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long"})} – ${formatDate(opts.toDate,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long"})}`;

  return {
    to: opts.to,
    subject: phrase("Kontingent i {p0} — {p1}",messageLocale(opts.locale),{p0:opts.clubName,p1:opts.seasonName}),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.name}),
      "",
      phrase("Dit medlemskab i {p0} er registreret.",messageLocale(opts.locale),{p0:opts.clubName}),
      "",
      phrase("Type: {p0}",messageLocale(opts.locale),{p0:opts.typeName}),
      phrase("Sæson: {p0}",messageLocale(opts.locale),{p0:opts.seasonName}),
      phrase("Gælder: {p0}",messageLocale(opts.locale),{p0:period}),
      opts.priceKr > 0 ? phrase("Betalt: {p0}",messageLocale(opts.locale),{p0:formatMoney(opts.priceKr,messageCurrency(opts.currency),messageLocale(opts.locale))}) : phrase("Pris: gratis",messageLocale(opts.locale)),
      "",
      phrase("Du kan nu booke klubbens baner til medlemspris. Se dine bookinger",messageLocale(opts.locale)),
      phrase("her: {p0}/profile",messageLocale(opts.locale),{p0:baseUrl()}),
      "",
      phrase("Denne mail er din kvittering. Gem den til dit eget regnskab.",messageLocale(opts.locale)),
    ].join("\n"),
  };
}

type BillMail = {
  to: string;
  name: string;
  clubName: string;
  typeName: string;
  seasonName: string;
  fromDate: Date;
  toDate: Date;
  priceKr: number;
  currency?: string;
  locale?: string;
  timeZone?: string;
  dueDate: Date | null;
  payToken: string;
  note?: string | null;
  replyTo?: string;
};

function billLines(o: BillMail) {
  const l = messageLocale(o.locale), tz = messageTimeZone(o.timeZone);
  // Season dates are calendar dates stored at UTC midnight, like the admin shows them.
  const period = `${formatDate(o.fromDate, l, "UTC", { dateStyle: "long" })} – ${formatDate(o.toDate, l, "UTC", { dateStyle: "long" })}`;
  return [
    phrase("Kontingent: {p0} ({p1})", l, { p0: o.typeName, p1: o.seasonName }),
    phrase("Gælder: {p0}", l, { p0: period }),
    phrase("Beløb: {p0}", l, { p0: formatMoney(o.priceKr, messageCurrency(o.currency), l) }),
    ...(o.dueDate ? [phrase("Betales senest: {p0}", l, { p0: formatDate(o.dueDate, l, tz, { dateStyle: "long" }) })] : []),
    "",
    phrase("Betal med kort her (du skal ikke logge ind):", l),
    `${baseUrl()}/pay/${o.payToken}`,
    "",
    phrase("Du kan også betale i RacketBuddy-appen under Profil.", l),
    ...(o.note ? ["", o.note] : []),
    "",
    phrase("Spørgsmål? Svar på denne mail, så går den til {p0}.", l, { p0: o.clubName }),
  ];
}

/** Klubben sender regningen for sæsonens kontingent. */
export function billNotice(o: BillMail): Mail {
  const l = messageLocale(o.locale);
  return {
    to: o.to,
    replyTo: o.replyTo,
    subject: phrase("{p0}: kontingent for {p1}", l, { p0: o.clubName, p1: o.seasonName }),
    body: [
      phrase("Hej {p0}", l, { p0: o.name }),
      "",
      phrase("Her er din regning for kontingent i {p0}.", l, { p0: o.clubName }),
      "",
      ...billLines(o),
    ].join("\n"),
  };
}

/** Påmindelse før forfald, eller én gang efter. */
export function billReminder(o: BillMail & { overdue: boolean }): Mail {
  const l = messageLocale(o.locale);
  return {
    to: o.to,
    replyTo: o.replyTo,
    subject: o.overdue
      ? phrase("{p0}: dit kontingent er ikke betalt", l, { p0: o.clubName })
      : phrase("{p0}: påmindelse om kontingent", l, { p0: o.clubName }),
    body: [
      phrase("Hej {p0}", l, { p0: o.name }),
      "",
      o.overdue
        ? phrase("Vi har endnu ikke modtaget dit kontingent til {p0}. Har du allerede betalt, kan du se bort fra denne mail.", l, { p0: o.clubName })
        : phrase("En venlig påmindelse: dit kontingent til {p0} skal snart betales.", l, { p0: o.clubName }),
      "",
      ...billLines(o),
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
    subject: phrase("{p0}: dit kontingent fornyes {p1}",messageLocale(opts.locale),{p0:opts.clubName,p1:formatDate(opts.chargeDate,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long"})}),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.name}),
      "",
      phrase("Dit medlemskab i {p0} fornyes automatisk til den nye sæson.",messageLocale(opts.locale),{p0:opts.clubName}),
      "",
      phrase("Sæson: {p0} ({p1})",messageLocale(opts.locale),{p0:opts.seasonName,p1:opts.typeName}),
      phrase("Beløb: {p0}",messageLocale(opts.locale),{p0:formatMoney(opts.priceKr,messageCurrency(opts.currency),messageLocale(opts.locale))}),
      phrase("Trækkes: {p0}",messageLocale(opts.locale),{p0:formatDate(opts.chargeDate,messageLocale(opts.locale),messageTimeZone(opts.timeZone),{dateStyle:"long"})}),
      "",
      phrase("Skal det ikke fornyes, kan du slå det fra her — så sker der ingenting:",messageLocale(opts.locale)),
      `${baseUrl()}/profile`,
      "",
      phrase("Du kan slå det fra indtil dagen før.",messageLocale(opts.locale)),
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
    subject: phrase("{p0}: kontingentet blev ikke fornyet",messageLocale(opts.locale),{p0:opts.clubName}),
    body: [
      phrase("Hej {p0}",messageLocale(opts.locale),{p0:opts.name}),
      "",
      phrase("Vi kunne ikke fornye dit medlemskab til {p0}.",messageLocale(opts.locale),{p0:opts.seasonName}),
      "",
      phrase("Årsag: {p0}",messageLocale(opts.locale),{p0:opts.reason}),
      "",
      phrase("Der er ikke trukket noget. Vil du stadig være medlem, kan du tilmelde",messageLocale(opts.locale)),
      phrase("dig her: {p0}/clubs/{p1}",messageLocale(opts.locale),{p0:baseUrl(),p1:opts.clubSlug}),
    ].join("\n"),
  };
}
