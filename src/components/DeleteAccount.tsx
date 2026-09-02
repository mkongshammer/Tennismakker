"use client";

// Sletning af egen konto.
//
// Ligger sammenklappet, fordi det ikke er noget, man skal snuble over — og
// kræver at ordet skrives, fordi en knap alene er for let at ramme ved et
// uheld. Handlingen kan ikke fortrydes.
import { useFormState } from "react-dom";
import { deleteMyAccount } from "../lib/actions";
import { SubmitButton } from "./SubmitButton";

export function DeleteAccount() {
  const [state, action] = useFormState(deleteMyAccount, null);

  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-bold text-slate">
        Slet min konto
      </summary>

      <p className="mt-3 text-sm text-slate">
        Dit navn, din e-mail og alt du har skrevet bliver fjernet. Bookinger,
        du har betalt for, bliver stående som bogføring, men uden noget der
        peger på dig. Det kan ikke fortrydes.
      </p>

      <form action={action} className="mt-4 space-y-3">
        <div>
          <label className="label" htmlFor="confirm">Skriv SLET for at bekræfte</label>
          <input className="input" id="confirm" name="confirm" autoComplete="off" required />
        </div>
        {state?.error && (
          <p className="text-sm font-semibold text-court-dark">{state.error}</p>
        )}
        <SubmitButton className="btn-ghost" pendingText="Sletter…">
          Slet kontoen permanent
        </SubmitButton>
      </form>
    </details>
  );
}
