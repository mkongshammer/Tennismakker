import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "See it in action",
  description: "What RacketBuddy looks like for a club and its players: the public club page, booking on a phone, and the court schedule in the club admin.",
};

const SHOTS = [
  {
    src: "/demo/club-page.png", w: 1280, h: 860,
    title: "Your club page",
    body: "Players find your club in court search, see open times and prices, and reserve a court in a few taps. No account needed to look.",
  },
  {
    src: "/demo/player-booking.png", w: 390, h: 780, phone: true,
    title: "Booking on a phone",
    body: "Members see member prices automatically, pay by card, and get a confirmation and reminders. Works in the browser and in the RacketBuddy app.",
  },
  {
    src: "/demo/admin-schedule.png", w: 1280, h: 860,
    title: "The court schedule, for the front desk",
    body: "Every court and hour at a glance. Paid bookings, holds waiting for payment, and times you've released to guests. Cancel and refund in one click.",
  },
];

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-14">
      <header className="max-w-2xl">
        <p className="eyebrow text-slate">Demo</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">See RacketBuddy with a sample club.</h1>
        <p className="mt-4 text-lg text-slate">This is what your club and your players get. The club, courts and bookings below are example data.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/list-your-club" className="btn-court">Set up your club</Link>
          <Link href="/switch" className="btn-ghost">Check your member file for free</Link>
        </div>
      </header>
      {SHOTS.map((s, i) => (
        <section key={s.src} className={`grid items-center gap-8 ${s.phone ? "md:grid-cols-[1fr_320px]" : ""}`}>
          <div className={s.phone ? "md:order-2" : ""}>
            <p className="text-sm font-semibold text-court-light">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="display mt-1 text-2xl sm:text-3xl">{s.title}</h2>
            <p className="mt-3 max-w-2xl text-slate">{s.body}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.src} width={s.w} height={s.h} alt={s.title} loading={i ? "lazy" : "eager"}
            className={`w-full rounded-2xl border border-white/10 shadow-pop ${s.phone ? "mx-auto max-w-[320px] md:order-1" : ""}`} />
        </section>
      ))}
      <section className="card flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="display text-2xl">Ready to try it with your own courts?</h2>
          <p className="mt-1 text-slate">Set-up takes a few minutes. No setup fee, no contract, cancel any month.</p>
        </div>
        <Link href="/list-your-club" className="btn-court">Set up your club</Link>
      </section>
    </div>
  );
}
