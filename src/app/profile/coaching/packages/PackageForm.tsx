"use client";
import {UiText} from "../../../../components/InternationalProvider";


import { useState } from "react";
import {useWebsiteInternational} from '../../../../components/InternationalProvider';
import { useFormState } from "react-dom";
import { createPackage } from "./actions";
import { SubmitButton } from "../../../../components/SubmitButton";
import {
  MAX_PACKAGE_SESSIONS,
  MIN_PACKAGE_SESSIONS,
} from "../../../../lib/package-limits";

export function PackageForm({ priceHour,currency='DKK' }: { priceHour: number;currency?:string }) {
  const {tr,money}=useWebsiteInternational();
  const [state, action] = useFormState(createPackage, null);

  // Prisen pr. time regnes ud, mens man skriver. Uden det er en pakke bare
  // to tal, og en pakke der er dyrere end enkelttimer er der ingen grund
  // til at købe — det skal træneren kunne se, før de gemmer.
  const [sessions, setSessions] = useState(10);
  const [priceKr, setPriceKr] = useState(0);

  const perHour = sessions > 0 && priceKr > 0 ? Math.round(priceKr / sessions) : null;
  const saving = priceKr > 0 && sessions > 0 ? priceHour * sessions - priceKr : 0;

  return (
    <form action={action} className="card space-y-4">
      <h2 className="display text-2xl"><UiText text="Nyt pakkeforløb"/></h2>

      <div>
        <label className="label" htmlFor="name"><UiText text="Navn"/></label>
        <input className="input" id="name" name="name" placeholder={tr("fx 10-turskort")} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sessions"><UiText text="Antal timer"/></label>
          <input
            className="input"
            id="sessions"
            name="sessions"
            type="number"
            min={MIN_PACKAGE_SESSIONS}
            max={MAX_PACKAGE_SESSIONS}
            value={sessions}
            onChange={(e) => setSessions(Number(e.target.value))}
            required
          />
          <p className="mt-1 text-xs text-slate"><UiText text="Maks."/>{" "}{MAX_PACKAGE_SESSIONS}{" "}<UiText text="timer pr. pakkeforløb."/></p>
        </div>
        <div>
          <label className="label" htmlFor="priceKr">{tr('Samlet pris')} ({currency})</label>
          <input
            className="input"
            id="priceKr"
            name="priceKr"
            type="number"
            min={50}
            max={100000}
            value={priceKr || ""}
            onChange={(e) => setPriceKr(Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description"><UiText text="Beskrivelse"/></label>
        <textarea className="input" id="description" name="description" rows={2} maxLength={300} />
      </div>

      {perHour !== null && (
        <div className="rounded-xl bg-mist p-3 text-sm">
          <span className="font-bold">{money(perHour,currency)} {tr('pr. time')}</span>
          <span className="text-slate"> · {money(priceHour,currency)} {tr('for en enkelttime.')}</span>
          {saving > 0 ? (
            <span className="font-semibold text-court">{tr('Eleven sparer')} {money(saving,currency)}.</span>
          ) : (
            <span className="font-semibold text-court-dark"><UiText text="Pakken er ikke billigere end at betale pr. gang — så er der ingen grund til at købe den."/></span>
          )}
        </div>
      )}

      {state?.error && <p className="text-sm font-semibold text-court-dark">{<UiText text={state.error}/>}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{<UiText text={state.ok}/>}</p>}

      <SubmitButton pendingText="Opretter…"><UiText text="Opret pakken"/></SubmitButton>
    </form>
  );
}
