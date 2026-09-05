"use client";

// Klubbens baner.
//
// Blev før oprettet af os ud fra et antal, klubben oplyste ved
// oprettelsen — "4 baner" blev til Bane 1 til Bane 4. Men klubben ved
// bedre end os, hvad banerne hedder og hvad de er lavet af, og de bygger
// en ny hal uden at spørge os først.
import { useFormState } from "react-dom";
import { addCourt, renameCourt, removeCourt } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";
import { SURFACES } from "../../lib/levels";

type Court = { id: string; name: string; surface: string; bookings: number };

export function CourtForm({ courts }: { courts: Court[] }) {
  const [state, action] = useFormState(addCourt, null);

  return (
    <div className="space-y-4">
      {courts.length > 0 && (
        <ul className="space-y-2">
          {courts.map((c) => (
            <li key={c.id} className="rounded-xl border border-slate/15 p-3">
              <form action={renameCourt} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="courtId" value={c.id} />
                <div className="min-w-[10rem] flex-1">
                  <label className="label" htmlFor={`name-${c.id}`}>Navn</label>
                  <input className="input" id={`name-${c.id}`} name="name" defaultValue={c.name} />
                </div>
                <div className="min-w-[9rem]">
                  <label className="label" htmlFor={`surface-${c.id}`}>Underlag</label>
                  <select
                    className="input"
                    id={`surface-${c.id}`}
                    name="surface"
                    defaultValue={c.surface}
                  >
                    {Object.entries(SURFACES).map(([key, label]) => (
                      <option key={key} value={key}>{label as string}</option>
                    ))}
                  </select>
                </div>
                <SubmitButton className="btn-ghost" pendingText="Gemmer…">Gem</SubmitButton>
              </form>

              {c.bookings === 0 ? (
                <form action={removeCourt} className="mt-2">
                  <input type="hidden" name="courtId" value={c.id} />
                  <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">
                    Slet banen
                  </SubmitButton>
                </form>
              ) : (
                <p className="mt-2 text-xs text-slate-light">
                  {c.bookings} bookinger — banen kan ikke slettes, kun omdøbes.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-3 rounded-xl bg-mist p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label className="label" htmlFor="newCourtName">Ny bane</label>
            <input className="input" id="newCourtName" name="name" placeholder="fx Bane 5" required />
          </div>
          <div className="min-w-[9rem]">
            <label className="label" htmlFor="newCourtSurface">Underlag</label>
            <select className="input" id="newCourtSurface" name="surface" defaultValue="GRUS">
              {Object.entries(SURFACES).map(([key, label]) => (
                <option key={key} value={key}>{label as string}</option>
              ))}
            </select>
          </div>
          <SubmitButton pendingText="Tilføjer…">Tilføj</SubmitButton>
        </div>
        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
      </form>
    </div>
  );
}
