"use client";

// Sæsonhold og klubbens klippekort.
//
// To formularer i én fil, fordi de bruges lige efter hinanden og har samme
// form: klubben opretter noget, medlemmerne køber det, og det lukkes frem
// for at blive slettet — nogen har betalt for det.
import { useFormState } from "react-dom";
import {
  closePunchCard,
  closeSeasonTeam,
  createPunchCard,
  createSeasonTeam,
} from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";
import { SPORTS, sportLabel } from "../../lib/sports";
import type { Locale } from "../../lib/sports";

const DAYS = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];

type Team = {
  id: string;
  name: string;
  dayOfWeek: number;
  hour: number;
  fromDate: Date;
  toDate: Date;
  priceKr: number;
  capacity: number;
  active: boolean;
  paid: number;
};

export function TeamForm({ teams, locale }: { teams: Team[]; locale: Locale }) {
  const [state, action] = useFormState(createSeasonTeam, null);

  return (
    <div className="space-y-5">
      {teams.length > 0 && (
        <ul className="space-y-2">
          {teams.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3"
            >
              <div>
                <p className="font-bold">
                  {t.name}
                  {!t.active && (
                    <span className="ml-2 text-xs font-medium text-slate-light">lukket</span>
                  )}
                </p>
                <p className="text-sm text-slate">
                  {DAYS[t.dayOfWeek]} kl. {String(t.hour).padStart(2, "0")} ·{" "}
                  {t.priceKr > 0 ? `${t.priceKr} kr` : "gratis"} · {t.paid} tilmeldt
                  {t.capacity > 0 && ` af ${t.capacity}`}
                </p>
              </div>
              {t.active && (
                <form action={closeSeasonTeam}>
                  <input type="hidden" name="teamId" value={t.id} />
                  <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">
                    Luk
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4 rounded-xl bg-mist p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="teamName">Holdets navn</label>
            <input
              className="input"
              id="teamName"
              name="name"
              placeholder="fx Voksne begyndere"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="teamSport">Sportsgren</label>
            <select className="input" id="teamSport" name="sport" defaultValue="TENNIS">
              {SPORTS.map((s) => (
                <option key={s} value={s}>{sportLabel(s, locale)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teamDay">Ugedag</label>
            <select className="input" id="teamDay" name="dayOfWeek" defaultValue="2">
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teamHour">Klokken</label>
            <select className="input" id="teamHour" name="hour" defaultValue="17">
              {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teamMinutes">Længde (min)</label>
            <select className="input" id="teamMinutes" name="minutes" defaultValue="60">
              {[45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teamPrice">Pris for sæsonen</label>
            <input className="input" id="teamPrice" name="priceKr" type="number" min={0} required />
          </div>
          <div>
            <label className="label" htmlFor="teamFrom">Fra</label>
            <input className="input" id="teamFrom" name="fromDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="teamTo">Til</label>
            <input className="input" id="teamTo" name="toDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="teamCapacity">Pladser</label>
            <input
              className="input"
              id="teamCapacity"
              name="capacity"
              type="number"
              min={0}
              defaultValue={8}
            />
            <p className="mt-1 text-xs text-slate">0 = intet loft.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="teamLevelFrom">Niveau fra</label>
              <input
                className="input"
                id="teamLevelFrom"
                name="levelFrom"
                type="number"
                min={1}
                max={5}
                defaultValue={1}
              />
            </div>
            <div>
              <label className="label" htmlFor="teamLevelTo">til</label>
              <input
                className="input"
                id="teamLevelTo"
                name="levelTo"
                type="number"
                min={1}
                max={5}
                defaultValue={5}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="teamDesc">Beskrivelse</label>
          <input className="input" id="teamDesc" name="description" maxLength={200} />
        </div>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

        <SubmitButton pendingText="Opretter…">Opret hold</SubmitButton>
      </form>

      <p className="text-sm text-slate">
        Holdet spærrer ikke banen. Vil I have tiden låst, så tildel den også
        som fast bane — så står den optaget for alle andre.
      </p>
    </div>
  );
}

type Card = {
  id: string;
  name: string;
  sessions: number;
  priceKr: number;
  validDays: number;
  active: boolean;
};

export function PunchCardForm({ cards }: { cards: Card[] }) {
  const [state, action] = useFormState(createPunchCard, null);

  return (
    <div className="space-y-5">
      {cards.length > 0 && (
        <ul className="space-y-2">
          {cards.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3"
            >
              <div>
                <p className="font-bold">
                  {c.name}
                  {!c.active && (
                    <span className="ml-2 text-xs font-medium text-slate-light">lukket</span>
                  )}
                </p>
                <p className="text-sm text-slate">
                  {c.sessions} timer · {c.priceKr} kr ·{" "}
                  {Math.round(c.priceKr / c.sessions)} kr pr. time
                  {c.validDays > 0 && ` · gælder ${c.validDays} dage`}
                </p>
              </div>
              {c.active && (
                <form action={closePunchCard}>
                  <input type="hidden" name="cardId" value={c.id} />
                  <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText="…">
                    Luk
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4 rounded-xl bg-mist p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cardName">Navn</label>
            <input
              className="input"
              id="cardName"
              name="name"
              placeholder="fx 10-turskort"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="cardSessions">Antal timer</label>
            <input
              className="input"
              id="cardSessions"
              name="sessions"
              type="number"
              min={2}
              max={100}
              defaultValue={10}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="cardPrice">Samlet pris</label>
            <input className="input" id="cardPrice" name="priceKr" type="number" min={0} required />
          </div>
          <div>
            <label className="label" htmlFor="cardValid">Gælder i (dage)</label>
            <input
              className="input"
              id="cardValid"
              name="validDays"
              type="number"
              min={0}
              defaultValue={0}
            />
            <p className="mt-1 text-xs text-slate">0 = udløber aldrig.</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cardDesc">Beskrivelse</label>
          <input className="input" id="cardDesc" name="description" maxLength={200} />
        </div>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

        <SubmitButton pendingText="Opretter…">Opret klippekort</SubmitButton>
      </form>
    </div>
  );
}
