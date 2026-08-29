"use client";

// Visning af ledige banetider.
//
// På bred skærm er et gitter med baner som kolonner det rigtige — man kan
// overskue hele dagen på én gang. På telefon var det samme gitter tvunget
// til 560 px bredde og krævede vandret scroll for at nå den sidste bane.
//
// Derfor vender vi det om på telefon: tiderne står under hinanden, og hver
// tid viser hvilke baner der er ledige. Det passer til, hvordan man i
// virkeligheden vælger — man ved hvornår man kan spille, og er mindre
// optaget af hvilken bane det bliver.

import { useState } from "react";
import { bookCourtSlot } from "../lib/actions";
import { SURFACES } from "../lib/levels";

export type Court = { id: string; name: string; surface: string };
export type Slot = { courtId: string; startsAt: string; priceKr: number };

function clock(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function BookButton({
  courtId,
  startsAt,
  children,
  className,
  loggedIn,
}: {
  courtId: string;
  startsAt: string;
  children: React.ReactNode;
  className: string;
  loggedIn: boolean;
}) {
  if (!loggedIn) {
    return (
      <a href="/login" className={className}>
        {children}
      </a>
    );
  }
  return (
    <form action={bookCourtSlot}>
      <input type="hidden" name="courtId" value={courtId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <button className={className}>{children}</button>
    </form>
  );
}

export function BookingGrid({
  courts,
  slots,
  hours,
  day,
  loggedIn,
}: {
  courts: Court[];
  slots: Slot[];
  hours: number[];
  day: string; // ISO-dato for den viste dag
  loggedIn: boolean;
}) {
  const [openHour, setOpenHour] = useState<number | null>(null);

  const key = (courtId: string, hour: number) => `${courtId}_${hour}`;
  const byKey = new Map<string, Slot>();
  for (const s of slots) {
    byKey.set(key(s.courtId, new Date(s.startsAt).getHours()), s);
  }

  const freeAt = (hour: number) =>
    courts
      .map((c) => byKey.get(key(c.id, hour)))
      .filter((s): s is Slot => Boolean(s));

  const hoursWithSlots = hours.filter((h) => freeAt(h).length > 0);

  return (
    <>
      {/* Telefon: én tid pr. række, baner foldes ud ved tryk */}
      <div className="sm:hidden">
        {hoursWithSlots.length === 0 ? (
          <p className="card text-net/60">
            Ingen ledige tider denne dag. Prøv en anden dag ovenfor.
          </p>
        ) : (
          <ul className="space-y-2">
            {hoursWithSlots.map((hour) => {
              const free = freeAt(hour);
              const expanded = openHour === hour;
              const cheapest = Math.min(...free.map((s) => s.priceKr));

              // Er der kun én ledig bane, springer vi udfoldningen over
              if (free.length === 1) {
                const slot = free[0];
                const court = courts.find((c) => c.id === slot.courtId)!;
                return (
                  <li key={hour}>
                    <BookButton
                      courtId={slot.courtId}
                      startsAt={slot.startsAt}
                      loggedIn={loggedIn}
                      className="flex w-full items-center justify-between rounded-lg border border-net/15 bg-white px-4 py-4 text-left"
                    >
                      <span>
                        <span className="text-lg font-bold">{clock(slot.startsAt)}</span>
                        <span className="ml-2 text-sm text-net/60">{court.name}</span>
                      </span>
                      <span className="font-bold text-grus">{slot.priceKr} kr</span>
                    </BookButton>
                  </li>
                );
              }

              return (
                <li key={hour} className="overflow-hidden rounded-lg border border-net/15 bg-white">
                  <button
                    onClick={() => setOpenHour(expanded ? null : hour)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between px-4 py-4 text-left"
                  >
                    <span>
                      <span className="text-lg font-bold">
                        {String(hour).padStart(2, "0")}:00
                      </span>
                      <span className="ml-2 text-sm text-net/60">
                        {free.length} baner ledige
                      </span>
                    </span>
                    <span className="font-bold text-grus">fra {cheapest} kr</span>
                  </button>

                  {expanded && (
                    <ul className="border-t border-net/10">
                      {free.map((slot) => {
                        const court = courts.find((c) => c.id === slot.courtId)!;
                        return (
                          <li key={slot.courtId}>
                            <BookButton
                              courtId={slot.courtId}
                              startsAt={slot.startsAt}
                              loggedIn={loggedIn}
                              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                            >
                              <span>
                                <span className="font-semibold">{court.name}</span>
                                <span className="ml-2 text-sm text-net/60">
                                  {SURFACES[court.surface] ?? court.surface}
                                </span>
                              </span>
                              <span className="font-semibold text-grus">
                                {slot.priceKr} kr
                              </span>
                            </BookButton>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Bred skærm: gitter med baner som kolonner */}
      <div className="hidden sm:block">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-16" />
              {courts.map((c) => (
                <th key={c.id} className="rounded-md bg-bane px-2 py-2 text-sm text-kridt">
                  {c.name}
                  <span className="block text-xs font-normal text-kridt/70">
                    {SURFACES[c.surface] ?? c.surface}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="pr-2 text-right text-sm font-semibold text-net/60">
                  {hour}:00
                </td>
                {courts.map((c) => {
                  const slot = byKey.get(key(c.id, hour));
                  if (!slot) {
                    return (
                      <td key={c.id}>
                        <div className="rounded-md bg-net/5 py-2 text-center text-xs font-semibold text-net/40">
                          —
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={c.id}>
                      <BookButton
                        courtId={c.id}
                        startsAt={slot.startsAt}
                        loggedIn={loggedIn}
                        className="block w-full rounded-md border border-bane/40 py-2 text-center text-xs font-semibold text-bane hover:bg-bane hover:text-kridt"
                      >
                        {slot.priceKr} kr
                      </BookButton>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
