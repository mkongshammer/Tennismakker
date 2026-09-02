"use client";

// Tokenet bæres med i et skjult felt frem for at blive læst fra adressen på
// serveren. Så kan siden ikke ende med at gemme en ny adgangskode for et
// link, der er skiftet ud undervejs i en anden fane.
import Link from "next/link";
import { useFormState } from "react-dom";
import { submitNewPassword } from "../../../lib/actions";
import { SubmitButton } from "../../../components/SubmitButton";

export function ResetForm({
  token,
  labels,
  errors,
}: {
  token: string;
  labels: { password: string; repeat: string; submit: string; pending: string; back: string };
  errors: Record<string, string>;
}) {
  const [state, action] = useFormState(submitNewPassword, null);

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">{labels.password}</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="repeat">{labels.repeat}</label>
        <input
          className="input"
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      {state?.error && (
        <p className="text-sm font-semibold text-court-dark">
          {errors[state.error] ?? state.error}
        </p>
      )}
      <SubmitButton className="btn-ink w-full" pendingText={labels.pending}>
        {labels.submit}
      </SubmitButton>
      <p className="text-center text-sm text-slate/60">
        <Link href="/login" className="font-semibold text-court underline">{labels.back}</Link>
      </p>
    </form>
  );
}
