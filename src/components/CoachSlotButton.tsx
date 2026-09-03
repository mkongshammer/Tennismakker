"use client";

// Trænerens ledige-tid-knapper.
//
// Et klik sender en anmodning, ikke en booking: træneren skal godkende,
// før timen er solgt, og der trækkes ingen penge før da. Spinneren er der,
// fordi opslaget mod databasen kan tage et øjeblik — uden den ser det ud,
// som om klikket ikke virkede.
import { useFormStatus } from "react-dom";
import { bookCoachSlot } from "../lib/actions";

function SlotLabel({ time }: { time: string }) {
  const { pending } = useFormStatus();
  if (!pending) return <>{time}</>;
  return (
    <svg className="mx-auto h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function CoachSlotButton({
  coachProfileId,
  startsAt,
  time,
}: {
  coachProfileId: string;
  startsAt: string;
  time: string;
}) {
  return (
    <form action={bookCoachSlot}>
      <input type="hidden" name="coachProfileId" value={coachProfileId} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <button className="min-w-[64px] rounded-md border border-ink px-3 py-1.5 text-sm font-semibold text-ink hover:bg-ink hover:text-chalk">
        <SlotLabel time={time} />
      </button>
    </form>
  );
}
