import { getPreferences } from "../../lib/preferences";
import { translator, t as translate } from "../../lib/i18n";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

/**
 * Sætningen om vilkår har to links midt i sig, og de står forskellige
 * steder på forskellige sprog. Derfor deles den op omkring pladsholderne
 * frem for at blive limet sammen af stumper — se kommentaren ved t().
 */
function splitTerms(sentence: string) {
  const [before, rest = ""] = sentence.split("{terms}");
  const [middle, after = ""] = rest.split("{privacy}");
  return { before, middle, after };
}

export default async function SignupPage() {
  const { locale } = await getPreferences();
  const t = translator(locale);
  const parts = splitTerms(translate("auth.termsNote", locale));

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display mb-6 text-3xl">{t("nav.signup")}</h1>
      <SignupForm
        labels={{
          name: t("auth.name"),
          email: t("auth.email"),
          password: t("auth.passwordMin"),
          iAm: t("auth.iAm"),
          rolePlayer: t("auth.rolePlayer"),
          roleCoach: t("auth.roleCoach"),
          level: t("common.level"),
          area: t("common.area"),
          submit: t("nav.signup"),
          pending: t("auth.creating"),
          haveAccount: t("auth.haveAccount"),
          login: t("nav.login"),
          coachHeadline: t("auth.coachHeadline"),
          coachHeadlinePlaceholder: t("auth.coachHeadlinePlaceholder"),
          coachSports: t("auth.coachSports"),
          coachPrice: t("auth.coachPrice"),
          coachAreaNote: t("auth.coachAreaNote"),
          coachRest: t("auth.coachRest"),
        }}
        locale={locale}
        terms={{
          ...parts,
          termsText: t("auth.termsLink"),
          privacyText: t("auth.privacyLink"),
        }}
      />
    </div>
  );
}
