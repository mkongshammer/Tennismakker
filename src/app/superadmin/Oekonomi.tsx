// What came in, reported in USD the way a US company reads it.
//
// Recurring revenue (subscriptions) and transaction revenue (bookings through
// the platform) are kept apart: MRR is what runs right now, the table is what
// actually came in during each period.
import { economy } from "../../lib/analytics";

export async function Oekonomi() {
  const { periods, rows, kpis, otherCurrencies, subscribers } = await economy();

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl">Nøgletal</h2>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate">Alle beløb i USD</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label} className="card">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate">{k.label}</p>
              <p className="mt-2 font-data text-3xl font-bold tabular-nums">{k.value}</p>
              {k.note ? <p className="mt-1 text-xs text-slate">{k.note}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="display text-xl">Betalinger gennem platformen</h2>
        <p className="mt-1 text-sm text-slate">
          Kun gennemførte betalinger for baner, hold og events. Vores provision er før Stripes gebyr, som trækkes fra den, ikke fra klubbens del. Abonnementer står under nøgletal.
        </p>
        <div className="mt-4 -mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate/15">
                <th className="py-2 pr-3 text-left font-bold"> </th>
                {periods.map((p) => (
                  <th key={p.key} className="py-2 pl-3 text-right font-bold whitespace-nowrap">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-slate/10 last:border-0">
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{row.label}</span>
                    {row.note ? <span className="ml-2 text-xs text-slate">{row.note}</span> : null}
                  </td>
                  {row.values.map((value, i) => (
                    <td key={periods[i].key} className="py-2 pl-3 text-right font-data tabular-nums whitespace-nowrap">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {otherCurrencies.length ? (
          <p className="mt-3 text-xs text-slate">Ikke medregnet: ældre betalinger i andre valutaer ({otherCurrencies.join(", ")}).</p>
        ) : null}
      </section>

      <section className="card">
        <h2 className="display text-xl">Betalende klubber</h2>
        {subscribers.length === 0 ? (
          <p className="mt-2 text-sm text-slate">Ingen betalende klubber endnu. Den første vises her, så snart betalingen er gået igennem i Stripe.</p>
        ) : (
          <div className="mt-4 -mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate/15 text-left">
                  <th className="py-2 pr-3 font-bold">Klub</th>
                  <th className="py-2 pr-3 font-bold">By</th>
                  <th className="py-2 pr-3 font-bold">Plan</th>
                  <th className="py-2 pr-3 text-right font-bold">MRR</th>
                  <th className="py-2 text-right font-bold">Kunde siden</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((c) => (
                  <tr key={`${c.name}-${c.since}`} className="border-b border-slate/10 last:border-0">
                    <td className="py-2 pr-3 font-semibold">{c.name}</td>
                    <td className="py-2 pr-3">{c.city}</td>
                    <td className="py-2 pr-3 font-data tabular-nums">{c.interval}</td>
                    <td className="py-2 pr-3 text-right font-data tabular-nums">{c.monthly}</td>
                    <td className="py-2 text-right whitespace-nowrap">{c.since}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
