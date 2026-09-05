"use client";

// Ledige banetider.
//
// Signaturen: hver bookbar tid er en flise, der ser ud som et stykke bane —
// sportsgrenens rigtige farve med en kridtlinje tværs over. Tiden står i
// mono, fordi tider skal kunne skimmes i kolonne.
//
// På telefon står tiderne under hinanden og folder ud. På bred skærm er
// gitteret med baner som kolonner rigtigt: man overskuer hele dagen.

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { bookCourtSlot } from "../lib/actions";
import { sportColor, surfaceLabel } from "../lib/sports";
import type { Locale } from "../lib/sports";

export type Court = {
  id: string;
  name: string;
  surface: string;
  sport: string;
  /** Indendørs bane. Vises, fordi det afgør om man kan spille i regnvejr. */
  indoor?: boolean;
};
export type Slot = { courtId: string; startsAt: string; priceKr: number };

function clock(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function BookButtonContent({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  if (!pending) return <>{children}</>;
  return (
    <svg
      className="relative z-10 mx-auto h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Book({
  courtId,
  startsAt,
  className,
  style,
  children,
  loggedIn,
}: {
  courtId: string;
  startsAt: string;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  loggedIn: boolean;
}) {
  if (!loggedIn) {
    return (
      <a href="/login" className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <form action={bookCourtSlot}>
      <input type="hidden" name="courtId" value={courtId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <button className={className} style={style}>
        <BookButtonContent>{children}</BookButtonContent>
      </button>
    </form>
  );
}

export function BookingGrid({
  courts,
  slots,
  hours,
  loggedIn,
  locale,
}: {
  courts: Court[];
  slots: Slot[];
  hours: number[];
  loggedIn: boolean;
  locale: Locale;
}) {
  const [openHour, setOpenHour] = useState<number | null>(null);

  const key = (courtId: string, hour: number) => `${courtId}_${hour}`;
  const byKey = new Map<string, Slot>();
  for (const s of slots) {
    byKey.set(key(s.courtId, new Date(s.startsAt).getHours()), s);
  }

  const freeAt = (hour: number) =>
    courts.map((c) => byKey.get(key(c.id, hour))).filter((s): s is Slot => Boolean(s));

  const hoursWithSlots = hours.filter((h) => freeAt(h).length > 0);
  const sport = courts[0]?.sport ?? "TENNIS";
  const tint = sportColor(sport);

  if (hoursWithSlots.length === 0) {
    return (
      <div className="card text-center">
        <p className="font-semibold">Ingen ledige tider denne dag</p>
        <p className="mt-1 text-sm text-slate">Prøv en anden dag i vælgeren ovenfor.</p>
      </div>
    );
  }

  return (
    <>
      {/* Telefon */}
      <div className="space-y-2.5 sm:hidden">
        {hoursWithSlots.map((hour) => {
          const free = freeAt(hour);
          const expanded = openHour === hour;
          const cheapest = Math.min(...free.map((s) => s.priceKr));

          if (free.length === 1) {
            const slot = free[0];
            const court = courts.find((c) => c.id === slot.courtId)!;
            return (
              <Book
                key={hour}
                courtId={slot.courtId}
                startsAt={slot.startsAt}
                loggedIn={loggedIn}
                style={{ ["--sport" as any]: tint }}
                className="court-tile flex w-full items-center justify-between px-4 pb-6 pt-4 text-left"
              >
                <span className="relative z-10">
                  <span className="data block text-xl font-bold">{clock(slot.startsAt)}</span>
                  <span className="text-sm text-chalk/80">{court.name}</span>
                </span>
                <span className="data relative z-10 text-lg font-bold">{slot.priceKr} kr</span>
              </Book>
            );
          }

          return (
            <div key={hour} className="overflow-hidden rounded-2xl border border-slate/10 bg-chalk shadow-card">
              <button
                onClick={() => setOpenHour(expanded ? null : hour)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
              >
                <span
                  aria-hidden="true"
                  className="h-10 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tint }}
                />
                <span className="flex-1">
                  <span className="data block text-xl font-bold">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                  <span className="text-sm text-slate">{free.length} baner ledige</span>
                </span>
                <span className="data text-base font-bold text-court">fra {cheapest} kr</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 text-slate transition-transform ${expanded ? "rotate-180" : ""}`}
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {expanded && (
                <div className="grid grid-cols-2 gap-2 border-t border-slate/10 p-3">
                  {free.map((slot) => {
                    const court = courts.find((c) => c.id === slot.courtId)!;
                    return (
                      <Book
                        key={slot.courtId}
                        courtId={slot.courtId}
                        startsAt={slot.startsAt}
                        loggedIn={loggedIn}
                        style={{ ["--sport" as any]: tint }}
                        className="court-tile px-3 pb-6 pt-3 text-left"
                      >
                        <span className="relative z-10 block font-semibold">{court.name}</span>
                        <span className="relative z-10 block text-xs text-chalk/80">
                          {surfaceLabel(court.surface, locale)}
                          {court.indoor ? " · indendørs" : ""}
                        </span>
                        <span className="data relative z-10 mt-1 block font-bold">
                          {slot.priceKr} kr
                        </span>
                      </Book>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bred skærm */}
      <div className="hidden sm:block">
        <div className="overflow-hidden rounded-2xl border border-slate/10 bg-chalk shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate/10">
                <th className="w-20" />
                {courts.map((c) => (
                  <th key={c.id} className="px-2 py-3 text-sm">
                    <span className="block font-bold text-ink">{c.name}</span>
                    <span className="block text-xs font-normal text-slate">
                      {surfaceLabel(c.surface, locale)}
                      {c.indoor ? " · indendørs" : ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour} className="border-b border-slate/5 last:border-0">
                  <td className="data py-1.5 pr-3 text-right text-sm font-bold text-slate">
                    {String(hour).padStart(2, "0")}
                  </td>
                  {courts.map((c) => {
                    const slot = byKey.get(key(c.id, hour));
                    if (!slot) {
                      return (
                        <td key={c.id} className="p-1">
                          <div className="rounded-lg bg-mist py-2.5 text-center text-xs text-slate-light">
                            —
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={c.id} className="p-1">
                        <Book
                          courtId={c.id}
                          startsAt={slot.startsAt}
                          loggedIn={loggedIn}
                          style={{ ["--sport" as any]: tint }}
                          className="court-tile block w-full pb-4 pt-2.5 text-center hover:opacity-90"
                        >
                          <span className="data relative z-10 text-sm font-bold">
                            {slot.priceKr} kr
                          </span>
                        </Book>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
