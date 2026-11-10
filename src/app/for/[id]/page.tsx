// A personal preview for one club on the sales list: the club already set up
// on RacketBuddy, with a one-click path to claim it. Linked from the sales
// e-mails as {{clubPage}}. Private (unguessable id) and never indexed.
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "../../../lib/db";
import { demoCalendar, leadForPreview, previewSports } from "../../../lib/club-preview";
import { priceCopy } from "../../../lib/price-copy";
import { sportColor, sportLabel } from "../../../lib/sports";
import { US_STATES } from "../../../../shared/us-address.mjs";
import { Icon, type IconName } from "../../../components/ui";
import { ViewBeacon } from "./ViewBeacon";
import { voteCount } from "../../../lib/club-votes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lead = await leadForPreview((await params).id);
  return {
    title: lead ? lead.clubName : "Club preview",
    robots: { index: false, follow: false },
  };
}

const HOURS = [7, 8, 9, 12, 17, 18, 19, 20];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "calendar", title: "Online booking", body: "Members and guests see open courts in real time and book in a tap, on the web or in the app." },
  { icon: "dollar", title: "Payments to your bank", body: "Court fees, dues and events are paid up front through your own Stripe account. No more chasing." },
  { icon: "members", title: "Members and dues", body: "Membership plans, member pricing, renewals and family accounts, all billed automatically." },
  { icon: "coach", title: "Coaches and clinics", body: "Lessons, clinics and season programs with sign-up and payment built in." },
  { icon: "star", title: "Leagues, ladders and events", body: "Tournaments with automatic draws, a club ladder and social events on your own courts." },
  { icon: "key", title: "Lights and door access", body: "Bookings switch on the lights and open the door. Works with the fobs and readers you already have." },
];

