// Which language, time zone and currency a message is written in.
//
// The US deployment serves only the United States. Its users table still has
// the schema default locale "da" for any account created without an explicit
// choice (the seeded owner, accounts made by older builds), so trusting the
// stored locale there sent Danish password-reset e-mails to Americans. On the
// US deployment every message is American English; elsewhere the user's own
// locale applies, falling back to Danish as before.
import { deploymentRegion } from "./region";

const usDeployment = () => deploymentRegion() === "US";

export function messageLocale(locale?: string | null): string {
  if (usDeployment()) return "en-US";
  return locale || "da";
}

export function messageTimeZone(timeZone?: string | null): string {
  return timeZone || (usDeployment() ? "America/New_York" : "Europe/Copenhagen");
}

export function messageCurrency(currency?: string | null): string {
  return currency || (usDeployment() ? "USD" : "DKK");
}
