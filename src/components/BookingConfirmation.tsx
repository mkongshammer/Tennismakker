// The moment after paying. Everything a player needs next, in one card:
// what, when, where, how to get in, how to cancel, and a calendar file.
import Link from "next/link";
import { formatDate, formatMoney, timeZoneLabel } from "../lib/international";
import { REFUND_WINDOW_HOURS } from "../lib/cancellation-policy";
import { Icon } from "./ui";

type Booking = {
  id: string;
  kind: string;
  startsAt: Date;
  endsAt: Date;
  priceKr: number;
  currency: string;
  timeZone: string;
  court: { name: string; club: { name: string; slug: string; address: string | null; city: string; hasLock: boolean; accessCode: string | null; accessInstructions: string | null } } | null;
  coachProfile: { user: { name: string }; area: string } | null;
};

export function BookingConfirmation({ booking, email, locale }: { booking: Booking; email: string; locale: string }) {
  const club = booking.court?.club ?? null;
  const title = booking.kind === "COURT" && club && booking.court ? `${club.name} · ${booking.court.name}` : `Lesson with ${booking.coachProfile?.user.name ?? "your coach"}`;
  const address = club ? (club.address?.includes(club.city) ? club.address : [club.address, club.city].filter(Boolean).join(", ")) : booking.coachProfile?.area ?? null;
  const date = formatDate(booking.startsAt, locale, booking.timeZone, { weekday: "long", month: "long", day: "numeric" });
  const time = `${formatDate(booking.startsAt, locale, booking.timeZone, { hour: "numeric", minute: "2-digit" })} – ${formatDate(booking.endsAt, locale, booking.timeZone, { hour: "numeric", minute: "2-digit" })}`;
  const refundDeadline = new Date(booking.startsAt.getTime() - REFUND_WINDOW_HOURS * 3600 * 1000);
  const canStillRefund = refundDeadline.getTime() > Date.now();

  return (
    <section className="overflow-hidden rounded-3xl border border-success/30 bg-chalk shadow-lift" aria-labelledby="confirmation-title">
      <div className="flex items-start gap-4 bg-success-soft px-5 py-5 sm:px-7">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-chalk">
          <Icon name="check" size={22} strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <p className="eyebrow text-success-ink">Confirmed</p>
          <h2 id="confirmation-title" className="display mt-1 text-display-md">You’re on the court.</h2>
          <p className="mt-1 text-sm text-success-ink">A receipt is on its way to {email}.</p>
        </div>
      </div>
      <div className="grid gap-6 px-5 py-6 sm:grid-cols-[1.2fr_.8fr] sm:px-7">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-slate">Where</dt>
            <dd className="mt-0.5 text-lg font-bold">{title}</dd>
            {address && (
              <dd className="mt-0.5">
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-court underline-offset-2 hover:underline">
                  <Icon name="pin" size={16} /> {address}
                </a>
              </dd>
            )}
          </div>
          <div>
            <dt className="text-slate">When</dt>
            <dd className="mt-0.5 font-bold">{date}</dd>
            <dd className="data">{time} <span className="font-body text-xs font-normal text-slate">{timeZoneLabel(booking.timeZone, locale)}</span></dd>
          </div>
          <div>
            <dt className="text-slate">Paid</dt>
            <dd className="data mt-0.5 font-bold">{formatMoney(booking.priceKr, booking.currency, locale)}</dd>
          </div>
          {club?.hasLock && (club.accessCode || club.accessInstructions) && (
            <div className="rounded-xl bg-mist p-3">
              <dt className="flex items-center gap-1.5 font-semibold"><Icon name="access" size={16} /> Getting in</dt>
              {club.accessCode && <dd className="data mt-1 text-lg font-bold">{club.accessCode}</dd>}
              {club.accessInstructions && <dd className="mt-1 text-slate">{club.accessInstructions}</dd>}
            </div>
          )}
        </dl>
        <div className="flex flex-col gap-2 self-start">
          <a href={`/bookings/${booking.id}/calendar`} className="btn-ink justify-start">
            <Icon name="calendar" /> Add to calendar
          </a>
          {club && (
            <Link href={`/clubs/${club.slug}`} className="btn-ghost justify-start">
              <Icon name="court" /> Book another time here
            </Link>
          )}
          <p className="mt-2 text-xs leading-relaxed text-slate">
            {canStillRefund
              ? `Plans change? Cancel before ${formatDate(refundDeadline, locale, booking.timeZone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} for a full refund.`
              : `This booking starts in under ${REFUND_WINDOW_HOURS} hours, so it can no longer be refunded.`}
          </p>
        </div>
      </div>
    </section>
  );
}
