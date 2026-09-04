"use client";

// Bestyrelsen på klubsiden.
//
// Enhver dansk forening har den på hjemmesiden, og det er dét, medlemmerne
// leder efter, når de skal have fat i nogen. Klubben vedligeholder den selv
// — der skal ikke sendes en mail til os, fordi kassereren er skiftet.
import { useFormState } from "react-dom";
import { addClubPerson, removeClubPerson } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

type Person = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
};

export function PeopleForm({ people }: { people: Person[] }) {
  const [state, action] = useFormState(addClubPerson, null);

  return (
    <div className="space-y-4">
      {people.length > 0 && (
        <ul className="space-y-2">
          {people.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate/15 p-3"
            >
              <div>
                <span className="font-bold">{p.name}</span>
                <span className="ml-2 text-sm text-slate">{p.role}</span>
                {(p.email || p.phone) && (
                  <span className="ml-2 text-sm text-slate-light">
                    {[p.email, p.phone].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <form action={removeClubPerson}>
                <input type="hidden" name="personId" value={p.id} />
                <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">
                  Fjern
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-3 rounded-xl bg-mist p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="personName">Navn</label>
            <input className="input" id="personName" name="name" required />
          </div>
          <div>
            <label className="label" htmlFor="personRole">Rolle</label>
            <input className="input" id="personRole" name="role" placeholder="fx Formand" required />
          </div>
          <div>
            <label className="label" htmlFor="personEmail">E-mail</label>
            <input className="input" id="personEmail" name="email" type="email" />
          </div>
          <div>
            <label className="label" htmlFor="personPhone">Telefon</label>
            <input className="input" id="personPhone" name="phone" />
          </div>
        </div>
        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        <SubmitButton pendingText="Tilføjer…">Tilføj til bestyrelsen</SubmitButton>
      </form>
    </div>
  );
}
