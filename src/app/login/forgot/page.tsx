import { getPreferences } from "../../../lib/preferences";
import { translator } from "../../../lib/i18n";
import { ForgotForm } from "./ForgotForm";

export const dynamic = "force-dynamic";

export default async function GlemtPage() {
  const t = translator((await getPreferences()).locale);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="display mb-2 text-3xl">{t("auth.forgotTitle")}</h1>
      <p className="mb-6 text-sm text-slate">{t("auth.forgotIntro")}</p>
      <ForgotForm
        labels={{ email: t("auth.email"), submit: t("auth.forgotSend"), pending: t("auth.sending"), back: t("auth.codeBack") }}
        messages={{
          "auth.resetSent": t("auth.resetSent"),
          "auth.errBadEmail": t("auth.errBadEmail"),
        }}
      />
    </div>
  );
}
