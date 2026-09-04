"use client";

// Værktøjet, der finder selektorerne.
//
// Det logger ind i klubbens system og lister hvert felt, hver knap og hvert
// link med de attributter, man vælger dem ud fra. Uden det skulle
// selektorerne gættes, og et gæt er kode, der ser rigtig ud og ikke virker.
import { useFormState } from "react-dom";
import { runInspect } from "./actions";
import { SubmitButton } from "../../../components/SubmitButton";

type Club = { id: string; name: string };

export function InspectForm({ clubs }: { clubs: Club[] }) {
  const [state, action] = useFormState(runInspect, null);

  return (
    <div className="space-y-6">
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="clubId">Klub (gemmer adgangen)</label>
          <select className="input" id="clubId" name="clubId" defaultValue="">
            <option value="">Gem ikke — kun se</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="baseUrl">Adresse på klubbens system</label>
          <input
            className="input"
            id="baseUrl"
            name="baseUrl"
            placeholder="jerklub.halbooking.dk"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="username">Brugernavn</label>
            <input className="input" id="username" name="username" autoComplete="off" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Adgangskode</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              autoComplete="off"
              required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="path">Sti at åbne efter login</label>
          <input className="input" id="path" name="path" placeholder="/booking" />
          <p className="mt-1 text-xs text-slate">
            Tom betyder <span className="data">bookingPath</span> fra selectors.js.
          </p>
        </div>

        {state && "error" in state && (
          <p className="text-sm font-semibold text-court-dark">{state.error}</p>
        )}

        <SubmitButton pendingText="Åbner browseren… op til 45 sekunder">
          Se hvad automatiseringen ser
        </SubmitButton>
      </form>

      {state && "result" in state && <Result state={state} />}
    </div>
  );
}

function Result({ state }: { state: { result: any; clubName: string } }) {
  const r = state.result;

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="display text-xl">Hvad der skete</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {(r.steps ?? []).map((s: any, i: number) => (
            <li key={i} className="border-l-2 border-slate/20 pl-3">
              <p className="font-semibold">{s.step}</p>
              {s.url && <p className="data text-xs text-slate">{s.url}</p>}
              {s.title && <p className="text-xs text-slate">{s.title}</p>}
              {s.error && <p className="text-xs font-semibold text-court-dark">{s.error}</p>}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm">
          Logget ind:{" "}
          <span className={r.loggedIn ? "font-bold text-court" : "font-bold text-court-dark"}>
            {r.loggedIn ? "ja" : "nej"}
          </span>
          {!r.loggedIn && (
            <span className="text-slate">
              {" "}
              — se felterne på loginsiden nedenfor, og ret{" "}
              <span className="data">usernameField</span>,{" "}
              <span className="data">passwordField</span> og{" "}
              <span className="data">submitButton</span> i selectors.js.
            </span>
          )}
        </p>
      </section>

      {r.screenshot && (
        <section className="card">
          <h2 className="display mb-3 text-xl">Skærmbillede</h2>
          <img
            src={`data:image/png;base64,${r.screenshot}`}
            alt=""
            className="w-full rounded-xl border border-slate/15"
          />
        </section>
      )}

      <Fields title="Felter på loginsiden" items={r.loginPageFields} />
      <Fields title="Felter efter login" items={r.afterLoginFields} />
      <Fields title="Felter på bookingsiden" items={r.bookingPageFields} />

      {Array.isArray(r.bookingPageTables) && r.bookingPageTables.length > 0 && (
        <section className="card">
          <h2 className="display text-xl">Skemaet</h2>
          <p className="mt-1 text-sm text-slate">
            Cellernes attributter er dét, <span className="data">freeSlotCell</span> og{" "}
            <span className="data">bookedMarker</span> skal pege på.
          </p>
          <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-ink p-4 text-xs text-chalk">
            {JSON.stringify(r.bookingPageTables, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

function Fields({ title, items }: { title: string; items?: unknown[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="card">
      <h2 className="display text-xl">{title}</h2>
      <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-ink p-4 text-xs text-chalk">
        {JSON.stringify(items, null, 2)}
      </pre>
    </section>
  );
}
