// After signup: where the club stands on the way to going live.
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../lib/session";
import { getPreferences } from "../../lib/preferences";
import { formatMoney } from "../../lib/international";
import { phrase } from "../../lib/phrases";
import { db } from "../../lib/db";
import { refreshClubSignup } from "../../lib/club-onboarding";
import { checkClubSignup } from "../../lib/club-onboarding-actions";
import { CUSTOM_FEATURES } from "../../lib/club-features";
import { PayForm } from "./PayForm";
import { ClubInvoices } from "../../components/ClubInvoices";
import { Icon, Notice } from "../../components/ui";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ betaling?: string }> }) {
  const u = await getCurrentUser();
  if (u?.role !== "CLUB_ADMIN" || !u.clubId) redirect("/login");
  const { locale } = await getPreferences();
  const money = (n: number) => formatMoney(n, club.billingCurrency, locale);
  let club = await db.club.findUniqueOrThrow({ where: { id: u.clubId } });
  if (!club.signupManaged) redirect("/admin");
  let error = "";
  const query = await searchParams;
  if (query.betaling === "kontroller") {
    try {
      club = await refreshClubSignup(club.id);
    } catch {
      error = "Payment status could not be refreshed. Try again in a moment.";
    }
  }
  const paid = Boolean(club.signupPaidAt) && club.subscriptionStatus === "active";
  const approved = club.status === "APPROVED";
  const needsPaymentUpdate = Boolean(club.subscriptionId) && !["canceled", "incomplete_expired", "active"].includes(club.subscriptionStatus ?? "");
  const canPay = !paid && club.status !== "REJECTED" && (!club.subscriptionId || ["canceled", "incomplete_expired"].includes(club.subscriptionStatus ?? ""));
  const features: string[] = club.customFeatures ? (JSON.parse(club.customFeatures) as string[]) : [];

  const steps = [
    { title: "Club and login created", done: true, body: `RacketBuddy for clubs · ${money(club.subscriptionKr)}/month, cancel anytime${club.signupSetupKr > 0 ? ` + ${money(club.signupSetupKr)} once${club.signupSetupPaidAt ? " (paid)" : ""}` : ""}` },
    { title: "Subscription paid", done: paid, body: paid ? "Payment confirmed." : query.betaling === "afbrudt" ? "Payment was cancelled. Nothing was charged." : "Secure checkout by Stripe. The total, including any sales tax, is shown before you pay." },
    { title: "Club reviewed and live", done: approved, body: approved ? "Your club is public and bookable." : club.status === "REJECTED" ? club.reviewNote ?? "Contact RacketBuddy about your registration." : "We review every new club, usually within one business day, and switch it on." },
    { title: "Payouts connected", done: club.stripeChargesEnabled, body: club.stripeChargesEnabled ? "Guests can pay you." : "Connect Stripe from Payments in the admin so bookings can be paid out to the club." },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="eyebrow text-slate">Club setup</p>
        <h1 className="display mt-1 text-display-md sm:text-display-lg">{club.name}</h1>
        <p className="mt-2 text-slate">{approved ? "You’re live. Open the admin to release times and connect payouts." : paid ? "Payment received — we’re reviewing your club now." : "Your club login is ready. Pay the subscription to start the review."}</p>
      </header>

      {error && <Notice tone="warning">{error}</Notice>}
      {needsPaymentUpdate && <Notice tone="warning" title="Update your payment card">The club is shown again as soon as the payment is confirmed. Use the billing portal from Payments in the admin.</Notice>}

      <ol className="card-flat divide-y divide-slate/10">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step.done ? "bg-success text-chalk" : "bg-mist text-slate"}`}>{step.done ? <Icon name="check" size={16} strokeWidth={2.6} /> : index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{step.title}</p>
              <p className="mt-0.5 text-sm text-slate">{step.body}</p>
              {index === 1 && canPay && <div className="mt-3"><PayForm /></div>}
              {index === 3 && approved && !club.stripeChargesEnabled && <Link href="/admin/betaling" className="btn-court btn-sm mt-3">Connect payouts</Link>}
            </div>
          </li>
        ))}
      </ol>

      {features.length > 0 && features.length < CUSTOM_FEATURES.length && (
        <p className="text-sm text-slate"><span className="font-semibold text-ink">Included modules:</span> {CUSTOM_FEATURES.filter((f) => features.includes(f.id)).map((f) => phrase(f.label, locale)).join(" · ")}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {approved && <Link className="btn-court" href="/admin">Open club administration</Link>}
        {club.subscriptionId && <Link className="btn-ghost" href="/admin/betaling">Subscription and billing</Link>}
        <form action={checkClubSignup}><button className="btn-ghost">Refresh payment status</button></form>
      </div>

      <p className="text-xs leading-relaxed text-slate">Sign in here or under Club login in the app to check status. Lights and door access need your equipment connected and tested. Receiving payments from players requires completing payout setup in the admin.</p>

      <ClubInvoices clubId={club.id} locale={locale} timeZone={club.timeZone} />
    </div>
  );
}
