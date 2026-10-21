import type { Metadata } from "next";
import { clubSignupPriceBook } from "../../lib/club-onboarding";
import { getPreferences } from "../../lib/preferences";
import { SignupForm } from "./SignupForm";
import { Icon } from "../../components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "List your club",
  description: "Set up court booking, payments and a public club page in minutes. One plan at $50/month with everything included, no setup fee, no contract, no commission on court bookings.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const [{ locale }] = await Promise.all([getPreferences(), searchParams]);
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="eyebrow text-slate">For clubs and facilities</p>
        <h1 className="display mt-2 text-display-md sm:text-display-lg">Set up your club. Take your first booking today.</h1>
        <p className="mt-3 text-slate">Four short steps. Pay the subscription, we review the club, and your booking calendar goes live. Connect Stripe afterwards so guests can pay you.</p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
          {["Everything included, $50/month or $500/year", "No setup fee, cancel any month", "No commission on court bookings"].map((item) => (
            <li key={item} className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-success" /> {item}</li>
          ))}
        </ul>
      </header>
      <SignupForm priceBook={await clubSignupPriceBook()} locale={locale} initialCountry="US" />
    </div>
  );
}
