// Sportsvælger. Skal være en formular, ikke links: valget gemmes i en
// cookie, og cookies kan ikke sættes, mens en side renderes.
import { setSport } from "../lib/actions";
import { sportColor, sportLabel, SPORTS } from "../lib/sports";
import type { Locale, Sport } from "../lib/sports";

export function SportPicker({
  active,
  locale,
}: {
  active: Sport;
  locale: Locale;
}) {
  return (
    <div className="snap-row no-scrollbar -mx-4 mb-6 overflow-x-auto px-4 pb-1">
      <div className="flex w-max gap-2">
        {SPORTS.map((s) => (
          <form action={setSport} key={s}>
            <input type="hidden" name="sport" value={s} />
            <button
              aria-pressed={active === s}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                active === s
                  ? "bg-ink text-chalk"
                  : "border border-slate/20 bg-chalk text-slate hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: sportColor(s) }}
              />
              {sportLabel(s, locale)}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
