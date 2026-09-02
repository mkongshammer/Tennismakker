// Hvad der kom ind.
//
// Adskilt fra tælleoverblikket, fordi kroner og antal ikke skal stå i samme
// tabel: øjet sammenligner søjler, og "12" og "12.000 kr" ved siden af
// hinanden inviterer til at læse det ene som det andet.
import { economy } from "../../lib/analytics";

export async function Oekonomi() {
  const { periods, rows, subscriptionMonthly, subscriptionClubs } = await economy();

  return (
    <section className="card">
      <h2 className="display text-2xl">Økonomi</h2>
      <p className="mt-1 text-sm text-slate">
        Kun gennemførte betalinger. Vores andel er før Stripes gebyr, som
        trækkes fra den, ikke fra klubbens del.
      </p>

      <div className="mt-4 -mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
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
                    className="py-2 pl-3 text-right font-data tabular-nums whitespace-nowrap"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl bg-mist p-3 text-sm">
        <span className="font-bold">
          {subscriptionMonthly.toLocaleString("da-DK")} kr/md i abonnementer
        </span>{" "}
        <span className="text-slate">
          fra {subscriptionClubs}{" "}
          {subscriptionClubs === 1 ? "klub der betaler" : "klubber der betaler"}. Det
          er det, der løber lige nu — ikke det, der er kommet ind i perioden.
        </span>
      </div>
    </section>
  );
}
