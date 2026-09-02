// Landevalget, første gang nogen lander på siden.
//
// Landet afgør, hvilke klubber der overhovedet vises, hvilken valuta priser
// står i, og hvilket sprog siden er på. At gætte forkert på alle tre
// samtidig er værre end at spørge én gang.
//
// Ingen klient-JavaScript: hvert land er en formular, ligesom sports- og
// sprogvælgeren. Cookies kan ikke sættes, mens en side renderes, så et valg
// skal være en handling — og så kan boksen lige så godt renderes på
// serveren og virke uden JavaScript overhovedet.
//
// Den kan lukkes uden at svare. At blokere siden, indtil nogen har valgt,
// ville koste flere besøgende, end det forkerte land gør.
import { dismissCountryChoice, setCountry } from "../lib/actions";
import { COUNTRIES, countryName } from "../lib/sports";
import { translator } from "../lib/i18n";
import type { Locale } from "../lib/sports";

export function CountryModal({ locale }: { locale: Locale }) {
  const t = translator(locale);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="country-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl bg-chalk p-6 shadow-xl">
        <h2 id="country-title" className="display text-2xl">
          {t("country.title")}
        </h2>
        <p className="mt-2 text-sm text-slate">{t("country.intro")}</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {COUNTRIES.map((c) => (
            <form action={setCountry} key={c.code}>
              <input type="hidden" name="country" value={c.code} />
              <button className="w-full rounded-xl border border-slate/20 px-4 py-3 text-left font-semibold transition-colors hover:border-court hover:text-court">
                {countryName(c.code, locale)}
              </button>
            </form>
          ))}
        </div>

        <form action={dismissCountryChoice} className="mt-4">
          <button className="text-sm font-medium text-slate underline">
            {t("country.skip")}
          </button>
        </form>
      </div>
    </div>
  );
}
