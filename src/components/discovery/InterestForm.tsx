"use client";

import { useFormState } from "react-dom";
import { registerMarketInterest, type MarketInterestState } from "../../lib/market-interest-actions";
import { SubmitButton } from "../SubmitButton";
import { Icon } from "../ui";

export function InterestForm({ q, sport, kind = "COURTS", label }: { q: string; sport: string; kind?: "COURTS" | "COACHES"; label?: string }) {
  const [state, action] = useFormState<MarketInterestState, FormData>(registerMarketInterest, null);
  if (state?.ok) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 text-left text-sm text-success-ink">
        <Icon name="check" className="mt-0.5 shrink-0" />
        <p>{state.ok}</p>
      </div>
    );
  }
  return (
    <form action={action} className="relative w-full max-w-md text-left">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="sport" value={sport} />
      {/* Honeypot for bots; hidden from people and assistive tech. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="label" htmlFor="interest-q">Where should we look?</label>
      <input id="interest-q" name="q" defaultValue={q} placeholder="City, state or ZIP" className="input" maxLength={120} required />
      <label className="label mt-3" htmlFor="interest-email">Email me when {kind === "COURTS" ? "courts" : "coaches"} open up{label ? ` near ${label}` : ""}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="interest-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" className="input" required />
        <SubmitButton className="btn-court shrink-0" pendingText="Saving…">
          <Icon name="bell" /> Notify me
        </SubmitButton>
      </div>
      {state?.error && <p className="field-error" role="alert">{state.error}</p>}
      <p className="hint">We’ll ask you to confirm your email. One email when it happens, unsubscribe link included — no newsletter.</p>
    </form>
  );
}
