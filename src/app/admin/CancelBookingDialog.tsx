"use client";
// Confirmation for a club-initiated cancellation. It moves money, so it is
// never one click: the manager sees who is affected, what they get back and
// can leave a reason that goes into the customer's e-mail.
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { adminCancelBooking } from "../../lib/club-schedule-actions";
import { Icon } from "../../components/ui";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-danger" disabled={pending} aria-busy={pending}>
      {pending ? "Cancelling…" : "Cancel booking and refund"}
    </button>
  );
}

export function CancelBookingDialog({ bookingId, playerName, when, amountLabel, paid, dark }: { bookingId: string; playerName: string; when: string; amountLabel: string; paid: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded-md ${dark ? "hover:bg-white/15" : "hover:bg-ink/10"}`}
        aria-label={`Cancel ${playerName}'s booking at ${when}`}
        title="Cancel this booking"
      >
        <Icon name="x" size={12} />
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-labelledby={titleId} className="w-[min(92vw,26rem)] rounded-2xl border border-slate-line p-0 text-ink shadow-pop backdrop:bg-ink/40">
        {open && (
          <form action={adminCancelBooking} onSubmit={() => setTimeout(() => setOpen(false), 0)} className="p-5">
            <input type="hidden" name="id" value={bookingId} />
            <h3 id={titleId} className="display text-title">Cancel this booking?</h3>
            <p className="mt-2 text-sm text-slate">
              <strong className="text-ink">{playerName}</strong> · {when}
            </p>
            <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-sm">
              {paid ? (
                <>The player gets a <strong>full refund of {amountLabel}</strong>. When the club cancels, the 24-hour rule does not apply — the payout for this booking is reversed.</>
              ) : (
                <>Nothing has been charged yet. The hold is released and the court opens up again.</>
              )}
            </p>
            <label className="label mt-4 block">
              Reason <span className="font-normal text-slate">(optional, sent to the player)</span>
              <input name="reason" maxLength={280} className="input mt-1" placeholder="e.g. Court resurfacing moved to this week" />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Keep booking</button>
              <ConfirmButton />
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
