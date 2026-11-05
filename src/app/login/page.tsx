import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { LoginForm } from "./LoginForm";
import { safeReturnPath } from "../../lib/return-path";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; next?: string }>;
}) {
  const query = await searchParams;
  const t = translator((await getPreferences()).locale);
  const next = safeReturnPath(query.next);
  // RacketBuddy is US-only; the old European service is switched off, so there is no legacy sign-in link.
  const legacyOrigin = null;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="display mb-2 text-3xl">{t("nav.login")}</h1>
      {next && <p className="mb-6 text-sm text-slate">Sign in to finish reserving your court. You’ll be sent right back.</p>}
      {!next && <div className="mb-6" />}
      <LoginForm
        next={next}
        legacyOrigin={legacyOrigin}
        labels={{
          email: t("auth.email"),
          password: t("auth.password"),
          submit: t("nav.login"),
          pending: t("auth.loggingIn"),
          newHere: t("auth.newHere"),
          signup: t("nav.signup"),
          forgot: t("auth.forgot"),
        }}
        notice={query.reset ? t("auth.resetDone") : undefined}
        errors={{
          "auth.errWrong": t("auth.errWrong"),
          "auth.errTooMany": t("auth.errTooMany"),
        }}
      />
    </div>
  );
}
