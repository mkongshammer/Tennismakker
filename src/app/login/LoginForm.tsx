"use client";

// Teksterne kommer færdigoversatte ind fra serveren, så formularen selv
// ikke behøver kende sproget. Handlingen returnerer nøgler frem for
// sætninger — den ved heller ikke, hvilket sprog svaret skal læses på.
import Link from "next/link";
import { useFormState } from "react-dom";
import { login } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

export function LoginForm({
  labels,
  errors,
  notice,
}: {
  labels: {
    email: string;
    password: string;
    submit: string;
    pending: string;
    newHere: string;
    signup: string;
    forgot: string;
  };
  notice?: string;
  errors: Record<string, string>;
}) {
  const [state, action] = useFormState(login, null);

  return (
    <form action={action} className="card space-y-4">
      {notice ? (
        <p className="rounded-xl border border-court/30 p-3 text-sm font-semibold text-court">
          {notice}
        </p>
      ) : null}
      <div>
        <label className="label" htmlFor="email">{labels.email}</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">{labels.password}</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
      <p className="text-center text-sm">
        <Link href="/login/glemt" className="font-semibold text-court underline">
          {labels.forgot}
        </Link>
      </p>
      <p className="text-center text-sm text-slate/60">
        {labels.newHere}{" "}
        <Link href="/signup" className="font-semibold text-court underline">{labels.signup}</Link>
      </p>
    </form>
  );
}
