"use client";

import { useFormState } from "react-dom";
import { uploadCoachPhoto } from "./actions";
import { SubmitButton } from "../../../../components/SubmitButton";

export function PhotoForm() {
  const [state, action] = useFormState(uploadCoachPhoto, null);

  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="photo">Vælg et billede</label>
        <input
          className="input"
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          required
        />
        <p className="mt-1 text-xs text-slate">
          Et almindeligt portræt, hvor man kan se dit ansigt. Det beskæres til
          en firkant og vises som en cirkel ved siden af dit navn.
        </p>
      </div>

      {state?.error && <p className="text-sm font-semibold text-court-dark">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}

      <SubmitButton pendingText="Sender…">Send billedet</SubmitButton>
    </form>
  );
}
