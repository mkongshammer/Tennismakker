// Switching guide for clubs on another system, with the free import check.
import Link from "next/link";
import type { Metadata } from "next";
import { EXPORT_TIPS } from "../../lib/member-import";
import { ImportCheck } from "./ImportCheck";
import { PrintButton } from "./PrintButton";
import { priceCopy } from "../../lib/price-copy";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Switch your club to RacketBuddy",
  description: "Move your members from CourtReserve, ClubReady, PlayByPoint, Skedda or a spreadsheet in minutes. Check your member file for free before you pay.",
};

const steps = (price: string) => [
  { t: "Export your member list", b: "Download it from your current system as Excel or CSV. Tips for each system are below." },
  { t: "Run the free import check", b: "Upload the file here and see exactly who moves across. No account, no payment." },
  { t: "Set up your club", b: "Name, address, courts and price. Four short screens, about two minutes." },
  { t: "Pay and import with one click", b: `${price}. Your checked list imports straight away.` },
  { t: "Connect Stripe and invite members", b: "Payments go to your bank. One button e-mails every member a link to set their password and get the app." },
];

const MOVES = [
  ["Members", "Name, e-mail and phone, imported automatically. Existing RacketBuddy players are linked, not duplicated."],
  ["Membership types", "We read them from your file so you can recreate the plans (monthly, annual, family) in a minute. Members then pay online."],
  ["Courts, hours and prices", "Entered during signup; peak and member prices can be added after."],
  ["Future reservations", "Members simply rebook once you go live. Weekly regulars can be set up as recurring reservations in the admin."],
  ["Payments", "Through your own Stripe account. Card details can't be moved between systems, so members add a card at their first booking or renewal."],
];

const faq = (offer: string) => [
  ["How long does switching take?", "The setup itself takes a couple of minutes once your file is ready. Most clubs run both systems for a week, then switch members over with the invite e-mail."],
  ["Do I need a call or onboarding session?", "No. Everything is self-serve. If you get stuck, e-mail support@racketbuddy.app or ask the assistant on the site."],
  ["Will my members get e-mails I didn't approve?", "No. Importing sends nothing. Members only hear from RacketBuddy when you press “Invite members”."],
  ["What does it cost?", `${offer} No setup fee, no contract, no commission on court bookings. Standard Stripe card fees apply.`],
  ["Can I cancel?", "Yes, any month. There's no contract."],
];

const INCLUDED: Array<[string, string]> = [
  ["Court booking", "Online and in the app, with your own prices, opening hours, member and guest rules, and a public club page."],
  ["Members and dues", "Monthly, annual and family memberships, billed automatically. Member e-mails and bills with reminders."],
  ["Events and tournaments", "Clinics, leagues, ladders and tournaments with sign-ups, automatic draws, brackets, schedules and results."],
  ["Coaches and lessons", "Coaches publish their times, players book and pay for lessons online."],
  ["Player app", "Members book, get confirmations and reminders, find hitting partners and message each other. iPhone and Android."],
  ["Waitlists, waivers and check-in", "Waitlists for full courts, digital waivers, check-in and automatic release of no-shows."],
  ["Front desk", "Register for the pro shop and guests, card reader (Stripe Terminal), gift cards and member credit."],
  ["Staff", "Shift schedule, time clock with PIN, timesheets, overtime and payroll export."],
  ["Accounting and reports", "Each day's revenue posted to QuickBooks Online. Reports on bookings, revenue and members."],
  ["Door access", "Fobs and cards for members and staff, and Kisi integration so players open the door from their booking."],
  ["Club website", "A simple website for the club, on your own domain if you like."],
  ["Payments", "Players pay by card; the money goes straight to your own Stripe account. You keep 100% of court fees."],
];

export default async function SwitchPage() {
  const price = await priceCopy();
  const STEPS = steps(price.short), FAQ = faq(price.offer);
  return (
    <div className="mx-auto max-w-4xl space-y-12 print:space-y-6">
      <header className="space-y-4">
        <p className="eyebrow text-slate">Switching guide for clubs</p>
        <h1 className="display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05]">Move your club to RacketBuddy in an afternoon.</h1>
        <p className="lead max-w-2xl">Bring your members from CourtReserve, ClubReady, PlayByPoint, Skedda, Mindbody or a spreadsheet. Check your file for free first, and only pay when you've seen it works.</p>
        <div className="flex flex-wrap gap-3 print:hidden">
          <a href="#check" className="btn-court">Check my member file — free</a>
          <PrintButton />
        </div>
      </header>

      <section aria-labelledby="steps">
        <h2 id="steps" className="display text-display-md">Five steps</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card-flat flex gap-4">
              <span className="data flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-court text-sm font-bold text-white">{i + 1}</span>
              <div><p className="font-bold">{s.t}</p><p className="mt-1 text-sm text-slate">{s.b}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="export">
        <h2 id="export" className="display text-display-md">Step 1: export your member list</h2>
        <p className="mt-2 text-slate">Any list with an e-mail column works. Names, phone numbers and membership types are picked up automatically, whatever the columns are called. Don't edit the file.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EXPORT_TIPS.map((t) => (
            <div key={t.system} className="card-flat"><p className="font-semibold">{t.system}</p><p className="mt-1 text-sm text-slate">{t.steps}</p></div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate">Menu names differ between versions of each system. If you can't find the export, your current provider's help center will have it under "export members".</p>
      </section>

      <section className="print:hidden"><ImportCheck priceLabel={price.monthlyLabel} /></section>

      <section aria-labelledby="moves">
        <h2 id="moves" className="display text-display-md">What moves across</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {MOVES.map(([t, b]) => <div key={t} className="card-flat"><dt className="font-bold">{t}</dt><dd className="mt-1 text-sm text-slate">{b}</dd></div>)}
        </dl>
      </section>

      <section aria-labelledby="included">
        <h2 id="included" className="display text-display-md">Everything included for {`$${price.monthly}`} a month</h2>
        {price.badge && <p className="mt-2 inline-block rounded-full bg-[#D8FF3E] px-3 py-1 text-xs font-bold text-[#0F2138]">{price.badge}</p>}
        <p className="mt-2 text-sm text-slate">One booking and administration system for the whole club. No add-ons, no per-member fees, no commission on court bookings.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map(([t, b]) => <div key={t} className="card-flat"><dt className="font-bold">{t}</dt><dd className="mt-1 text-sm text-slate">{b}</dd></div>)}
        </dl>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className="display text-display-md">Questions</h2>
        <div className="mt-4 divide-y divide-slate/15">
          {FAQ.map(([q, a]) => <div key={q} className="py-4"><p className="font-semibold">{q}</p><p className="mt-1 text-sm text-slate">{a}</p></div>)}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center print:hidden">
        <h2 className="display text-display-md">Ready when you are</h2>
        <p className="mx-auto mt-2 max-w-xl text-slate">{price.offer} No setup fee, cancel any month.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/list-your-club" className="btn-court">Set up my club</Link><a href="#check" className="btn-ghost">Check my file first</a></div>
      </section>
      <p className="hidden text-xs print:block">racketbuddy.app/switch · support@racketbuddy.app</p>
    </div>
  );
}
