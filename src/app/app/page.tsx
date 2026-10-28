import Link from "next/link";
import { StoreBadges, APP_STORE_URL } from "../../components/landing/StoreBadges";

export default function AppPage() {
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <div className="card px-6 py-10 sm:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-court">RacketBuddy app</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Your next court, in your pocket</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate">
          Reserve courts, book coaches, find hitting partners and get reminders before you play. Visiting the US? Download the app and book an open court wherever you are.
        </p>
        <StoreBadges className="mt-7 justify-center" />
        {!APP_STORE_URL && <p className="mt-4 text-sm text-slate">The iPhone app is in review with Apple and coming soon. Until then, everything works in your phone's browser.</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/courts" className="btn-court px-5 py-3">Reserve a court</Link>
          <Link href="/" className="btn-ghost px-5 py-3">Home</Link>
        </div>
      </div>
    </div>
  );
}
