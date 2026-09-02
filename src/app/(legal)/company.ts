// Selskabets oplysninger ét sted.
//
// Stod før spredt ud over tre dokumenter som pladsholdere. Ét sted betyder,
// at en adresseændring ikke kan efterlade en gammel adresse i det ene
// dokument og en ny i det andet — og i jura er det netop den slags
// uoverensstemmelser, der bliver dyre.

export const COMPANY = {
  name: "RacketBuddy LLC",
  registration: "registreret i staten Delaware, USA",
  address: "8 The Green, Ste D, Dover, DE 19901, USA",
  email: "racketbuddy.app@gmail.com",
} as const;

/**
 * EU-repræsentant efter databeskyttelsesforordningens artikel 27.
 *
 * Et selskab uden for EU, der tilbyder tjenester til folk i EU, skal have en
 * kontakt inde i EU, som myndigheder og brugere kan henvende sig til på
 * deres eget kontinent. Uden den er der ingen at skrive til, og forordningen
 * gælder alligevel.
 */
export const EU_REPRESENTATIVE = {
  name: "Magnus Kongshammer",
  email: "m.kongshammer@icloud.com",
  country: "Danmark",
} as const;

/** Underleverandører, der behandler personoplysninger for os. */
export const PROCESSORS = [
  { name: "Render Services, Inc.", role: "drift af server og database", place: "servere i Frankfurt, EU" },
  { name: "Stripe, Inc.", role: "betalingsformidling", place: "USA" },
  { name: "Resend, Inc.", role: "udsendelse af kvitteringer og beskeder", place: "USA" },
] as const;
