// Sprogvælger. Som sportsvælgeren en formular og ikke links: valget gemmes
// i en cookie, og cookies kan ikke sættes, mens en side renderes.
//
// Sprogene står skrevet på sig selv — "Deutsch", ikke "Tysk". Den, der
// leder efter tysk, læser ikke dansk, og et sprognavn skal kunne genkendes
// af netop den, der ikke forstår siden, det står på.
import { setLocale } from "../lib/actions";
import { LOCALES, LOCALE_FLAGS, LOCALE_LABELS } from "../lib/sports";
import type { Locale } from "../lib/sports";

export function LanguagePicker({ active }: { active: Locale }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {LOCALES.map((l) => (
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
      ))}
    </div>
  );
}
