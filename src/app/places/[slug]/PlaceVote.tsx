"use client";
// "I want to book here": one e-mail, one tap. Signed-in players vote instantly.
import { useFormState } from "react-dom";
import { voteForPlace, type VoteState } from "../../../lib/club-vote-actions";
import { SubmitButton } from "../../../components/SubmitButton";
import { Icon } from "../../../components/ui";

export function PlaceVote({ slug, sport, email, clubName }: { slug: string; sport: string; email: string; clubName: string }) {
  const [state, action] = useFormState<VoteState, FormData>(voteForPlace, null);
  if (state?.ok) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 text-sm text-success-ink">
        <Icon name="check" className="mt-0.5 shrink-0" />
        <p>{state.ok}</p>
      </div>
    );
  }
  return (
    <form action={action} className="relative">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="sport" value={sport} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="label" htmlFor="place-vote-email">Your email</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="place-vote-email" name="email" type="email" autoComplete="email" defaultValue={email} placeholder="you@example.com" className="input" required />
        <SubmitButton className="btn-court shrink-0" pendingText="Sending…">
          <Icon name="heart" /> I want to book here
        </SubmitButton>
      </div>
      {state?.error && <p className="field-error" role="alert">{state.error}</p>}
      <p className="hint">We tell {clubName} how many players asked, never who. One email when it can be booked, nothing else.</p>
    </form>
  );
}
