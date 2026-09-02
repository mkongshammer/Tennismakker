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

/** Underleverandører, der behandler personoplysninger for os. */
export const PROCESSORS = [
  { name: "Render Services, Inc.", role: "drift af server og database", place: "servere i Frankfurt, EU" },
  { name: "Stripe, Inc.", role: "betalingsformidling", place: "USA" },
  { name: "Resend, Inc.", role: "udsendelse af kvitteringer og beskeder", place: "USA" },
] as const;
