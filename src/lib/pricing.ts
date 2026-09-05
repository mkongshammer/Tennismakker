// Hvad koster en time?
//
// Indtil nu var svaret ét tal for hele klubben. Men en hal koster mere end
// en grusbane, og fredag klokken 18 koster mere end tirsdag klokken 10 —
// det er reglen i enhver klub med en hal, og den kunne ikke skrives.
//
// Tre niveauer, mest specifik vinder:
//
//   1. En prisregel, der dækker banen, ugedagen og timen
//   2. Banens egen pris
//   3. Klubbens almindelige pris
//
// Rækkefølgen betyder, at en klub kan sætte hallens pris én gang på banen
// og så kun skrive de regler, der afviger — frem for at gentage hallens
// pris i hver eneste regel.
//
// Ren regning, ingen database: den kaldes for hver celle i kalenderen, og
// et opslag pr. celle ville være hundredvis pr. sidevisning.

export type PriceRuleInput = {
  courtIds: string;
  daysOfWeek: string;
  fromHour: number;
  toHour: number;
  priceKr: number;
  memberPriceHour: number | null;
};

export type CourtPricing = {
  id: string;
  priceHour: number | null;
  memberPriceHour: number | null;
};

export type ClubPricing = {
  priceHour: number;
  memberPriceHour: number | null;
};

/** Tom liste betyder "alle". Det er den regel, klubberne selv forventer. */
function matches(list: string, value: string): boolean {
  const clean = list.trim();
  if (clean === "") return true;
  return clean
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(value);
}

/**
 * Gælder reglen for netop denne bane på netop dette tidspunkt?
 *
 * `toHour` er eksklusiv: en regel fra 17 til 21 dækker 17, 18, 19 og 20.
 * Det er sådan en klub siger det — "17 til 21" betyder fire timer, ikke
 * fem — og det er samme konvention som klubbens åbningstider.
 */
export function ruleApplies(
  rule: PriceRuleInput,
  courtId: string,
  startsAt: Date
): boolean {
  if (!matches(rule.courtIds, courtId)) return false;
  if (!matches(rule.daysOfWeek, String(startsAt.getDay()))) return false;
  const hour = startsAt.getHours();
  return hour >= rule.fromHour && hour < rule.toHour;
}

/**
 * Prisen for én time.
 *
 * Rammer flere regler samme time, vinder den første. Klubben bestemmer
 * rækkefølgen, så en specifik regel kan lægges over en bred — fx "alle
 * baner hverdage 17-21" med "hal 1 fredag 17-21" ovenover.
 */
export function priceFor(opts: {
  club: ClubPricing;
  court: CourtPricing;
  startsAt: Date;
  rules: PriceRuleInput[];
  isMember: boolean;
}): number {
  const { club, court, startsAt, rules, isMember } = opts;

  const rule = rules.find((r) => ruleApplies(r, court.id, startsAt));
  if (rule) {
    if (isMember && rule.memberPriceHour != null) return rule.memberPriceHour;
    if (!isMember) return rule.priceKr;
    // Medlem, men reglen har ingen medlemspris: fald ned ad trappen frem
    // for at give medlemmet gæsteprisen. En regel om prime time skal ikke
    // fjerne medlemsrabatten ved et uheld.
  }

  if (isMember && court.memberPriceHour != null) return court.memberPriceHour;
  if (isMember && club.memberPriceHour != null) return club.memberPriceHour;

  if (court.priceHour != null) return court.priceHour;
  return club.priceHour;
}
