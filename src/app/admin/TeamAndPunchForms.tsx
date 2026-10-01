"use client";

// Sæsonhold og klubbens klippekort.
//
// To formularer i én fil, fordi de bruges lige efter hinanden og har samme
// form: klubben opretter noget, medlemmerne køber det, og det lukkes frem
// for at blive slettet — nogen har betalt for det.
import { useWebsiteInternational } from "../../components/InternationalProvider";import { useFormState } from "react-dom";
import {
  closePunchCard,
  closeSeasonTeam,
  createPunchCard,
  createSeasonTeam } from
"../../lib/actions";
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

export function TeamForm({ teams, locale }: {teams: Team[];locale: Locale;}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(createSeasonTeam, null);

  return (
    <div className="space-y-5">
      {teams.length > 0 &&
      <ul className="space-y-2">
          {teams.map((t) =>
        <li
          key={t.id}
          className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3">

              <div>
                <p className="font-bold">
                  {t.name}
                  {!t.active &&
              <span className="ml-2 text-xs font-medium text-slate-light">{tr("lukket")}</span>
              }
                </p>
                <p className="text-sm text-slate">
                  {tr(DAYS[t.dayOfWeek])}{" " + tr("kl.") + " "}{String(t.hour).padStart(2, "0")} ·{" "}
                  {t.priceKr > 0 ? `${money(t.priceKr)}` : tr("gratis")} · {t.paid}{tr("tilmeldt")}
              {t.capacity > 0 && ` af ${t.capacity}`}
                </p>
              </div>
              {t.active &&
          <form action={closeSeasonTeam}>
                  <input type="hidden" name="teamId" value={t.id} />
                  <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText={tr("…")}>{tr("Luk")}

            </SubmitButton>
                </form>
          }
            </li>
        )}
        </ul>
      }

      <form action={action} className="space-y-4 rounded-xl bg-mist p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="teamName">{tr("Holdets navn")}</label>
            <input
              className="input"
              id="teamName"
              name="name"
              placeholder={tr("fx Voksne begyndere")}
              required />

          </div>
          <div>
            <label className="label" htmlFor="teamSport">{tr("Sportsgren")}</label>
            <select className="input" id="teamSport" name="sport" defaultValue="TENNIS">
              {SPORTS.map((s) =>
              <option key={s} value={s}>{sportLabel(s, locale)}</option>
              )}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teamDay">{tr("Ugedag")}</label>
            <select className="input" id="teamDay" name="dayOfWeek" defaultValue="2">
              {DAYS.map((d, i) =>
              <option key={i} value={i}>{tr(d)}</option>
              )}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teamHour">{tr("Klokken")}</label>
            <select className="input" id="teamHour" name="hour" defaultValue="17">
              {Array.from({ length: 18 }, (_, i) => i + 6).map((h) =>
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              )}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teamMinutes">{tr("L\xE6ngde (min)")}</label>
            <select className="input" id="teamMinutes" name="minutes" defaultValue="60">
              {[45, 60, 90, 120].map((m) =>
              <option key={m} value={m}>{m}</option>
              )}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="teamPrice">{tr("Pris for s\xE6sonen")}</label>
            <input className="input" id="teamPrice" name="priceKr" type="number" min={0} required />
          </div>
          <div>
            <label className="label" htmlFor="teamFrom">{tr("Fra")}</label>
            <input className="input" id="teamFrom" name="fromDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="teamTo">{tr("Til")}</label>
            <input className="input" id="teamTo" name="toDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="teamCapacity">{tr("Pladser")}</label>
            <input
              className="input"
              id="teamCapacity"
              name="capacity"
              type="number"
              min={0}
              defaultValue={8} />

            <p className="mt-1 text-xs text-slate">{tr("0 = intet loft.")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="teamLevelFrom">{tr("Niveau fra")}</label>
              <input
                className="input"
                id="teamLevelFrom"
                name="levelFrom"
                type="number"
                min={1}
                max={5}
                defaultValue={1} />

            </div>
            <div>
              <label className="label" htmlFor="teamLevelTo">{tr("til")}</label>
              <input
                className="input"
                id="teamLevelTo"
                name="levelTo"
                type="number"
                min={1}
                max={5}
                defaultValue={5} />

            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="teamDesc">{tr("Beskrivelse")}</label>
          <input className="input" id="teamDesc" name="description" maxLength={200} />
        </div>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{tr(state.error)}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{tr(state.ok)}</p>}

        <SubmitButton pendingText={tr("Opretter\u2026")}>{tr("Opret hold")}</SubmitButton>
      </form>

      <p className="text-sm text-slate">{tr("Holdet sp\xE6rrer ikke banen. Vil I have tiden l\xE5st, s\xE5 tildel den ogs\xE5 som fast bane \u2014 s\xE5 st\xE5r den optaget for alle andre.")}


      </p>
    </div>);

}

type Card = {
  id: string;
  name: string;
  sessions: number;
  priceKr: number;
  validDays: number;
  active: boolean;
};

export function PunchCardForm({ cards }: {cards: Card[];}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(createPunchCard, null);

  return (
    <div className="space-y-5">
      {cards.length > 0 &&
      <ul className="space-y-2">
          {cards.map((c) =>
        <li
          key={c.id}
          className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-slate/15 p-3">

              <div>
                <p className="font-bold">
                  {c.name}
                  {!c.active &&
              <span className="ml-2 text-xs font-medium text-slate-light">{tr("lukket")}</span>
              }
                </p>
                <p className="text-sm text-slate">
                  {c.sessions}{" " + tr("timer \xB7") + " "}{money(c.priceKr)} ·{" "}
                  {money(Math.round(c.priceKr / c.sessions))} / {tr("time")}
                  {c.validDays > 0 && ` · gælder ${c.validDays} dage`}
                </p>
              </div>
              {c.active &&
          <form action={closePunchCard}>
                  <input type="hidden" name="cardId" value={c.id} />
                  <SubmitButton className="btn-ghost px-3 py-1 text-sm" pendingText={tr("…")}>{tr("Luk")}

            </SubmitButton>
                </form>
          }
            </li>
        )}
        </ul>
      }

      <form action={action} className="space-y-4 rounded-xl bg-mist p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cardName">{tr("Navn")}</label>
            <input
              className="input"
              id="cardName"
              name="name"
              placeholder={tr("fx 10-turskort")}
              required />

          </div>
          <div>
            <label className="label" htmlFor="cardSessions">{tr("Antal timer")}</label>
            <input
              className="input"
              id="cardSessions"
              name="sessions"
              type="number"
              min={2}
              max={100}
              defaultValue={10}
              required />

          </div>
          <div>
            <label className="label" htmlFor="cardPrice">{tr("Samlet pris")}</label>
            <input className="input" id="cardPrice" name="priceKr" type="number" min={0} required />
          </div>
          <div>
            <label className="label" htmlFor="cardValid">{tr("G\xE6lder i (dage)")}</label>
            <input
              className="input"
              id="cardValid"
              name="validDays"
              type="number"
              min={0}
              defaultValue={0} />

            <p className="mt-1 text-xs text-slate">{tr("0 = udl\xF8ber aldrig.")}</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cardDesc">{tr("Beskrivelse")}</label>
          <input className="input" id="cardDesc" name="description" maxLength={200} />
        </div>

        {state?.error && <p className="text-sm font-semibold text-court-dark">{tr(state.error)}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{tr(state.ok)}</p>}

        <SubmitButton pendingText={tr("Opretter\u2026")}>{tr("Opret klippekort")}</SubmitButton>
      </form>
    </div>);

}
