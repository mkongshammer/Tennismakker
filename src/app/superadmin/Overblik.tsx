// Hvordan går det, i tal.
//
// Én tabel frem for otte kort: tallene skal sammenlignes på tværs af
// perioder, og det gør man med øjnene ned ad en søjle. Kort ved siden af
// hinanden tvinger en til at læse hvert tal for sig.
import { overview } from "../../lib/analytics";

export async function Overblik() {
  const { periods, rows } = await overview();

  return (
    <section className="card">
      <h2 className="display text-2xl">Overblik</h2>
      <p className="mt-1 text-sm text-slate">
        Bookinger tælles, når de er betalt. Sidevisninger tælles uden cookies
        eller IP-adresser, så det er visninger og ikke besøgende.
      </p>

      <div className="mt-4 -mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate/15">
              <th className="py-2 pr-3 text-left font-bold"> </th>
              {periods.map((p) => (
                <th key={p.key} className="py-2 pl-3 text-right font-bold whitespace-nowrap">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-slate/10 last:border-0">
                <td className="py-2 pr-3">
                  <span className="font-semibold">{row.label}</span>
                  {row.note ? (
                    <span className="ml-2 text-xs text-slate-light">{row.note}</span>
                  ) : null}
                </td>
                {row.values.map((value, i) => (
                  <td
                    key={periods[i].key}
                    className={`py-2 pl-3 text-right font-data tabular-nums ${
                      value === 0 ? "text-slate-light" : ""
                    }`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
