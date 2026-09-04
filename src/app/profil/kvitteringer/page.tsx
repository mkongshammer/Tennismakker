// Kvitteringer.
//
// Alt personen har betalt hos os, ét sted. Halbooking kalder det Fakturaer
// og Kvitteringer; vi kalder det kvitteringer, fordi det er dét, det er —
// en rigtig faktura kræver et fortløbende nummer pr. klub, og det er
// klubbens bogføringsforpligtelse, ikke vores.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/session";
import { receiptsFor } from "../../../lib/receipts";

export const dynamic = "force-dynamic";

export default async function KvitteringerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const receipts = await receiptsFor(user.id);
  const total = receipts.reduce((sum, r) => sum + r.amountKr, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl">Kvitteringer</h1>
        <p className="text-slate">
          Alt du har betalt gennem RacketBuddy. Gem siden som PDF med
          udskriv, hvis du skal bruge den til dit regnskab.
        </p>
      </div>

      {receipts.length === 0 ? (
        <p className="card text-slate">Du har ikke betalt for noget endnu.</p>
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate/15 text-left">
                  <th className="py-2 pr-3 font-bold">Dato</th>
                  <th className="py-2 pr-3 font-bold">Type</th>
                  <th className="py-2 pr-3 font-bold">Hvad</th>
                  <th className="py-2 pr-3 font-bold">Hos</th>
                  <th className="py-2 text-right font-bold">Beløb</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="border-b border-slate/10">
                    <td className="py-2 pr-3 whitespace-nowrap font-data tabular-nums">
                      {r.date.toLocaleDateString("da-DK")}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.kind}</td>
                    <td className="py-2 pr-3">{r.description}</td>
                    <td className="py-2 pr-3">{r.clubOrCoach}</td>
                    <td className="py-2 text-right font-data tabular-nums">
                      {r.amountKr.toLocaleString("da-DK")} kr
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="py-3 font-bold" colSpan={4}>
                    I alt
                  </td>
                  <td className="py-3 text-right font-data font-bold tabular-nums">
                    {total.toLocaleString("da-DK")} kr
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-sm text-slate">
            Beløbene er dem, du har betalt. Betaler du med klip fra et
            klippekort, står timen ikke her — den blev betalt, da kortet blev
            købt.
          </p>
        </>
      )}

      <Link href="/profil" className="btn-ghost inline-block">
        Tilbage til profilen
      </Link>
    </div>
  );
}
