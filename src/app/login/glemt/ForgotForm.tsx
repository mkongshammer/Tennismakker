"use client";

// Svaret er det samme, uanset om mailen findes. Formularen viser derfor
// kvitteringen som en almindelig besked, ikke som en bekræftelse på at
// kontoen eksisterer.
import Link from "next/link";
import { useFormState } from "react-dom";
import { askPasswordReset } from "../../../lib/actions";
import { SubmitButton } from "../../../components/SubmitButton";

export function ForgotForm({
  labels,
  messages,
}: {
  labels: { email: string; submit: string; pending: string; back: string };
  messages: Record<string, string>;
}) {
  const [state, action] = useFormState(askPasswordReset, null);

  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="email">{labels.email}</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state && "ok" in state && state.ok ? (
        <p className="rounded-xl border border-court/30 p-3 text-sm font-semibold text-court">
          {messages[state.ok] ?? state.ok}
        </p>
      ) : null}
      {state && "error" in state && state.error ? (
        <p className="text-sm font-semibold text-court-dark">
          {messages[state.error] ?? state.error}
        </p>
      ) : null}
      <SubmitButton className="btn-ink w-full" pendingText={labels.pending}>
        {labels.submit}
      </SubmitButton>
      <p className="text-center text-sm text-slate/60">
        <Link href="/login" className="font-semibold text-court underline">{labels.back}</Link>
      </p>
    </form>
  );
}
