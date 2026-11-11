// The latest server errors and warnings (saved by lib/error-log.ts).
import { recentErrors } from "../../lib/error-log";

export async function ErrorLog() {
  const list = await recentErrors();
  return (
    <section className="card">
      <h2 className="display text-xl">Fejllog</h2>
      <p className="mt-1 text-sm text-slate">De seneste {list.length} fejl og advarsler fra serveren, nyeste først. E-mailadresser og nøgler er skjult.</p>
      {list.length === 0 ? <p className="mt-3 text-sm text-slate">Ingen fejl gemt.</p> : (
        <ul className="mt-3 divide-y divide-slate/10 text-sm">
          {list.map((e, i) => (
            <li key={i} className="py-2">
              <span className={`mr-2 badge ${e.level === "error" ? "bg-danger/15 text-danger" : "bg-warning-soft text-warning-ink"}`}>{e.level === "error" ? "fejl" : "advarsel"}</span>
              <span className="text-xs text-slate">{new Date(e.at).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })}</span>
              <p className="mt-1 break-words font-mono text-xs">{e.msg}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
