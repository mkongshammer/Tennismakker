"use client";
import {UiText, useWebsiteInternational} from "./InternationalProvider";
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
  const {locale} = useWebsiteInternational();
  const us = locale === "en-US";

  const hard = blockers.filter((b) => b.level === "HARD");
  const soft = blockers.filter((b) => b.level === "SOFT");
  const text = (da: string, en: string) => us ? en : <UiText text={da}/>;
  const error = us && state?.error === "Skriv SLET i feltet for at bekræfte."
    ? "Type SLET in the field to confirm."
    : us && state?.error === "Forkert adgangskode."
      ? "Incorrect password."
      : state?.error;

  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-bold text-slate">{text("Slet min konto", "Delete my account")}</summary>

      <p className="mt-3 text-sm text-slate">{text(
        "Dit navn, din e-mail og alt du har skrevet bliver fjernet. Bookinger, du har betalt for, bliver stående som bogføring, men uden noget der peger på dig. Det kan ikke fortrydes.",
        "Your name, email address, and personal profile content will be removed. Paid booking records may remain where required for accounting, but without being linked to your profile. This cannot be undone."
      )}</p>

      {hard.length > 0 && (
        <div className="mt-4 rounded-xl border-2 border-court-dark/30 bg-court-dark/5 p-4">
          <p className="font-bold text-court-dark">{text("Kontoen kan ikke slettes endnu", "Your account cannot be deleted yet")}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {hard.map((b, i) => <li key={i}>{b.message}</li>)}
          </ul>
        </div>
      )}

      {soft.length > 0 && (
        <div className="mt-4 rounded-xl bg-mist p-4 text-sm">
          <p className="font-bold">{text("Det her mister du", "What you will lose")}</p>
          <ul className="mt-2 space-y-2">
            {soft.map((b, i) => <li key={i}>{b.message}</li>)}
          </ul>
        </div>
      )}

      {canDelete && (
        <form action={action} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="confirm">{text("Skriv SLET for at bekræfte", "Type SLET to confirm")}</label>
            <input className="input" id="confirm" name="confirm" autoComplete="off" required />
          </div>
          <div>
            <label className="label" htmlFor="deletePassword">{text("Din adgangskode", "Your password")}</label>
            <input className="input" id="deletePassword" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && <p className="text-sm font-semibold text-court-dark">{us ? error : <UiText text={error}/>}</p>}
          <SubmitButton className="btn-ghost" pendingText={us ? "Deleting…" : "Sletter…"}>
            {text("Slet kontoen permanent", "Delete account permanently")}
          </SubmitButton>
        </form>
      )}
    </details>
  );
}
