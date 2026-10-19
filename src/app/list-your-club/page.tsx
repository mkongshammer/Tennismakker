import type { Metadata } from "next";
import { clubSignupPriceBook } from "../../lib/club-onboarding";
import { getPreferences } from "../../lib/preferences";
import { SignupForm } from "./SignupForm";
import { Icon } from "../../components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "List your club",
  description: "Set up court booking, payments and a public club page in minutes. $30/month, no commission on court bookings, no sales call.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const [{ locale }, query] = await Promise.all([getPreferences(), searchParams]);
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="eyebrow text-slate">For clubs and facilities</p>
        <h1 className="display mt-2 text-display-md sm:text-display-lg">Set up your club. Take your first booking today.</h1>
        <p className="mt-3 text-slate">Four short steps. Pay the subscription, we review the club, and your booking calendar goes live. Connect Stripe afterwards so guests can pay you.</p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
          {["No commission on court bookings", "Cancel any month", "Stripe payouts to your account"].map((item) => (
            <li key={item} className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-success" /> {item}</li>
          ))}
        </ul>
      </header>
      <SignupForm priceBook={await clubSignupPriceBook()} locale={locale} initialCountry="US" initialMode={query.plan === "CUSTOM" ? "CUSTOM" : "STANDARD"} />
    </div>
  );
}
