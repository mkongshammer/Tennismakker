"use client";
// Player-side cancellation. Cancelling can forfeit money, so it is a two-step
// action that states the consequence before the player commits.
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelBooking } from "../lib/actions";

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-danger" disabled={pending} aria-busy={pending}>
      {pending ? "Cancelling…" : label}
    </button>
  );
}

export function CancelBookingButton({ bookingId, what, when, refundable, charged, amountLabel, deadlineLabel }: {
  bookingId: string;
  what: string;
  when: string;
  /** True when cancelling now returns the payment (start ≥ 24 h away). */
  refundable: boolean;
  /** False for holds and requests where nothing has been paid yet. */
  charged: boolean;
  amountLabel: string;
  deadlineLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  const consequence = !charged
    ? "Nothing has been charged, so there is nothing to refund."
    : refundable
      ? `You will get ${amountLabel} back, usually within 5–10 business days.`
      : `This starts in under 24 hours, so the ${amountLabel} you paid will not be refunded.`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">Cancel</button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-labelledby={titleId} className="w-[min(92vw,26rem)] rounded-2xl border border-slate-line p-0 text-ink shadow-pop backdrop:bg-ink/40">
        {open && (
          <form action={cancelBooking} onSubmit={() => setTimeout(() => setOpen(false), 0)} className="p-5">
            <input type="hidden" name="id" value={bookingId} />
            <h3 id={titleId} className="display text-title">Cancel this booking?</h3>
            <p className="mt-2 text-sm text-slate"><strong className="text-ink">{what}</strong> · {when}</p>
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${charged && !refundable ? "bg-warning-soft text-warning-ink" : "bg-mist"}`}>{consequence}</p>
            {charged && refundable && deadlineLabel && <p className="mt-2 text-xs text-slate">Free cancellation until {deadlineLabel}.</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Keep booking</button>
              <ConfirmButton label={charged && !refundable ? "Cancel without refund" : "Cancel booking"} />
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
