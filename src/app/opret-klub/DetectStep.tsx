"use client";
import {UiText,useWebsiteInternational} from "../../components/InternationalProvider";


// Første skridt i klubopsætningen.
//
// I stedet for at bede en klubformand om tekniske oplysninger, kigger vi
// selv på deres hjemmeside og fortæller, hvad vi fandt. Det flytter
// arbejdet fra dem til os — og det er hele forskellen på, om en
// bestyrelse gider gå videre.

import { useFormState } from "react-dom";
import { detectClubSystem } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

export function DetectStep() {
  const {tr}=useWebsiteInternational();
  const [state, action] = useFormState(detectClubSystem, null);
  const d = state?.detection;

  return (
    <div className="card">
      <h2 className="display text-xl"><UiText text="Hvilket system bruger I?"/></h2>
      <p className="mt-1 text-sm text-slate"><UiText text="Skriv jeres hjemmeside, så finder vi ud af det. I behøver ikke vide noget teknisk."/></p>

      <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          name="website"
          placeholder={tr("fx soendermarktennis.dk")}
          aria-label={tr("Jeres hjemmeside")}
        />
        <SubmitButton className="btn-ghost" pendingText="Kigger…"><UiText text="Find systemet"/></SubmitButton>
      </form>

      {state?.error && (
        <p className="mt-3 text-sm font-semibold text-court">{<UiText text={state.error}/>}</p>
      )}

      {d && (
        <div className="mt-4 rounded-xl border border-slate/15 bg-mist p-4">
          <p className="font-semibold">{d.message}</p>
          {d.system && <p className="mt-2 text-sm text-slate">{d.system.advice}</p>}

          {d.icalUrl && (
            <div className="mt-3">
              <p className="text-sm font-semibold"><UiText text="Kalender fundet"/></p>
              <p className="data mt-1 break-all text-xs text-slate">{d.icalUrl}</p>
              <p className="mt-2 text-xs text-slate"><UiText text="Gem den — I kan sætte den ind under opsætning, når klubben er godkendt."/></p>
            </div>
          )}

          {d.clubName && (
            <p className="mt-3 text-sm text-slate"><UiText text="Klubnavn fundet:"/>{" "}<span className="font-semibold">{d.clubName}</span>{" "}<UiText text="— skriv det ind nedenfor."/></p>
          )}
        </div>
      )}
    </div>
  );
}
