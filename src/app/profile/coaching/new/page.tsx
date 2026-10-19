"use client";
import {UiText} from "../../../../components/InternationalProvider";


import {useWebsiteInternational} from "../../../../components/InternationalProvider";
import {SALES_CURRENCIES,TIME_ZONES,marketFor} from "../../../../lib/international";
import { useFormState } from "react-dom";
import { SPORTS, sportLabel } from "../../../../lib/sports";
import { DK_REGIONS } from "../../../../lib/regions";
import { createCoachProfile } from "./actions";
import { SubmitButton } from "../../../../components/SubmitButton";

export default function OpretTraenerprofilPage() {
  const {country,locale,tr}=useWebsiteInternational(),market=marketFor(country)!;
  const [state, action] = useFormState(createCoachProfile, null);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="display text-3xl"><UiText text="Opret trænerprofil"/></h1>
      <p className="mt-2 text-slate"><UiText text="Din spillerprofil bliver stående. Du får bare også en trænerprofil på samme konto."/></p>

      <form action={action} className="card mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="headline"><UiText text="Overskrift"/></label>
          <input
            className="input"
            id="headline"
            name="headline"
            maxLength={120}
            placeholder={tr("Fx erfaren tennistræner for begyndere og øvede")}
            required
          />
        </div>

        <div>
          <span className="label"><UiText text="Hvilke sportsgrene vil du tilbyde træning i?"/></span>
          <p className="mb-3 mt-1 text-xs text-slate"><UiText text="Du kan vælge flere."/></p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SPORTS.map((sport) => (
              <label key={sport} className="flex items-center gap-2 rounded-xl border border-slate/15 p-3 text-sm font-semibold">
                <input type="checkbox" name="sports" value={sport} />
                {sportLabel(sport, locale)}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="priceHour"><UiText text="Pris / time"/></label>
            <input className="input" id="priceHour" name="priceHour" type="number" min={1} max={10000} defaultValue={market.currency==='USD'?53:47} required />
          </div>
          <div>
            <label className="label" htmlFor="area"><UiText text="Region"/></label>
            {country==="DK"?<select className="input" id="area" name="area" defaultValue="" required>
              <option value="" disabled><UiText text="Vælg region"/></option>
              {DK_REGIONS.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>:<input className="input" id="area" name="area" required minLength={2} maxLength={100}/>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2"><label className="label">{tr("Valuta")}<select name="currency" className="input" defaultValue={market.currency}>{SALES_CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></label><label className="label">{tr("Lokal tidszone")}<select name="timeZone" className="input" defaultValue={market.timeZone}>{TIME_ZONES.map(z=><option key={z}>{z}</option>)}</select></label></div>
        {state?.error ? <p className="text-sm font-semibold text-court">{<UiText text={state.error}/>}</p> : null}

        <SubmitButton className="btn-court w-full" pendingText="Opretter…"><UiText text="Opret trænerprofil"/></SubmitButton>
      </form>
    </div>
  );
}
