"use client";

// Teksterne kommer færdigoversatte ind fra serveren. Komponenten her ved
// ikke, hvilket sprog siden er på — og skal ikke vide det.
import Link from "next/link";
import { useFormState } from "react-dom";
import { verifyLoginCode } from "../../../lib/actions";
import { SubmitButton } from "../../../components/SubmitButton";

export function CodeForm({
  labels,
  errors,
}: {
  labels: { code: string; submit: string; checking: string; back: string };
  errors: Record<string, string>;
}) {
  const [state, action] = useFormState(verifyLoginCode, null);

  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="code">{labels.code}</label>
        <input
          className="input text-center font-data text-2xl tracking-[0.3em]"
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          required
        />
      </div>
      {state?.error && (
        <p className="text-sm font-semibold text-court-dark">
          {errors[state.error] ?? state.error}
        </p>
      )}
      <SubmitButton className="btn-ink w-full" pendingText={labels.checking}>
        {labels.submit}
      </SubmitButton>
      <p className="text-center text-sm text-slate/60">
        <Link href="/login" className="font-semibold text-court underline">{labels.back}</Link>
      </p>
    </form>
  );
}
