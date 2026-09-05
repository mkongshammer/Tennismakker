"use client";

// Sletning af egen konto.
//
// Ligger sammenklappet, fordi det ikke er noget, man skal snuble over.
//
// Kræver både ordet og adgangskoden. Ordet beskytter mod et fejlklik;
// adgangskoden beskytter også mod en, der sætter sig ved en åben skærm —
// og en klubadministrators konto er nøglen til foreningens bookinger,
// medlemmer og indtægter.
//
// Spærringerne vises på forhånd, så man ikke først opdager dem efter at
// have skrevet sin adgangskode. Se src/lib/deletion-guards.ts.
import { useFormState } from "react-dom";
import { deleteMyAccount } from "../lib/actions";
import { SubmitButton } from "./SubmitButton";

type Blocker = { level: "HARD" | "SOFT"; message: string };

export function DeleteAccount({
  blockers = [],
  canDelete = true,
}: {
  blockers?: Blocker[];
  canDelete?: boolean;
}) {
  const [state, action] = useFormState(deleteMyAccount, null);

  const hard = blockers.filter((b) => b.level === "HARD");
  const soft = blockers.filter((b) => b.level === "SOFT");

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

      {hard.length > 0 && (
        <div className="mt-4 rounded-xl border-2 border-court-dark/30 bg-court-dark/5 p-4">
          <p className="font-bold text-court-dark">
            Kontoen kan ikke slettes endnu
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {hard.map((b, i) => (
              <li key={i}>{b.message}</li>
            ))}
          </ul>
        </div>
      )}

      {soft.length > 0 && (
        <div className="mt-4 rounded-xl bg-mist p-4 text-sm">
          <p className="font-bold">Det her mister du</p>
          <ul className="mt-2 space-y-2">
            {soft.map((b, i) => (
              <li key={i}>{b.message}</li>
            ))}
          </ul>
        </div>
      )}

      {canDelete && (
        <form action={action} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="confirm">Skriv SLET for at bekræfte</label>
            <input className="input" id="confirm" name="confirm" autoComplete="off" required />
          </div>
          <div>
            <label className="label" htmlFor="deletePassword">Din adgangskode</label>
            <input
              className="input"
              id="deletePassword"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state?.error && (
            <p className="text-sm font-semibold text-court-dark">{state.error}</p>
          )}
          <SubmitButton className="btn-ghost" pendingText="Sletter…">
            Slet kontoen permanent
          </SubmitButton>
        </form>
      )}
    </details>
  );
}
