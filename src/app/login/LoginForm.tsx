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
  next,
  legacyOrigin,
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
  /** Same-site path to return to after sign-in. */
  next?: string | null;
  /** Shown under a failed sign-in when legacy European accounts live on another origin. */
  legacyOrigin?: string | null;
  errors: Record<string, string>;
}) {
  const [state, action] = useFormState(login, null);

  return (
    <form action={action} className="card space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
        <div className="flex items-baseline justify-between gap-3">
          <label className="label" htmlFor="password">{labels.password}</label>
          <Link href="/login/forgot" className="text-sm font-semibold text-court transition hover:text-court-dark">
            {labels.forgot}
          </Link>
        </div>
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
      {state?.error === "auth.errWrong" && legacyOrigin && (
        <p className="text-xs text-slate">
          Created your account in Europe before October 2026? Those accounts live on our European site:{" "}
          <a href={`${legacyOrigin}/login`} className="font-semibold text-court underline-offset-2 hover:underline">sign in there</a>.
        </p>
      )}
      <SubmitButton className="btn-ink w-full" pendingText={labels.pending}>
        {labels.submit}
      </SubmitButton>
      <div className="flex items-center gap-3 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-light" aria-hidden="true">
        <span className="h-px flex-1 bg-slate/15" />{labels.newHere.replace(/\?$/, "")}<span className="h-px flex-1 bg-slate/15" />
      </div>
      <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="btn-ghost w-full">
        {labels.signup}
      </Link>
    </form>
  );
}
