// Andet trin i et superadmin-login: koden fra mailen.
//
// Siden siger ikke, hvilken mail koden blev sendt til. Man skal allerede
// vide det for at være her, og en adresse på skærmen ville være en gave til
// den, der lige har gættet en adgangskode.
import { getPreferences } from "../../../lib/preferences";
import { translator } from "../../../lib/i18n";
import { CodeForm } from "./CodeForm";

export const dynamic = "force-dynamic";

export default async function LoginKodePage() {
  const t = translator((await getPreferences()).locale);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="display mb-2 text-3xl">{t("auth.codeTitle")}</h1>
      <p className="mb-6 text-sm text-slate">{t("auth.codeIntro")}</p>
      <CodeForm
        labels={{
          code: t("auth.codeLabel"),
          submit: t("auth.codeSubmit"),
          checking: t("auth.codeChecking"),
          back: t("auth.codeBack"),
        }}
        errors={{
          "auth.errExpired": t("auth.errExpired"),
          "auth.errCodeWrong": t("auth.errCodeWrong"),
          "auth.errCodeUsed": t("auth.errCodeUsed"),
          "auth.errCodeExpired": t("auth.errCodeExpired"),
        }}
      />
    </div>
  );
}
