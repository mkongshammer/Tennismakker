// The club price as it appears in page copy: the founding-club offer while
// spots are left, then the regular price. Pages that use it revalidate every
// few minutes, so the text changes by itself when the 25th club signs up.
import { usPricing } from "./club-onboarding";

export async function priceCopy() {
  const p = await usPricing();
  const short = `$${p.monthly}/month or $${p.annual}/year`;
  const founding = p.founding.open;
  return {
    ...p,
    short,
    monthlyLabel: `$${p.monthly}/month`,
    /** One sentence for headers and FAQs. */
    offer: founding
      ? `Founding-club price: $${p.monthly} a month or $${p.annual} a year, locked in for as long as you stay. Only for the first ${p.founding.total} clubs (${p.founding.left} spots left), then $${p.regularMonthly} a month.`
      : `$${p.monthly} a month or $${p.annual} a year for everything.`,
    /** Short badge, or null once the founding spots are gone. */
    badge: founding ? `Founding clubs: $${p.monthly}/month for life · ${p.founding.left} of ${p.founding.total} spots left` : null,
  };
}
