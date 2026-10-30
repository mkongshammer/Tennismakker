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

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const [{ locale }] = await Promise.all([getPreferences(), searchParams]);
  const price = await priceCopy();
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="eyebrow text-slate">For clubs and facilities</p>
        <h1 className="display mt-2 text-display-md sm:text-display-lg">Set up your club. Take your first booking today.</h1>
        <p className="mt-3 text-slate">Four short steps. Pay the subscription, we review the club, and your booking calendar goes live. Connect Stripe afterwards so guests can pay you.</p>
        <p className="mt-2 text-sm text-slate">Coming from another system? <a href="/switch" className="font-semibold text-court-light underline">Check your member file for free first</a> — it imports with one click after payment.</p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
          {[`Everything included, ${price.short}`, "No setup fee, cancel any month", "No commission on court bookings"].map((item) => (
            <li key={item} className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-success" /> {item}</li>
          ))}
        </ul>
        {price.badge && <p className="mt-4 rounded-2xl border border-court/30 bg-court/10 px-4 py-3 text-sm"><span className="font-bold">Founding-club price:</span> {price.short}, locked in for as long as you stay. Only for the first {price.founding.total} clubs ({price.founding.left} spots left), then {`$${price.regularMonthly}`}/month or {`$${price.regularAnnual}`}/year.</p>}
      </header>
      <SignupForm priceBook={await effectiveClubPriceBook()} locale={locale} initialCountry="US" />
    </div>
  );
}
