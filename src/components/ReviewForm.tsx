"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { submitReview } from "../lib/actions";

export function ReviewForm({ bookingId, what }: { bookingId: string; what: string }) {
  const [state, action] = useFormState(submitReview, null);
  const [rating, setRating] = useState(0);

  if (state?.ok) {
    return <p className="text-sm font-semibold text-bane">{state.ok}</p>;
  }

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="rating" value={rating} />

      <div className="flex gap-1" role="group" aria-label={`Bedøm ${what}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} ud af 5 stjerner`}
            aria-pressed={rating === n}
            className={`text-2xl leading-none ${n <= rating ? "text-grus" : "text-net/25"}`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        className="input"
        name="comment"
        rows={2}
        maxLength={1000}
        placeholder="Hvordan var det? (valgfrit)"
      />

      {state?.error && <p className="text-sm font-semibold text-grus">{state.error}</p>}
      <button className="btn-bane text-sm" disabled={rating === 0}>
        Send anmeldelse
      </button>
    </form>
  );
}

export function Stars({ average, count }: { average: number; count: number }) {
  if (count === 0) {
    return <span className="text-sm text-net/50">Ingen anmeldelser endnu</span>;
  }
  return (
    <span className="text-sm">
      <span className="text-grus">{"★".repeat(Math.round(average))}</span>
      <span className="text-net/25">{"☆".repeat(5 - Math.round(average))}</span>{" "}
      <span className="text-net/60">
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}
