"use client";
import {UiText} from "./InternationalProvider";


// Ledige banetider.
//
// Signaturen: hver bookbar tid er en flise, der ser ud som et stykke bane —
// sportsgrenens rigtige farve med en kridtlinje tværs over. Tiden står i
// mono, fordi tider skal kunne skimmes i kolonne.
//
// På telefon står tiderne under hinanden og folder ud. På bred skærm er
// gitteret med baner som kolonner rigtigt: man overskuer hele dagen.
import { useWebsiteInternational } from "./InternationalProvider";
import { wallParts, formatDate, formatMoney } from "../lib/international";
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
export type Slot = {courtId: string;startsAt: string;priceKr: number;};



function BookButtonContent({ children }: {children: React.ReactNode;}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const { pending } = useFormStatus();
  if (!pending) return <>{children}</>;
  return (
    <svg
      className="relative z-10 mx-auto h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true">

      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>);

}

function Book({
  courtId,
  startsAt,
  className,
  style,
  children,
  loggedIn,
  loginHref = "/login",
  guests = 0,
  waiver = false,
  disabled = false
}: {courtId: string;startsAt: string;className: string;style?: React.CSSProperties;children: React.ReactNode;loggedIn: boolean;loginHref?: string;guests?: number;waiver?: boolean;disabled?: boolean;}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  if (!loggedIn) {
    return (
      <a href={loginHref} className={className} style={style}>
        {children}
      </a>);

  }
  return (
    <form action={bookCourtSlot}>
      <input type="hidden" name="courtId" value={courtId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <input type="hidden" name="guests" value={guests} />
      {waiver && <input type="hidden" name="waiver" value="on" />}
      <button className={className} style={style} disabled={disabled} aria-disabled={disabled}>
        <BookButtonContent>{children}</BookButtonContent>
      </button>
    </form>);

}

export function BookingGrid({
  courts,
  slots,
  hours,
  loggedIn,
  locale,
  currency = "DKK", timeZone = "Europe/Copenhagen",
  loginHref = "/login",
  guestFeeKr = 0,
  guestMax = 0,
  waiverText = null,
  waiverRequired = false
}: {courts: Court[];slots: Slot[];hours: number[];loggedIn: boolean;locale: Locale;currency?: string;timeZone?: string;loginHref?: string;guestFeeKr?: number;guestMax?: number;waiverText?: string | null;waiverRequired?: boolean;}) {const { tr } = useWebsiteInternational();
  const [guests, setGuests] = useState(0);
  const [waiverOk, setWaiverOk] = useState(false);
  const blocked = loggedIn && waiverRequired && !waiverOk;
  const bookProps = { guests, waiver: waiverOk, disabled: blocked };
  const options = loggedIn && (guestMax > 0 || waiverRequired) ? (
    <div className="mb-3 space-y-3 rounded-2xl border border-slate/15 bg-chalk p-4 text-sm">
      {guestMax > 0 && (
        <label className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">{tr("Gæster med på bookingen")}</span>
          <select className="input w-auto py-1.5" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
            {Array.from({ length: guestMax + 1 }).map((_, n) => <option key={n} value={n}>{n === 0 ? tr("Ingen") : `${n}`}</option>)}
          </select>
          <span className="text-slate">{guestFeeKr > 0 ? `${formatMoney(guestFeeKr, currency, locale)} ${tr("pr. gæst, lægges til prisen")}` : tr("Gratis")}</span>
        </label>
      )}
      {waiverRequired && (
        <details className="rounded-xl bg-mist p-3" open>
          <summary className="cursor-pointer font-semibold">{tr("Klubbens ansvarsfraskrivelse")}</summary>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-slate">{waiverText}</p>
          <label className="mt-3 flex items-start gap-2 font-semibold"><input type="checkbox" className="mt-0.5" checked={waiverOk} onChange={(e) => setWaiverOk(e.target.checked)} />{tr("Jeg har læst og accepterer ansvarsfraskrivelsen")}</label>
        </details>
      )}
    </div>
  ) : null;
  // Americans read "8:00 AM"; everyone else keeps the 24-hour clock.
  const twelveHour = locale === "en-US";
  const money = (n: number) => formatMoney(n, currency, locale),clock = (iso: string) => formatDate(iso, locale, timeZone, { hour: twelveHour ? "numeric" : "2-digit", minute: "2-digit", hour12: twelveHour });
  const hourLabel = (hour: number) => twelveHour ? `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? " AM" : " PM"}` : `${String(hour).padStart(2, "0")}:00`;
  const [openHour, setOpenHour] = useState<number | null>(null);

  const key = (courtId: string, hour: number) => `${courtId}_${hour}`;
  const byKey = new Map<string, Slot>();
  for (const s of slots) {
    byKey.set(key(s.courtId, wallParts(s.startsAt, timeZone).hour), s);
  }

  const freeAt = (hour: number) =>
  courts.map((c) => byKey.get(key(c.id, hour))).filter((s): s is Slot => Boolean(s));

  const hoursWithSlots = hours.filter((h) => freeAt(h).length > 0);
  const sport = courts[0]?.sport ?? "TENNIS";
  const tint = sportColor(sport);

  if (hoursWithSlots.length === 0) {
    return (
      <div className="card text-center">
        <p className="font-semibold">{tr("Ingen ledige tider denne dag")}</p>
        <p className="mt-1 text-sm text-slate">{tr("Pr\xF8v en anden dag i v\xE6lgeren ovenfor.")}</p>
      </div>);

  }

  return (
    <>
      {options}
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
                loginHref={loginHref}
                {...bookProps}
                style={{ ["--sport" as any]: tint }}
                className="court-tile flex w-full items-center justify-between px-4 pb-6 pt-4 text-left">

                <span className="relative z-10">
                  <span className="data block text-xl font-bold">{clock(slot.startsAt)}</span>
                  <span className="tile-muted text-sm">{court.name}</span>
                </span>
                <span className="data relative z-10 text-lg font-bold">{money(slot.priceKr)}</span>
              </Book>);

          }

          return (
            <div key={hour} className="overflow-hidden rounded-2xl border border-slate/10 bg-chalk shadow-card">
              <button
                onClick={() => setOpenHour(expanded ? null : hour)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-4 text-left">

                <span
                  aria-hidden="true"
                  className="h-10 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tint }} />

                <span className="flex-1">
                  <span className="data block text-xl font-bold">
                    {hourLabel(hour)}
                  </span>
                  <span className="text-sm text-slate">{free.length}{" " + tr("baner ledige")}</span>
                </span>
                <span className="data text-base font-bold text-court">{tr("fra") + " "}{money(cheapest)}</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 text-slate transition-transform ${expanded ? "rotate-180" : ""}`}
                  fill="none"
                  aria-hidden="true">

                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {expanded &&
              <div className="grid grid-cols-2 gap-2 border-t border-slate/10 p-3">
                  {free.map((slot) => {
                  const court = courts.find((c) => c.id === slot.courtId)!;
                  return (
                    <Book
                      key={slot.courtId}
                      courtId={slot.courtId}
                      startsAt={slot.startsAt}
                      loggedIn={loggedIn}
                loginHref={loginHref}
                      {...bookProps}
                      style={{ ["--sport" as any]: tint }}
                      className="court-tile px-3 pb-6 pt-3 text-left">

                        <span className="relative z-10 block font-semibold">{court.name}</span>
                        <span className="tile-muted relative z-10 block text-xs">
                          {surfaceLabel(court.surface, locale)}
                          {court.indoor ? <UiText text=" · indendørs"/> : ""}
                        </span>
                        <span className="data relative z-10 mt-1 block font-bold">
                          {money(slot.priceKr)}
                        </span>
                      </Book>);

                })}
                </div>
              }
            </div>);

        })}
      </div>

      {/* Bred skærm */}
      <div className="hidden sm:block">
        <div className="overflow-hidden rounded-2xl border border-slate/10 bg-chalk shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate/10">
                <th className="w-20" scope="col"><span className="sr-only">Time</span></th>
                {courts.map((c) =>
                <th key={c.id} scope="col" className="px-2 py-3 text-sm">
                    <span className="block font-bold text-ink">{c.name}</span>
                    <span className="block text-xs font-normal text-slate">
                      {surfaceLabel(c.surface, locale)}
                      {c.indoor ? <UiText text=" · indendørs"/> : ""}
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) =>
              <tr key={hour} className="border-b border-slate/5 last:border-0">
                  <td className="data whitespace-nowrap py-1.5 pr-3 text-right text-xs font-bold text-slate">
                    {hourLabel(hour)}
                  </td>
                  {courts.map((c) => {
                  const slot = byKey.get(key(c.id, hour));
                  if (!slot) {
                    return (
                      <td key={c.id} className="p-1">
                          <div className="rounded-lg bg-mist py-2.5 text-center text-xs text-slate-light">
                            <span aria-hidden="true">—</span><span className="sr-only">Not available</span>
                          </div>
                        </td>);

                  }
                  return (
                    <td key={c.id} className="p-1">
                        <Book
                        courtId={c.id}
                        startsAt={slot.startsAt}
                        loggedIn={loggedIn}
                loginHref={loginHref}
                        {...bookProps}
                        style={{ ["--sport" as any]: tint }}
                        className="court-tile block w-full pb-4 pt-2.5 text-center">

                          <span className="data relative z-10 text-sm font-bold">
                            {money(slot.priceKr)}
                          </span>
                        </Book>
                      </td>);

                })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>);

}
