"use client";

// Trænerens ledige-tid-knapper.
//
// Et klik åbner en lille bekræftelse med et valgfrit notefelt: det er den ene
// besked, spiller og træner udveksler før en betalt time åbner chatten
// (træneren svarer med sin egen note). Selve afsendelsen er stadig en
// anmodning, ikke en booking — der trækkes ingen penge, før træneren siger ja.
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { bookCoachSlot } from "../lib/actions";

const NOTE_MAX = 500;

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="btn-court">
      {pending ? "Sending…" : "Send request"}
    </button>
  );
}

export function CoachSlotButton({
  coachProfileId,
  startsAt,
  time,
  dayLabel,
  coachFirstName,
}: {
  coachProfileId: string;
  startsAt: string;
  time: string;
  /** "Thu, Oct 22" — shown in the confirmation. */
  dayLabel?: string;
  coachFirstName?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const who = coachFirstName || "the coach";
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="min-w-[64px] rounded-md border border-ink px-3 py-1.5 text-sm font-semibold text-ink hover:bg-ink hover:text-chalk"
      >
        {time}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`req-${startsAt}`}
        className="w-[min(92vw,28rem)] rounded-2xl border border-slate/15 bg-chalk p-0 text-ink shadow-pop backdrop:bg-ink/40"
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
      >
        <form action={bookCoachSlot} className="space-y-4 p-5">
          <input type="hidden" name="coachProfileId" value={coachProfileId} />
          <input type="hidden" name="startsAt" value={startsAt} />
          <div>
            <h3 id={`req-${startsAt}`} className="display text-title">Request {dayLabel ? `${dayLabel}, ` : ""}{time}</h3>
            <p className="mt-1 text-sm text-slate">{who} confirms first. Nothing is charged until then.</p>
          </div>
          <label className="block">
            <span className="text-sm font-semibold">Note to {who} <span className="font-normal text-slate">(optional)</span></span>
            <textarea
              name="note"
              maxLength={NOTE_MAX}
              rows={4}
              placeholder="E.g. your level, what you'd like to work on, or a question about the lesson."
              className="input mt-1.5 w-full resize-y"
            />
          </label>
          <p className="text-xs text-slate">Messaging opens once the lesson is accepted and paid. Until then, this note and {who}&apos;s reply are how you two talk.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()}>Cancel</button>
            <SendButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
