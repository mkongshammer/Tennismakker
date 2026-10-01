"use client";

// Priser efter tidspunkt.
//
// Prime time koster mere. Enhver klub med en hal har den regel, og indtil
// nu havde vi én pris for alle baner på alle tider.
//
// Reglen slår banens egen pris, som slår klubbens. Mest specifik vinder,
// så klubben kan sætte hallens pris én gang på banen og kun skrive de
// regler, der afviger.
import { useWebsiteInternational } from "../../components/InternationalProvider";import { useFormState } from "react-dom";
import { addPriceRule, removePriceRule } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

const DAYS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

type Court = {id: string;name: string;};
type Rule = {
  id: string;
  label: string | null;
  courtIds: string;
  daysOfWeek: string;
  fromHour: number;
  toHour: number;
  priceKr: number;
  memberPriceHour: number | null;
};

export function PriceRuleForm({ courts, rules }: {courts: Court[];rules: Rule[];}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(addPriceRule, null);

  const courtNames = (ids: string) => {
    const list = ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return "alle baner";
    return list.map((id) => courts.find((c) => c.id === id)?.name ?? "?").join(", ");
  };

  const dayNames = (days: string) => {
    const list = days.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return "alle dage";
    return list.map((d) => DAYS[Number(d)] ?? "?").join(", ");
  };

  return (
    <div className="space-y-4">
      {rules.length > 0 &&
      <ol className="space-y-2">
          {rules.map((r, i) =>
        <li
          key={r.id}
          className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3">

              <div>
                <p className="font-bold">
                  {i + 1}. {r.label || `${money(r.priceKr)}`}
                </p>
                <p className="text-sm text-slate">
                  {courtNames(r.courtIds)} · {dayNames(r.daysOfWeek)} ·{" "}
                  {String(r.fromHour).padStart(2, "0")}–{String(r.toHour).padStart(2, "0")} ·{" "}
                  {money(r.priceKr)}
                  {r.memberPriceHour != null && ` · medlem ${money(r.memberPriceHour)}`}
                </p>
              </div>
              <form action={removePriceRule}>
                <input type="hidden" name="ruleId" value={r.id} />
                <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">{tr("Fjern")}

            </SubmitButton>
              </form>
            </li>
        )}
        </ol>
      }

      {rules.length > 1 &&
      <p className="text-sm text-slate">{tr("Rammer flere regler samme time, vinder den \xF8verste. S\xE5 kan en specifik regel l\xE6gges over en bred.")}


      </p>
      }

      <form action={action} className="space-y-4 rounded-xl bg-mist p-4">
        <div>
          <label className="label" htmlFor="ruleLabel">{tr("Hvad hedder reglen")}</label>
          <input
            className="input"
            id="ruleLabel"
            name="label"
            placeholder={tr("fx Prime time hverdage")} />

        </div>

        <div>
          <span className="label">{tr("Baner")}</span>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
            {courts.map((c) =>
            <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="courtIds" value={c.id} />
                {c.name}
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-slate">{tr("Ingen valgt = alle baner.")}</p>
        </div>

        <div>
          <span className="label">{tr("Ugedage")}</span>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
            {DAYS.map((d, i) =>
            <label key={i} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="daysOfWeek" value={i} />
                {d}
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-slate">{tr("Ingen valgt = alle dage.")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="ruleFrom">{tr("Fra kl.")}</label>
            <input
              className="input"
              id="ruleFrom"
              name="fromHour"
              type="number"
              min={0}
              max={23}
              defaultValue={17} />

          </div>
          <div>
            <label className="label" htmlFor="ruleTo">{tr("Til kl.")}</label>
            <input
              className="input"
              id="ruleTo"
              name="toHour"
              type="number"
              min={1}
              max={24}
              defaultValue={21} />

          </div>
          <div>
            <label className="label" htmlFor="rulePrice">{tr("G\xE6stepris")}</label>
            <input className="input" id="rulePrice" name="priceKr" type="number" min={0} required />
          </div>
          <div>
            <label className="label" htmlFor="ruleMember">{tr("Medlemspris")}</label>
            <input
              className="input"
              id="ruleMember"
              name="memberPriceHour"
              type="number"
              min={0}
              placeholder={tr("u\xE6ndret")} />

          </div>
        </div>

        <p className="text-xs text-slate">{tr("Til-tidspunktet er ikke med: 17 til 21 d\xE6kker 17, 18, 19 og 20. Lader du medlemsprisen st\xE5 tom, beholder medlemmerne deres almindelige pris.")}



        </p>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

        <SubmitButton pendingText={tr("Tilf\xF8jer\u2026")}>{tr("Tilf\xF8j prisregel")}</SubmitButton>
      </form>
    </div>);

}
