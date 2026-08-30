// Sportsvælger. Skal være en formular, ikke links: valget gemmes i en
// cookie, og cookies kan ikke sættes, mens en side renderes.
import { setSport } from "../lib/actions";
import { sportLabel, SPORTS } from "../lib/sports";
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
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                active === s
                  ? "bg-bane text-kridt"
                  : "border border-net/20 hover:border-bane"
              }`}
            >
              {sportLabel(s, locale)}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
