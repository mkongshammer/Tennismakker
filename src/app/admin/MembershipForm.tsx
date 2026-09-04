"use client";

// Klubbens kontingenter.
//
// Sæsoner frem for løbende måneder, fordi det er sådan danske klubber gør
// det: "Sommer 01.05 – 30.09" til en fast pris. En månedlig model ville
// tvinge klubberne til at lave deres vedtægter om for at bruge os.
import { useFormState } from "react-dom";
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

const dk = (d: Date) =>
  d.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });

export function MembershipForm({ types }: { types: Type[] }) {
  const [state, action] = useFormState(createMembershipType, null);

  return (
    <div className="space-y-5">
      {types.length > 0 && (
        <ul className="space-y-2">
          {types.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3"
            >
              <div>
                <p className="font-bold">
                  {t.name} — {t.seasonName}
                  {!t.active && (
                    <span className="ml-2 text-xs font-medium text-slate-light">lukket</span>
                  )}
                </p>
                <p className="text-sm text-slate">
                  {dk(t.fromDate)} – {dk(t.toDate)} ·{" "}
                  {t.priceKr > 0 ? `${t.priceKr} kr` : "gratis"} · {t.paid} betalt
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
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4 rounded-xl bg-mist p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="mtName">Navn</label>
            <input className="input" id="mtName" name="name" placeholder="fx Senior" required />
          </div>
          <div>
            <label className="label" htmlFor="mtSeason">Sæson</label>
            <input
              className="input"
              id="mtSeason"
              name="seasonName"
              placeholder="fx Sommer 2026"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="mtFrom">Gælder fra</label>
            <input className="input" id="mtFrom" name="fromDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="mtTo">Gælder til</label>
            <input className="input" id="mtTo" name="toDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="mtPrice">Pris</label>
            <input
              className="input"
              id="mtPrice"
              name="priceKr"
              type="number"
              min={0}
              placeholder="1200"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="mtCapacity">Pladser</label>
            <input
              className="input"
              id="mtCapacity"
              name="capacity"
              type="number"
              min={0}
              defaultValue={0}
            />
            <p className="mt-1 text-xs text-slate">0 = intet loft.</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="mtDesc">Beskrivelse</label>
          <input
            className="input"
            id="mtDesc"
            name="description"
            placeholder="fx 25-59 år, inkluderer fri banetid"
            maxLength={200}
          />
        </div>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

        <SubmitButton pendingText="Opretter…">Opret kontingent</SubmitButton>
      </form>

      <p className="text-sm text-slate">
        Pengene går ubeskåret til klubbens egen konto. Vi tager intet af
        kontingentet — vi lever af abonnementet.
      </p>
    </div>
  );
}
