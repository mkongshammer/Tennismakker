// Where players are asking for courts and coaches we do not have yet.
//
// Every row is a confirmed e-mail address (or one still awaiting
// confirmation) for one sport in one place. "Confirmed" is the number sales
// should trust; "pending" is sign-ups whose e-mail link has not been clicked.
import { marketInterestSummary, pruneInterest } from "../../lib/market-interest";
import { stateName } from "../../lib/us-places";
import { sportLabel } from "../../lib/sports";
import { formatDate } from "../../lib/international";

export async function Demand() {
  // Retention runs whenever someone looks at the list — cheap, and it means
  // old unconfirmed addresses never linger just because no cron ran.
  await pruneInterest();
  const rows = await marketInterestSummary();
  const byState = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.state ?? "—";
    byState.set(key, [...(byState.get(key) ?? []), r]);
  }
  const states = [...byState.entries()].sort((a, b) => sum(b[1]) - sum(a[1]));
  const totals = { confirmed: sum(rows), pending: rows.reduce((s, r) => s + r.pending, 0), notified: rows.reduce((s, r) => s + r.notified, 0) };
  const placeKind = (key: string) => (key.startsWith("zip:") ? "ZIP" : key.startsWith("state:") ? "State" : "City");

  return (
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Confirmed and waiting" value={totals.confirmed} note="Count on these." />
        <Tile label="Awaiting e-mail confirmation" value={totals.pending} note="Deleted after 30 days if never confirmed." />
        <Tile label="Already notified" value={totals.notified} note="A matching club or coach went live." />
      </div>
      {rows.length === 0 ? (
        <p className="card text-sm text-slate">No demand captured yet. When a player searches a place with no live club or coach and leaves an e-mail, it appears here by state, place and sport.</p>
      ) : (
        states.map(([state, list]) => (
          <section key={state} className="card">
            <h2 className="display text-2xl">{state === "—" ? "Unknown state" : `${stateName(state)} (${state})`}</h2>
            <p className="mt-1 text-sm text-slate">{sum(list)} confirmed · {list.reduce((s, r) => s + r.pending, 0)} pending</p>
            <div className="-mx-2 mt-4 overflow-x-auto px-2">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate/15 text-left">
                    <th className="py-2 pr-3 font-bold">Place</th>
                    <th className="py-2 pr-3 font-bold">Type</th>
                    <th className="py-2 pr-3 font-bold">Looking for</th>
                    <th className="py-2 pr-3 font-bold">Sport</th>
                    <th className="py-2 pr-3 text-right font-bold">Confirmed</th>
                    <th className="py-2 pr-3 text-right font-bold">Pending</th>
                    <th className="py-2 pr-3 text-right font-bold">Notified</th>
                    <th className="py-2 text-right font-bold">Latest</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={`${r.placeKey}|${r.kind}|${r.sport}`} className="border-b border-slate/10 last:border-0">
                      <td className="py-2 pr-3 font-semibold">{r.label}</td>
                      <td className="py-2 pr-3 text-slate">{placeKind(r.placeKey)}</td>
                      <td className="py-2 pr-3">{r.kind === "COURTS" ? "Courts" : "Coaches"}</td>
                      <td className="py-2 pr-3">{sportLabel(r.sport, "en-US")}</td>
                      <td className="data py-2 pr-3 text-right font-bold">{r.confirmed}</td>
                      <td className="data py-2 pr-3 text-right text-slate">{r.pending}</td>
                      <td className="data py-2 pr-3 text-right text-slate">{r.notified}</td>
                      <td className="py-2 text-right text-slate whitespace-nowrap">{formatDate(r.latest, "en-US", "America/New_York", { month: "short", day: "numeric" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
      <p className="text-xs text-slate">Notifications are sent automatically when a US club is approved or a US coach profile is created, to confirmed sign-ups within 50 miles (or in the state, for state-level sign-ups), once per sign-up. Addresses are never shown here; export requires database access.</p>
    </section>
  );
}

function sum(rows: { confirmed: number }[]) {
  return rows.reduce((s, r) => s + r.confirmed, 0);
}

function Tile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="card">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate">{label}</p>
      <p className="data mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate">{note}</p>
    </div>
  );
}
