// Adapter-lag mod klubbernes eksisterende bookingsystemer.
//
// Baggrund: de fleste danske tennisklubber kører allerede et bookingsystem
// (typisk Halbooking fra Globus Data). Vi erstatter det ikke — vi lægger os
// ovenpå og viser udefrakommende spillere, hvad der er ledigt.
//
// Halbooking har ikke en offentlig API, tredjeparter kan læse ledighed fra.
// Derfor findes der flere veje ind, og resten af platformen skal være
// ligeglad med hvilken en klub bruger. Det er hele pointen med dette lag:
// tilføj en ny adapter, og klubsiden, booking og betaling virker uændret.

export type IntegrationType = "NATIVE" | "MANUAL" | "ICAL" | "API";

export type AvailableSlot = {
  courtId: string;
  courtName: string;
  surface: string;
  /** Indendørs bane. En hal kan spilles i hele vinteren. */
  indoor?: boolean;
  startsAt: Date;
  endsAt: Date;
  priceKr: number;
};

export type AvailabilityResult = {
  slots: AvailableSlot[];
  /** Sandt når bookinger hos os også skal indtastes i klubbens eget system. */
  needsClubEntry: boolean;
  /** Vises til klubben i admin, ikke til spilleren. */
  note?: string;
};

export type AdapterInput = {
  clubId: string;
  from: Date;
  until: Date;
  /** Er den, der kigger, medlem af klubben? Så gælder medlemsprisen. */
  isMember?: boolean;
};

/** Alle adaptere opfylder denne kontrakt. */
export interface BookingSystemAdapter {
  readonly type: IntegrationType;
  readonly label: string;
  getAvailability(input: AdapterInput): Promise<AvailabilityResult>;
}

export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  NATIVE: "RacketBuddy er klubbens bookingsystem",
  MANUAL: "Klubben frigiver selv gæstetider",
  ICAL: "Kalenderfeed fra klubbens eget system",
  API: "Direkte API-integration",
};

export const INTEGRATION_HELP: Record<IntegrationType, string> = {
  NATIVE:
    "Til klubber uden eget bookingsystem. Alle baner og tider styres her, og medlemmer booker direkte hos os.",
  MANUAL:
    "Klubben markerer selv præcis hvilke tider gæster må booke. Virker med ethvert bookingsystem, fordi der ikke skal kobles noget sammen.",
  ICAL:
    "Vi henter klubbens kalenderfeed og viser det, der ikke allerede er optaget. Kræver at klubbens system kan udstille en .ics-feed.",
  API: "Direkte opslag i klubbens bookingsystem. Kræver en partneraftale med systemleverandøren og er ikke bygget endnu.",
};
