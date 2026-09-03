// Sprogvælger. Som sportsvælgeren en formular og ikke links: valget gemmes
// i en cookie, og cookies kan ikke sættes, mens en side renderes.
//
// Sprogene står skrevet på sig selv — "Deutsch", ikke "Tysk". Den, der
// leder efter tysk, læser ikke dansk.
//
// De sprog, hvis marked ikke er åbnet, står grå og kan ikke vælges. De er
// med alligevel, fordi de fortæller, hvor vi er på vej hen — men at kunne
// vælge tysk, før der findes en eneste tysk klub, ville føre til en tom
// side på tysk.
import { setLocale } from "../lib/actions";
import { LOCALES, LOCALE_FLAGS, LOCALE_LABELS, LOCALE_LIVE } from "../lib/sports";
import type { Locale } from "../lib/sports";

export function LanguagePicker({ active }: { active: Locale }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {LOCALES.map((l) => {
        const live = LOCALE_LIVE[l];

        if (!live) {
          return (
            <span
              key={l}
              lang={l}
              title="Snart"
              className="cursor-not-allowed text-sm font-medium text-slate-light"
            >
              <span aria-hidden="true" className="mr-1.5 opacity-50">
                {LOCALE_FLAGS[l]}
              </span>
              {LOCALE_LABELS[l]}
            </span>
          );
        }

        return (
          <form action={setLocale} key={l}>
            <input type="hidden" name="locale" value={l} />
            <button
              lang={l}
              aria-current={active === l ? "true" : undefined}
              className={`text-sm transition-colors ${
                active === l ? "font-bold text-ink" : "font-medium text-slate hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className="mr-1.5">{LOCALE_FLAGS[l]}</span>
              {LOCALE_LABELS[l]}
            </button>
          </form>
        );
      })}
    </div>
  );
}
