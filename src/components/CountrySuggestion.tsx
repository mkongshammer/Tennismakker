// Spørgsmålet om land, når gættet peger et andet sted hen end det, vi viser.
//
// Erstatter en boks med fire knapper midt på forsiden. Den var i vejen for
// alle for at hjælpe de få: langt de fleste besøgende er dér, hvor vi
// allerede viser, og for dem er der ingenting at spørge om.
//
// Teksten står på sproget dér, hvor vi tror, den besøgende er — ikke på
// sidens nuværende sprog. En tysker, der lander på en dansk side, skal
// kunne læse netop den ene sætning, der tilbyder at gøre noget ved det.
import { setCountry, dismissCountryChoice } from "../lib/actions";
import { COUNTRIES, countryName } from "../lib/sports";
import { translator } from "../lib/i18n";
import type { Locale } from "../lib/sports";

export function CountrySuggestion({ code }: { code: string }) {
  const country = COUNTRIES.find((c) => c.code === code);
  if (!country) return null;

  const locale = country.defaultLocale as Locale;
  const t = translator(locale);
  const name = countryName(country.code, locale);

  return (
    <div className="mx-auto mb-6 flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-slate/15 bg-chalk px-4 py-3">
      <span aria-hidden="true" className="text-xl">
        {country.flag}
      </span>
      <p lang={locale} className="min-w-0 flex-1 text-sm">
        <span className="font-bold">{t("geo.suspect", { country: name })}</span>{" "}
        <span className="text-slate">{t("geo.ask")}</span>
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <form action={setCountry}>
          <input type="hidden" name="country" value={country.code} />
          <button lang={locale} className="btn-court px-4 py-2 text-sm">
            {t("geo.yes")}
          </button>
        </form>
        <form action={dismissCountryChoice}>
          <button lang={locale} className="text-sm font-medium text-slate underline">
            {t("geo.no")}
          </button>
        </form>
      </div>
    </div>
  );
}