function stateCode(raw: string) {
  const v = raw.trim();
  const hit = US_STATES.find((s) => s.code === v.toUpperCase() || s.name.toLowerCase() === v.toLowerCase());
  return hit?.code ?? "";
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const lead = await leadForPreview(id);
  if (!lead) notFound();

  const sports = previewSports(lead.sport);
  const code = stateCode(lead.state);
  const place = [lead.city, code || lead.state].filter(Boolean).join(", ");
  const [price, demand, votes] = await Promise.all([
    priceCopy(),
    code ? db.marketInterest.count({ where: { state: code, kind: "COURTS" } }).catch(() => 0) : Promise.resolve(0),
    voteCount(id).catch(() => 0),
  ]);
  const courts = sports.length > 1 ? Math.min(4, sports.length + 2) : 4;
  const grid = demoCalendar(id, courts, HOURS);
  const courtSport = (i: number) => sports[i % sports.length];
  const claim = `/list-your-club?${new URLSearchParams({ club: lead.clubName, city: lead.city, state: code, ref: id })}`;
  const first = lead.clubName;

  return (
    <div className="space-y-12">
      <ViewBeacon id={id} />

      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="eyebrow text-court-light">Prepared for {first}</p>
          <h1 className="display mt-3 text-display-md sm:text-display-lg">{first}, on RacketBuddy.</h1>
          <p className="lead mt-4 max-w-xl">
            This is what your members and guests would see{place ? ` in ${place}` : ""}: open courts, prices and booking in one tap, paid up front. It’s a private preview. Nothing is public until you claim it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={claim} className="btn-court btn-lg">Claim {first} <Icon name="arrow" /></Link>
            <Link href="/switch" className="btn-ghost btn-lg">Check your member file free</Link>
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
            {["Live the same day", "No setup fee or contract", "No commission on court bookings"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-success" /> {t}</li>
            ))}
          </ul>
        </div>

        <div className="card p-0 overflow-hidden" aria-label={`Example booking calendar for ${first}`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate/10 px-5 py-4">
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-extrabold">{first}</p>
              <p className="truncate text-xs text-slate">{place || "Your club"} · Today</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {sports.slice(0, 3).map((s) => (
                <span key={s} className="badge" style={{ backgroundColor: `${sportColor(s)}22`, color: sportColor(s) }}>{sportLabel(s, "en-US")}</span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto px-5 py-4">
            <table className="w-full border-separate border-spacing-1.5 text-xs">
              <thead>
                <tr>
                  <th className="w-20 text-left font-semibold text-slate"> </th>
                  {HOURS.map((h) => <th key={h} className="data font-semibold text-slate">{hourLabel(h)}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.map((row, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap pr-1 font-semibold">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: sportColor(courtSport(i)) }} />
                      Court {i + 1}
                    </td>
                    {row.map((booked, j) => (
                      <td key={j} className={`h-9 min-w-[2.6rem] rounded-lg text-center align-middle data ${booked ? "bg-slate/10 text-slate" : "border border-court/40 bg-court/10 font-semibold text-court-light"}`}>
                        {booked ? "—" : "Open"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate">Example day. Your real courts, hours and prices are set when you claim the club.</p>
          </div>
        </div>
      </section>

      {votes > 0 && (
        <section className="card flex items-start gap-4 border-court/40">
          <Icon name="heart" className="mt-0.5 shrink-0 text-court-light" />
          <p><span className="font-bold">{votes} {votes === 1 ? "player has" : "players have"} voted to book {first} on RacketBuddy.</span> <span className="text-slate">Each one confirmed their email. They get a message the day you go live.</span></p>
        </section>
      )}

      {demand > 0 && (
        <section className="card flex items-start gap-4">
          <Icon name="bell" className="mt-0.5 shrink-0 text-court-light" />
          <p><span className="font-bold">{demand} {demand === 1 ? "player" : "players"} in {code}</span> <span className="text-slate">asked RacketBuddy to tell them when courts open near them. Once {first} is live, they get an email.</span></p>
        </section>
      )}

      <section>
        <h2 className="display text-2xl sm:text-3xl">Everything {first} runs on, in one place</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <Icon name={f.icon} className="text-court-light" />
              <p className="mt-3 font-bold">{f.title}</p>
              <p className="mt-1 text-sm text-slate">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate">Plus a member app for iPhone and Android, your own club website, member emails, pro shop and gift cards, staff schedule and reports for QuickBooks.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          <h2 className="display text-2xl">Switching takes an afternoon</h2>
          <ol className="mt-4 space-y-4">
            {[
              ["Claim the club", "Name, address, courts and price. Four short screens, about two minutes."],
              ["Bring your members", "Upload the export from CourtReserve, ClubReady, PlayByPoint or a spreadsheet. Check it for free first."],
              ["Invite them", "One button emails every member a link to set a password and get the app."],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-3">
                <span className="data flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-court/15 text-sm font-bold text-court-light">{i + 1}</span>
                <div><p className="font-semibold">{t}</p><p className="text-sm text-slate">{b}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="card flex flex-col">
          <p className="eyebrow text-slate">{price.founding.open ? "Founding-club price" : "One plan, everything included"}</p>
          <p className="mt-2"><span className="display text-4xl">${price.monthly}</span><span className="text-slate"> /month</span></p>
          <p className="mt-1 text-sm text-slate">or ${price.annual}/year{price.founding.open ? `, locked in for as long as you stay. ${price.founding.left} of ${price.founding.total} founding spots left, then $${price.regularMonthly}/month.` : "."}</p>
          <p className="mt-3 text-sm text-slate">No setup fee, no contract, no commission on court bookings. Cancel any month.</p>
          <Link href={claim} className="btn-court mt-5 justify-center">Claim {first} <Icon name="arrow" /></Link>
        </div>
      </section>

      <p className="text-center text-sm text-slate">
        Questions first? Just reply to my email, or write to <a className="font-semibold underline" href="mailto:magnus@racketbuddy.app">magnus@racketbuddy.app</a>. — Magnus, RacketBuddy
      </p>
    </div>
  );
}
