import Link from "next/link";

export default function AppPage() {
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <div className="card px-6 py-10 sm:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-court">RacketBuddy app</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Mobilappen er på vej</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate/70">
          Vi arbejder på RacketBuddy til iPhone og Android, så du snart kan finde medspillere,
          skrive beskeder, booke baner og holde styr på dine aktiviteter direkte fra mobilen.
        </p>
        <p className="mt-5 text-sm text-slate/60">
          Indtil da virker hele RacketBuddy direkte i din mobilbrowser.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/spillere" className="btn-court px-5 py-3">Find medspillere</Link>
          <Link href="/" className="btn-ghost px-5 py-3">Til forsiden</Link>
        </div>
      </div>
    </div>
  );
}
