import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const t = translator((await getPreferences()).locale);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="display mb-6 text-3xl">{t("nav.login")}</h1>
      <LoginForm
        labels={{
          email: t("auth.email"),
          password: t("auth.password"),
          submit: t("nav.login"),
          pending: t("auth.loggingIn"),
          newHere: t("auth.newHere"),
          signup: t("nav.signup"),
        }}
        errors={{
          "auth.errWrong": t("auth.errWrong"),
          "auth.errTooMany": t("auth.errTooMany"),
        }}
      />
    </div>
  );
}
