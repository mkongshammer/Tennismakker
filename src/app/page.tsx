// The public home page.
//
// Five seconds in, a visitor should know: RacketBuddy is the easiest way to
// play racquet sports and the smartest way to run a club. Everything on the
// page is true today — no invented testimonials, no fake club counts.
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getPreferences } from "../lib/preferences";
import { clubSignupPrices } from "../lib/club-onboarding";
import { formatMoney } from "../lib/international";
import { SPORTS, sportLabel, sportColor } from "../lib/sports";
import { getSettings } from "../lib/settings";
import { DiscoverySearch } from "../components/discovery/DiscoverySearch";
import { parseDiscoveryFilters } from "../lib/discovery";
import { Ball } from "../components/Ball";
import { Icon, type IconName } from "../components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RacketBuddy — Reserve courts, book coaches, run your club",
  alternates: { canonical: "/" },
};

const JOURNEYS: { href: string; icon: IconName; tint: string; title: string; body: string; points: string[]; cta: string }[] = [
  {
    href: "/courts",
    icon: "court",
    tint: "bg-court-tint text-court-dark",
    title: "Players",
    body: "Find a court near you, see what’s open today and pay in one go.",
    points: ["Search by city, state or ZIP", "Real-time availability and clear hourly prices", "Instant confirmation, 24-hour cancellation"],
    cta: "Reserve a court",
  },
  {
    href: "/coaches",
    icon: "coach",
    tint: "bg-[#edf3e6] text-grass",
    title: "Coaches",
    body: "A professional profile, bookable availability and payouts straight to you.",
    points: ["Set your rate, lesson length and weekly hours", "Students book and pay without the back-and-forth", "Lesson packages and automatic payouts"],
    cta: "Find a coach",
  },
  {
    href: "/list-your-club",
    icon: "members",
    tint: "bg-[#fff0e5] text-clay",
    title: "Clubs",
    body: "Run the whole facility from one place — bookings, members, payments, even the lights.",
    points: ["Self-serve setup, live the same day", "Stripe payouts to your club’s own account", "$30/month, no commission on court bookings"],
    cta: "List your club",
  },
];

const HOW = [
  { step: "01", title: "Search", body: "Enter a city, state or ZIP and pick your sport." },
  { step: "02", title: "Pick a time", body: "Every open hour is a court tile. Tap the one you want." },
  { step: "03", title: "Pay", body: "See the total before you pay. Secure checkout by Stripe." },
  { step: "04", title: "Play", body: "Confirmation and access details land in your inbox and on your profile." },
];

const CLUB_FEATURES: { icon: IconName; title: string; body: string; plan: "Standard" | "Custom" }[] = [
  { icon: "calendar", title: "Court calendar", body: "Hours, courts, surfaces and prices. Release times to guests, keep members first.", plan: "Standard" },
  { icon: "dollar", title: "Payments", body: "Stripe Connect payouts to the club’s own account. Receipts, refunds and reporting built in.", plan: "Standard" },
  { icon: "members", title: "Members and memberships", body: "Plans, seasons, renewals and member pricing. Import from your current system.", plan: "Custom" },
  { icon: "access", title: "Lights and door access", body: "Bookings switch on court lights and open the door for the right person at the right time.", plan: "Custom" },
  { icon: "website", title: "Club website", body: "A clean public page on your own domain with news, photos and booking built in.", plan: "Custom" },
  { icon: "sparkle", title: "Recurring reservations", body: "Fixed weekly courts, teams and clinics, without re-entering them every week.", plan: "Custom" },
];

function CourtTiles() {
  // A small, honest rendering of the product's signature: open hours as pieces of court.
  const hours = ["7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"];
  const taken = new Set(["9:00 AM", "6:00 PM"]);
  return (
    <div className="grid grid-cols-4 gap-2" aria-hidden="true">
      {hours.map((h) => (
        <div key={h} className={`flex h-16 flex-col justify-center rounded-xl px-3 ${taken.has(h) ? "border border-dashed border-slate/30 bg-mist text-slate" : "court-tile"}`} style={{ ["--sport" as string]: "#1B62C4" }}>
          <span className="data text-xs font-bold">{h}</span>
          <span className={`text-[11px] ${taken.has(h) ? "" : "text-chalk"}`}>{taken.has(h) ? "Booked" : "$38"}</span>
        </div>
      ))}
    </div>
  );
}

