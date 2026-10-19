import { getPreferences } from "../../../lib/preferences";
import { translator } from "../../../lib/i18n";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";

export default async function NulstilPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;
  const t = translator((await getPreferences()).locale);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="display mb-6 text-3xl">{t("auth.forgotTitle")}</h1>
      <ResetForm
        token={query.token ?? ""}
        labels={{
          password: t("auth.newPassword"),
          repeat: t("auth.repeatPassword"),
          submit: t("auth.savePassword"),
          pending: t("auth.saving"),
          back: t("auth.codeBack"),
        }}
        errors={{
          "auth.errNoMatch": t("auth.errNoMatch"),
          "auth.errShort": t("auth.errShort"),
          "auth.errBadLink": t("auth.errBadLink"),
        }}
      />
    </div>
  );
}
