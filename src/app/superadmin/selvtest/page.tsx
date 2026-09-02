// Selvtest-side. Kun for platformens ejer.
//
// Viser med ét blik, om betalingskæden virker — i stedet for at skulle
// klikke sig igennem en rigtig booking for at finde ud af det.
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../../lib/session";
import { runSelfTest } from "../../../lib/selftest";

export const dynamic = "force-dynamic";

const TONE = {
  ok: { dot: "bg-court", label: "OK" },
  advarsel: { dot: "bg-slate", label: "Bemærk" },
  fejl: { dot: "bg-court-dark", label: "Fejl" },
} as const;

export default async function SelvtestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-bold">Ikke adgang</p>
        <p className="mt-1 text-sm text-slate">Denne side er kun for RacketBuddys administratorer.</p>
      </div>
    );
  }

  const { checks, recipients } = await runSelfTest();
  const failures = checks.filter((c) => c.status === "fejl").length;
  const ready = recipients.filter((r) => r.chargesEnabled).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl">Selvtest</h1>
        <p className="text-slate">
          {failures === 0
            ? "Alle kritiske tjek er grønne."
            : `${failures} ${failures === 1 ? "tjek fejler" : "tjek fejler"}.`}{" "}
          {ready} af {recipients.length} modtagere kan tage imod penge.
        </p>
        <p className="mt-2 text-sm text-slate">
          Siden kører testen forfra, hver gang du åbner den. Testbetalingen
          opretter en session hos Stripe og lukker den igen med det samme —
          der bliver ikke trukket penge nogen steder.
        </p>
      </div>

      <section>
        <h2 className="display mb-3 text-2xl">Tjek</h2>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.name} className="card py-3">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE[c.status].dot}`} />
                <span className="font-bold">{c.name}</span>
                <span className="ml-auto text-xs font-semibold text-slate">
                  {TONE[c.status].label}
                </span>
              </div>
              <p className="mt-1.5 pl-[22px] text-sm text-slate">{c.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="display mb-1 text-2xl">Hvem kan modtage penge</h2>
        <p className="mb-3 text-sm text-slate">
          En klub eller træner kan først bookes, når Stripe-opsætningen er
          fuldført. Indtil da afvises bookinger, og tiderne tælles ikke med
          på forsiden.
        </p>

        {recipients.length === 0 ? (
          <p className="card text-slate">Ingen klubber eller trænere endnu.</p>
        ) : (
          <ul className="card divide-y divide-slate/10">
            {recipients.map((r) => (
              <li key={`${r.kind}-${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="text-xs font-semibold text-slate">{r.kind}</span>
                <span className="font-semibold">{r.name}</span>
                <span className="text-slate">{r.billing}</span>
                <span className="ml-auto font-bold">
                  {r.chargesEnabled ? (
                    <span className="text-court">Klar</span>
                  ) : r.hasAccount ? (
                    <span className="text-slate">Halvt igennem</span>
                  ) : (
                    <span className="text-slate">Ikke startet</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/superadmin/selvtest" className="btn-court">Kør testen igen</Link>
        <Link href="/superadmin/opsaetning" className="btn-ghost">Ret opsætningen</Link>
        <Link href="/superadmin" className="btn-ghost">Tilbage</Link>
      </div>
    </div>
  );
}