export default async function Home() {
  const [prefs, settings] = await Promise.all([getPreferences(), getSettings()]);
  const prices = await clubSignupPrices("US");
  const monthly = formatMoney(prices.standard, prices.currency, "en-US");
  const setup = prices.custom == null ? null : formatMoney(prices.custom, prices.currency, "en-US");
  const filters = parseDiscoveryFilters({}, prefs.sport);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "RacketBuddy", url: settings.appUrl, logo: `${settings.appUrl}/icon.png`, areaServed: "US" },
      {
        "@type": "WebSite",
        name: "RacketBuddy",
        url: settings.appUrl,
        potentialAction: { "@type": "SearchAction", target: `${settings.appUrl}/courts?q={search_term_string}`, "query-input": "required name=search_term_string" },
      },
      {
        "@type": "SoftwareApplication",
        name: "RacketBuddy for clubs",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        offers: { "@type": "Offer", price: prices.standard, priceCurrency: "USD", description: "Standard plan, per club per month" },
      },
    ],
  };

  return (
    <div className="landing space-y-20 md:space-y-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-14">
        <div className="min-w-0">
          <p className="eyebrow text-slate">Courts · Coaches · Clubs · United States</p>
          <h1 className="display mt-4 text-[clamp(2.6rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.04em]">
            Your next court,
            <br />
            <span className="text-court">one tap away.</span>
          </h1>
          <p className="lead mt-6 max-w-xl">
            RacketBuddy is the easiest way to play racquet sports and the smartest way to run a club. Reserve tennis, pickleball and padel courts, book a coach, find a hitting partner.
          </p>
          <div className="mt-8">
            <DiscoverySearch filters={filters} compact placeholder="Where do you want to play? City, state or ZIP" />
          </div>
          <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate">
            {SPORTS.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <Ball sport={s} size={22} />
                {sportLabel(s, "en-US")}
              </li>
            ))}
          </ul>
        </div>
        <figure className="relative isolate overflow-hidden rounded-3xl bg-[#e2e9df]">
          <Image src="/images/club-life-hero.webp" alt="Tennis players beside a clubhouse in the afternoon sun" width={1536} height={1024} priority unoptimized className="h-[300px] w-full object-cover sm:h-[400px] lg:h-[520px]" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-6 pb-6 pt-20 text-white">
            <p className="text-lg font-semibold">More time on court. Less time arranging it.</p>
          </figcaption>
        </figure>
      </section>

      {/* Three doors */}
      <section aria-labelledby="journeys-title">
        <div className="max-w-2xl">
          <p className="eyebrow text-slate">One product, three doors</p>
          <h2 id="journeys-title" className="display mt-3 text-display-md sm:text-display-lg">Built for everyone who shows up to play.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {JOURNEYS.map((j) => (
            <article key={j.href} className="card-interactive flex flex-col rounded-3xl border border-slate/15 bg-chalk p-6">
              <span className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${j.tint}`}>
                <Icon name={j.icon} size={24} />
              </span>
              <h3 className="display text-title">{j.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{j.body}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {j.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Icon name="check" size={18} className="mt-0.5 shrink-0 text-court" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <Link href={j.href} className="btn-ghost mt-6 justify-between">
                {j.cta}
                <Icon name="arrow" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* How booking works */}
      <section className="grid items-center gap-10 rounded-3xl bg-chalk p-6 sm:p-10 lg:grid-cols-[.9fr_1.1fr]" aria-labelledby="how-title">
        <div>
          <p className="eyebrow text-slate">Booking a court</p>
          <h2 id="how-title" className="display mt-3 text-display-md sm:text-display-lg">Search. Pick a time. Pay. Play.</h2>
          <p className="mt-4 text-slate">No account needed to look. No phone call needed to book. Prices include the club’s fee — the number you see is the number you pay.</p>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2">
            {HOW.map((h) => (
              <li key={h.step}>
                <span className="data text-sm font-bold text-court">{h.step}</span>
                <p className="mt-1 font-bold">{h.title}</p>
                <p className="mt-1 text-sm text-slate">{h.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-3xl bg-mist p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-bold">Brookline Racquet Club</span>
            <span className="badge-success">Open today</span>
          </div>
          <div className="mb-3 flex gap-2 text-xs font-semibold">
            <span className="rounded-full bg-ink px-3 py-1.5 text-chalk">Today</span>
            <span className="rounded-full border border-slate/20 px-3 py-1.5 text-slate">Tomorrow</span>
            <span className="rounded-full border border-slate/20 px-3 py-1.5 text-slate">Wed</span>
          </div>
          <CourtTiles />
          <p className="mt-3 text-xs text-slate">Illustration of the booking grid. Live clubs show real courts and times.</p>
        </div>
      </section>

      {/* Clubs */}
      <section id="for-clubs" className="rounded-3xl bg-ink px-6 py-10 text-chalk sm:px-10 sm:py-14" aria-labelledby="clubs-title">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <p className="eyebrow text-optic">For clubs and facilities</p>
            <h2 id="clubs-title" className="display mt-4 max-w-xl text-display-md sm:text-display-lg">The modern operating system for a racquet club.</h2>
            <p className="mt-5 max-w-xl leading-relaxed text-white/75">
              Court management software shouldn’t need a sales call, a training day and a six-month contract. Set up your facility yourself, connect Stripe, and take your first booking today. Your members keep their priority; guests fill the gaps.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/list-your-club" className="btn bg-white text-ink hover:bg-mist">
              Set up your club
              <Icon name="arrow" />
            </Link>
            <Link href="#pricing" className="btn border border-white/25 text-chalk hover:bg-white/10">See pricing</Link>
          </div>
        </div>
        <div className="mt-10 grid gap-6 border-t border-white/15 pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {CLUB_FEATURES.map((f) => (
            <div key={f.title}>
              <div className="flex items-center gap-3">
                <span className="text-optic"><Icon name={f.icon} size={24} /></span>
                <span className="text-xs font-semibold text-white/60">{f.plan}</span>
              </div>
              <h3 className="mt-4 text-lg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-title">
        <div className="max-w-2xl">
          <p className="eyebrow text-slate">Pricing</p>
          <h2 id="pricing-title" className="display mt-3 text-display-md sm:text-display-lg">One simple price. No commission on court bookings.</h2>
          <p className="mt-3 text-slate">Court revenue goes to your club’s own Stripe account. Coaches pay a small platform fee per lesson; clubs don’t.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-3xl border border-slate/20 bg-chalk p-6 sm:p-8">
            <h3 className="text-title">Standard</h3>
            <p className="mt-5">
              <span className="display text-display-lg">{monthly}</span>
              <span className="ml-1 text-sm text-slate">/month</span>
            </p>
            <p className="mt-4 flex-1 leading-relaxed text-slate">Courts, hours, pricing, guest and member booking, Stripe payouts, receipts and your public club page.</p>
            <Link href="/list-your-club?plan=STANDARD" className="btn-ghost mt-7">Start with Standard</Link>
          </div>
          <div className="relative flex flex-col rounded-3xl border-2 border-court bg-chalk p-6 sm:p-8">
            <span className="absolute -top-3 left-6 badge-court">Most complete</span>
            <h3 className="text-title">Custom</h3>
            {setup && (
              <p className="mt-5">
                <span className="display text-display-lg">{setup}</span>
                <span className="ml-2 text-sm text-slate">one-time setup</span>
              </p>
            )}
            <p className="mt-2 text-sm font-semibold text-court">plus {monthly}/month</p>
            <p className="mt-4 flex-1 leading-relaxed text-slate">Everything in Standard plus the Custom features your club picks: memberships, teams, lights and door access, wallet and pricing rules, club website, recurring reservations and data import. One setup price however many you choose.</p>
            <Link href="/list-your-club?plan=CUSTOM" className="btn-court mt-7">Choose Custom</Link>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-slate">RacketBuddy serves US clubs and bills in USD. Applicable sales tax, card processing fees, hardware and third-party services may be extra. Your total is shown before you pay.</p>
      </section>

      {/* Steps for clubs */}
      <section aria-labelledby="steps-title">
        <h2 id="steps-title" className="display text-display-md sm:text-display-lg">Live before lunch.</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            { title: "Choose a plan", body: "Standard, or Custom with the features you need." },
            { title: "Add your facility", body: "Address, sports, courts, hours and prices. Autofill does most of it." },
            { title: "Connect payments", body: "Stripe onboarding takes about ten minutes. Payouts go to your account." },
            { title: "Publish", body: "After a quick review, your club page and booking calendar go live." },
          ].map((step, index) => (
            <li key={step.title} className="border-t border-slate/20 pt-5">
              <span className="data text-sm font-bold text-court">0{index + 1}</span>
              <h3 className="mt-3 text-title">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]" aria-labelledby="faq-title">
        <h2 id="faq-title" className="display max-w-sm text-display-md sm:text-display-lg">Good to know before you play.</h2>
        <div className="divide-y divide-slate/15 border-y border-slate/15">
          {[
            { q: "Is RacketBuddy only for clubs?", a: "No. Players reserve courts, book coaches and find hitting partners. Clubs get the tools to run the facility and get found." },
            { q: "Do I need a membership to book?", a: "That depends on the club. Each club decides what members and guests can book and at what price. You see the price and availability before you reserve." },
            { q: "What does it cost a player?", a: "Nothing beyond the club’s court price or the coach’s lesson price. There are no booking fees added at checkout." },
            { q: "How do refunds work?", a: "Cancel at least 24 hours before your start time and you get a full refund to your card. Later than that, the club keeps the booking." },
            { q: "Which sports?", a: SPORTS.map((s) => sportLabel(s, "en-US")).join(", ") + "." },
            { q: "Is there an app?", a: "Yes — RacketBuddy for iPhone and Android uses the same account, bookings and messages as the website." },
          ].map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex min-h-6 cursor-pointer list-none items-start justify-between gap-4 font-semibold">
                <span>{item.q}</span>
                <span aria-hidden="true" className="text-xl font-normal text-slate transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 pr-7 text-sm leading-relaxed text-slate">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="rounded-3xl bg-[#eaf0e5] px-6 py-12 text-center sm:px-10 sm:py-16">
        <h2 className="display mx-auto max-w-3xl text-display-md sm:text-display-lg">A home for your club. More room for your game.</h2>
        <p className="mx-auto mt-4 max-w-xl text-slate">Set up your club in minutes, or find a court, a coach or a partner for your next hour on court.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/list-your-club" className="btn-ink">List your club</Link>
          <Link href="/courts" className="btn-ghost">Reserve a court</Link>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2" aria-hidden="true">
          {SPORTS.map((s) => (
            <span key={s} className="h-2 w-10 rounded-full" style={{ backgroundColor: sportColor(s) }} />
          ))}
        </div>
      </section>
    </div>
  );
}
