"use client";

// Formularen der opretter en superadmin — og viser adgangskoden én gang.
//
// Den vises kun her og nu. Lukker man fanen uden at gemme den, må kontoen
// oprettes igen med en ny kode. Det er med vilje: alternativet er at kunne
// slå adgangskoden op bagefter, og så er den ikke længere en hemmelighed.
import { useFormState } from "react-dom";
import { SubmitButton } from "../../components/SubmitButton";
import { createSuperadmin } from "./actions";

export function SuperadminAccess() {
  const [state, action] = useFormState(createSuperadmin, null);

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="display text-2xl">Superadmin-adgang</h2>
        <p className="mt-1 text-sm text-slate">
          Opretter en konto med fuld adgang, eller giver adgangen til en konto,
          der findes i forvejen. Login kræver derefter en kode sendt til den
          mail — adgangskoden alene er ikke nok.
        </p>
      </div>

      {state && "ok" in state ? (
        <div className="rounded-xl border border-court/30 bg-court/5 p-4">
          <p className="font-bold text-court">
            {state.promoted ? "Kontoen har nu fuld adgang." : "Kontoen er oprettet."}
          </p>
          <p className="mt-1 text-sm text-slate">{state.email}</p>
          <p className="mt-3 text-xs font-bold text-slate">Adgangskode</p>
          <p className="select-all font-data text-lg tracking-wide">{state.password}</p>
          <p className="mt-3 text-sm text-court-dark">
            Gem den i en adgangskodemanager nu. Den kan ikke hentes frem igen —
            lukker du fanen, skal kontoen oprettes forfra med en ny kode.
          </p>
        </div>
      ) : null}

      {state && "error" in state ? (
        <p className="text-sm font-semibold text-court-dark">{state.error}</p>
      ) : null}

      <form action={action} className="space-y-3">
        <div>
          <label className="label" htmlFor="sa-email">E-mail</label>
          <input
            className="input"
            id="sa-email"
            name="email"
            type="email"
            placeholder="racketbuddy.app@gmail.com"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="sa-name">Navn</label>
          <input className="input" id="sa-name" name="name" placeholder="RacketBuddy" />
        </div>
        <SubmitButton pendingText="Opretter…">Opret superadmin</SubmitButton>
      </form>
    </section>
  );
}
