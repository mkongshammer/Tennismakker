"use client";

// Klubbens kontingenter.
//
// Sæsoner frem for løbende måneder, fordi det er sådan danske klubber gør
// det: "Sommer 01.05 – 30.09" til en fast pris. En månedlig model ville
// tvinge klubberne til at lave deres vedtægter om for at bruge os.
import { useWebsiteInternational } from "../../components/InternationalProvider";import { useFormState } from "react-dom";
import { closeMembershipType, createMembershipType, openMembershipType } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

type Type = {
  id: string;
  name: string;
  seasonName: string;
  description: string | null;
  fromDate: Date;
  toDate: Date;
  priceKr: number;
  capacity: number;
  active: boolean;
  paid: number;
};



export function MembershipForm({ types }: {types: Type[];}) {const { tr, money, currency, timeZone,locale } = useWebsiteInternational();
  const dk=(d:Date)=>d.toLocaleDateString(locale,{timeZone:"UTC",day:"numeric",month:"short",year:"numeric"});
  const [state, action] = useFormState(createMembershipType, null);

  return (
    <div className="space-y-5">
      {types.length > 0 &&
      <ul className="space-y-2">
          {types.map((t) =>
        <li
          key={t.id}
          className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3">

              <div>
                <p className="font-bold">
                  {t.name} — {t.seasonName}
                  {!t.active &&
              <span className="ml-2 text-xs font-medium text-slate-light">{tr("lukket")}</span>
              }
                </p>
                <p className="text-sm text-slate">
                  {dk(t.fromDate)} – {dk(t.toDate)} ·{" "}
                  {t.priceKr > 0 ? `${money(t.priceKr)}` : "gratis"} · {t.paid}{tr("betalt")}
              {t.capacity > 0 && ` af ${t.capacity} pladser`}
                </p>
                {t.description && <p className="text-sm text-slate-light">{t.description}</p>}
              </div>
              <form action={t.active ? closeMembershipType : openMembershipType}>
                <input type="hidden" name="typeId" value={t.id} />
                <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">
                  {t.active ? "Luk for tilmelding" : "Åbn igen"}
                </SubmitButton>
              </form>
            </li>
        )}
        </ul>
      }

      <form action={action} className="space-y-4 rounded-xl bg-mist p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="mtName">{tr("Navn")}</label>
            <input className="input" id="mtName" name="name" placeholder={tr("fx Senior")} required />
          </div>
          <div>
            <label className="label" htmlFor="mtSeason">{tr("S\xE6son")}</label>
            <input
              className="input"
              id="mtSeason"
              name="seasonName"
              placeholder={tr("fx Sommer 2026")}
              required />

          </div>
          <div>
            <label className="label" htmlFor="mtFrom">{tr("G\xE6lder fra")}</label>
            <input className="input" id="mtFrom" name="fromDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="mtTo">{tr("G\xE6lder til")}</label>
            <input className="input" id="mtTo" name="toDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="mtPrice">{tr("Pris")}</label>
            <input
              className="input"
              id="mtPrice"
              name="priceKr"
              type="number"
              min={0}
              placeholder="1200"
              required />

          </div>
          <div>
            <label className="label" htmlFor="mtCapacity">{tr("Pladser")}</label>
            <input
              className="input"
              id="mtCapacity"
              name="capacity"
              type="number"
              min={0}
              defaultValue={0} />

            <p className="mt-1 text-xs text-slate">{tr("0 = intet loft.")}</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="mtDesc">{tr("Beskrivelse")}</label>
          <input
            className="input"
            id="mtDesc"
            name="description"
            placeholder={tr("fx 25-59 \xE5r, inkluderer fri banetid")}
            maxLength={200} />

        </div>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

        <SubmitButton pendingText={tr("Opretter\u2026")}>{tr("Opret kontingent")}</SubmitButton>
      </form>

      <p className="text-sm text-slate">{tr("Pengene g\xE5r ubesk\xE5ret til klubbens egen konto. Vi tager intet af kontingentet \u2014 vi lever af abonnementet.")}


      </p>
    </div>);

}
