"use client";

// Tildeling af faste baner.
//
// Klubben tildeler, medlemmet booker ikke selv. Det er sådan det foregår i
// virkeligheden: faste baner fordeles af bestyrelsen efter anciennitet
// eller lodtrækning, og der er flere ansøgere end tider. En selvbetjent
// "book fast bane" ville give den til den, der sad ved computeren klokken
// otte den rigtige morgen.
import { useFormState } from "react-dom";
import { assignFixedSlot, dropFixedSlot } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

const DAYS = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

type Court = { id: string; name: string };
type Member = { id: string; name: string };
type Slot = {
  id: string;
  dayOfWeek: number;
  hour: number;
  fromDate: Date;
  toDate: Date;
  priceKr: number;
  note: string | null;
  court: { name: string };
  user: { name: string };
};

export function FixedSlotForm({
  courts,
  members,
  slots,
  defaultPrice,
}: {
  courts: Court[];
  members: Member[];
  slots: Slot[];
  defaultPrice: number;
}) {
  const [state, action] = useFormState(assignFixedSlot, null);

  return (
    <div className="space-y-5">
      {slots.length > 0 && (
        <ul className="space-y-2">
          {slots.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3"
            >
              <div>
                <p className="font-bold">
                  {s.court.name} · {DAYS[s.dayOfWeek]} kl. {String(s.hour).padStart(2, "0")}
                </p>
                <p className="text-sm text-slate">
                  {s.user.name} ·{" "}
                  {s.fromDate.toLocaleDateString("da-DK", { day: "numeric", month: "short" })} –{" "}
                  {s.toDate.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })}
                  {s.priceKr > 0 && ` · ${s.priceKr} kr/time`}
                </p>
                {s.note && <p className="text-sm text-slate-light">{s.note}</p>}
              </div>
              <form action={dropFixedSlot}>
                <input type="hidden" name="slotId" value={s.id} />
                <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">
                  Ophæv
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {members.length === 0 ? (
        <p className="rounded-xl bg-mist p-4 text-sm text-slate">
          Der er ingen medlemmer endnu. Del jeres tilmeldingskode, så
          medlemmerne kan koble sig på klubben — så kan I tildele faste baner.
        </p>
      ) : (
        <form action={action} className="space-y-4 rounded-xl bg-mist p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fixedUser">Medlem</label>
              <select className="input" id="fixedUser" name="userId" required>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fixedCourt">Bane</label>
              <select className="input" id="fixedCourt" name="courtId" required>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fixedDay">Ugedag</label>
              <select className="input" id="fixedDay" name="dayOfWeek" defaultValue="2">
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fixedHour">Klokken</label>
              <select className="input" id="fixedHour" name="hour" defaultValue="17">
                {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fixedFrom">Fra</label>
              <input className="input" id="fixedFrom" name="fromDate" type="date" required />
            </div>
            <div>
              <label className="label" htmlFor="fixedTo">Til</label>
              <input className="input" id="fixedTo" name="toDate" type="date" required />
            </div>
            <div>
              <label className="label" htmlFor="fixedPrice">Pris pr. time</label>
              <input
                className="input"
                id="fixedPrice"
                name="priceKr"
                type="number"
                min={0}
                defaultValue={0}
              />
              <p className="mt-1 text-xs text-slate">
                0 hvis den faste bane er dækket af kontingentet. Jeres
                medlemspris er {defaultPrice} kr.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="fixedNote">Note</label>
              <input className="input" id="fixedNote" name="note" placeholder="fx doublehold" />
            </div>
          </div>

          {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
          {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

          <SubmitButton pendingText="Opretter sæsonen…">Tildel fast bane</SubmitButton>
        </form>
      )}
    </div>
  );
}
