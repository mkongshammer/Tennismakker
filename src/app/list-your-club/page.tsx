import type { Metadata } from "next";
import { effectiveClubPriceBook } from "../../lib/club-onboarding";
import { priceCopy } from "../../lib/price-copy";
import { getPreferences } from "../../lib/preferences";
import { SignupForm } from "./SignupForm";
import { Icon } from "../../components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "List your club",
  description: "Set up court booking, payments and a public club page in minutes. One plan with everything included, no setup fee, no contract, no commission on court bookings.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string; club?: string; city?: string; state?: string; ref?: string }> }) {
  const [{ locale }, query] = await Promise.all([getPreferences(), searchParams]);
  const pre = (v: string | undefined, max: number) => String(v ?? "").slice(0, max);
  const price = await priceCopy();
  // From a personal club page: prefill the club's e-mail too (looked up by the page id, never put in the URL).
  const lead = query.ref ? await (await import("../../lib/club-preview")).leadForPreview(String(query.ref)).catch(() => null) : null;
  // Set up from the club's own e-mail reply: courts, price, hours and address are ready too.
  const prepared = lead && query.ref ? await (await import("../../lib/club-setup")).preparedSetup(String(query.ref)).catch(() => null) : null;
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="eyebrow text-slate">For clubs and facilities</p>
        <h1 className="display mt-2 text-display-md sm:text-display-lg">{query.club ? `Claim ${pre(query.club, 150)}. Take your first booking today.` : "Set up your club. Take your first booking today."}</h1>
        <p className="mt-3 text-slate">{query.club ? "Two short steps." : "Four short steps."} Pay the subscription, we review the club, and your booking calendar goes live. Connect Stripe afterwards so guests can pay you.</p>
        <p className="mt-2 text-sm text-slate">Coming from another system? <a href="/switch" className="font-semibold text-court-light underline">Check your member file for free first</a> — it imports with one click after payment.</p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
          {[`Everything included, ${price.short}`, "No setup fee, cancel any month", "No commission on court bookings"].map((item) => (
            <li key={item} className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-success" /> {item}</li>
          ))}
        </ul>
        {price.badge && <p className="mt-4 rounded-2xl border border-court/30 bg-court/10 px-4 py-3 text-sm"><span className="font-bold">Founding-club price:</span> {price.short}, locked in for as long as you stay. Only for the first {price.founding.total} clubs ({price.founding.left} spots left), then {`$${price.regularMonthly}`}/month or {`$${price.regularAnnual}`}/year.</p>}
      </header>
      <SignupForm priceBook={await effectiveClubPriceBook()} locale={locale} initialCountry="US" initialName={pre(query.club, 150)} initialCity={pre(query.city, 100)} initialState={/^[A-Z]{2}$/.test(query.state ?? "") ? query.state : ""} initialEmail={lead?.email ?? ""} prepared={prepared && prepared.courts.length && prepared.guestPrice ? { courts: prepared.courts, priceHour: prepared.guestPrice, openHour: prepared.openHour, closeHour: prepared.closeHour, street: prepared.street ?? "", zip: prepared.zip ?? "", contact: prepared.contactName ?? "" } : null} />
    </div>
  );
}
