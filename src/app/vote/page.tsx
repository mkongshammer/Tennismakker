// Players vote their club onto RacketBuddy. Clubs hear about it at 3, 10, 25…
// confirmed votes, with a link to their private, ready-made club page.
import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/session";
import { VoteForm } from "./VoteForm";
import { Icon, Notice } from "../../components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vote your club onto RacketBuddy",
  description: "Wish you could book your club’s courts in an app? Vote for it. When enough players ask, we tell the club, and you get one email when it’s bookable.",
  alternates: { canonical: "/vote" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ vote?: string; q?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <header>
        <p className="eyebrow text-court-light">For players</p>
        <h1 className="display mt-3 text-display-md sm:text-display-lg">Want to book your club on RacketBuddy? Vote for it.</h1>
        <p className="lead mt-4">Still calling the front desk or juggling a clunky booking site? Tell us which club you’d like to book in a tap. When enough players ask, we let the club know, with a page that’s ready to go.</p>
        <ol className="mt-6 space-y-4">
          {[
            ["Pick your club", "Search our list of US racquet clubs, or type it in."],
            ["Confirm your email", "Only real players count, so the club can trust the number."],
            ["We tell the club", "At 3, 10, 25 and more votes, the club gets an email with the count."],
            ["Book when it’s live", "You get one email the day you can book."],
          ].map(([t, b], i) => (
            <li key={t} className="flex gap-3">
              <span className="data flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-court/15 text-sm font-bold text-court-light">{i + 1}</span>
              <div><p className="font-semibold">{t}</p><p className="text-sm text-slate">{b}</p></div>
            </li>
          ))}
        </ol>
      </header>
      <section className="card space-y-4">
        {query.vote === "confirmed" && <Notice tone="success">Thanks, your vote counts now. We’ll email you when the club is bookable.</Notice>}
        {query.vote === "already" && <Notice tone="success">Your vote was already confirmed. Thanks!</Notice>}
        {query.vote === "invalid" && <Notice tone="warning">That confirmation link didn’t work. Vote again below and we’ll send a new one.</Notice>}
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-court/15 text-court-light"><Icon name="heart" size={22} /></span>
          <h2 className="display text-xl">Vote for a club</h2>
        </div>
        <VoteForm email={user?.email ?? ""} initialQuery={String(query.q ?? "").slice(0, 80)} />
      </section>
    </div>
  );
}
