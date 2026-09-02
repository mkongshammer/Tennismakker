"use client";

// Ugekalenderen på trænerprofilen.
//
// Den erstatter et JSON-felt. Formatet i databasen er det samme som før —
// komponenten skriver det bare ned i et skjult felt, så serveren og
// mobilappen ikke mærker forskel.
//
// To valg er værd at kende:
//
// 1. Man klikker på enkelte timer, men der gemmes intervaller. En træner
//    tænker "tirsdag 16-20", ikke "fire timer på en tirsdag" — så timerne
//    slås sammen igen, inden de gemmes, og står som ét interval.
// 2. Der males kun med musen. På en telefon ville et træk hen over
//    kalenderen slås med at rulle siden, og det tab er værre end de ekstra
//    tryk: en typisk uge er en halv snes timer.

import { Fragment, useMemo, useRef, useState } from "react";
import {
  DAY_NAMES,
  WEEK_ORDER,
  describeWeeklySlots,
  hoursToSlots,
  normaliseWeeklySlots,
  slotsToHours,
  weeklyHours,
} from "../../../lib/slots";

const SHORT = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

// Trænertimer ligger i praksis mellem morgen og sen aften. Rammen udvides,
// hvis en træner allerede har gemt tider uden for den.
const DEFAULT_FIRST = 6;
const DEFAULT_LAST = 21; // sidste time man kan begynde på, altså 21-22

export function WeeklyCalendar({ name, defaultValue }: { name: string; defaultValue: string }) {
  const initial = useMemo(() => {
    let parsed: unknown = [];
    try {
      parsed = JSON.parse(defaultValue || "[]");
    } catch {
      parsed = [];
    }
    return slotsToHours(normaliseWeeklySlots(parsed));
  }, [defaultValue]);

  const [hours, setHours] = useState<Set<string>>(initial);
  const painting = useRef<boolean | null>(null);

  const pattern = useMemo(() => hoursToSlots(hours), [hours]);

  const range = useMemo(() => {
    let first = DEFAULT_FIRST;
    let last = DEFAULT_LAST;
    for (const key of Array.from(hours)) {
      const h = Number(key.split("-")[1]);
      if (Number.isInteger(h)) {
        first = Math.min(first, h);
        last = Math.max(last, h);
      }
    }
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [hours]);

  function set(key: string, on: boolean) {
    setHours((prev) => {
      if (prev.has(key) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleDay(day: number) {
    const all = range.every((h) => hours.has(`${day}-${h}`));
    setHours((prev) => {
      const next = new Set(prev);
      for (const h of range) {
        if (all) next.delete(`${day}-${h}`);
        else next.add(`${day}-${h}`);
      }
      return next;
    });
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(pattern)} />

      <div
        className="select-none"
        onPointerUp={() => (painting.current = null)}
        onPointerLeave={() => (painting.current = null)}
      >
        <div className="grid grid-cols-[2rem_repeat(7,1fr)] gap-[2px]">
          <span />
          {WEEK_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              title={`Marker eller ryd hele ${DAY_NAMES[day].toLowerCase()}`}
              className="rounded-md py-1 text-[11px] font-bold text-slate hover:bg-mist"
            >
              {SHORT[day]}
            </button>
          ))}

          {range.map((hour) => (
            <Fragment key={hour}>
              <span className="pr-1 text-right text-[10px] leading-8 text-slate-light">
                {hour}
              </span>
              {WEEK_ORDER.map((day) => {
                const key = `${day}-${hour}`;
                const on = hours.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${DAY_NAMES[day]} ${hour}–${hour + 1}`}
                    onPointerDown={() => {
                      painting.current = !on;
                      set(key, !on);
                    }}
                    onPointerEnter={(e) => {
                      if (e.buttons === 1 && painting.current !== null) set(key, painting.current);
                    }}
                    className={`h-8 rounded-md border transition-colors ${
                      on
                        ? "border-court bg-court"
                        : "border-slate/15 bg-chalk hover:border-court/40"
                    }`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-xs text-slate">
          {pattern.length === 0 ? (
            "Ingen tider valgt endnu. Tryk på timerne, du kan tage elever — eller på en dag for hele dagen."
          ) : (
            <>
              <span className="font-bold">{weeklyHours(pattern)} timer om ugen.</span>{" "}
              {describeWeeklySlots(pattern)}
            </>
          )}
        </p>
        {pattern.length > 0 ? (
          <button
            type="button"
            onClick={() => setHours(new Set())}
            className="shrink-0 text-xs font-bold text-slate underline"
          >
            Ryd alle
          </button>
        ) : null}
      </div>
    </div>
  );
}
