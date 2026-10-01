"use client";import { useWebsiteInternational } from "../../components/InternationalProvider";
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { addCourt, renameCourt, removeCourt, saveClubSports } from '../../lib/actions';
import { SubmitButton } from '../../components/SubmitButton';
import { SPORTS, sportLabel, surfaceLabel, type Sport } from '../../lib/sports';
import { SURFACES } from '../../lib/levels';
import { COURT_OPTIONS, facilityLabel } from '../../lib/club-sports';

type Court = {id: string;name: string;sport: string;surface: string;indoor: boolean;priceHour: number | null;memberPriceHour: number | null;bookings: number;};
function Fields({ sports, court }: {sports: Sport[];court?: Court;}) {const { tr, locale } = useWebsiteInternational();
  const [sport, setSport] = useState<Sport>(court?.sport as Sport ?? sports[0]);
  const options = COURT_OPTIONS[sport];
  const [surface, setSurface] = useState(court?.surface ?? options.surfaces[0]);
  const [indoor, setIndoor] = useState(court?.indoor ?? options.indoor);
  const prefix = court?.id ?? 'new';
  return <>
    <div><label className="label" htmlFor={`${prefix}-sport`}>{tr("Sportsgren")}</label>
      <select id={`${prefix}-sport`} className="input" name="sport" value={sport} onChange={(e) => {const s = e.target.value as Sport;setSport(s);setSurface(COURT_OPTIONS[s].surfaces[0]);setIndoor(COURT_OPTIONS[s].indoor);}}>
        {sports.map((s) => <option key={s} value={s}>{sportLabel(s, locale)}</option>)}
      </select></div>
    <div className="min-w-[10rem] flex-1"><label className="label" htmlFor={`${prefix}-name`}>{sport === 'BORDTENNIS' ? tr("Bordets navn") : tr("Banens navn")}</label>
      <input id={`${prefix}-name`} name="name" className="input" defaultValue={court?.name} placeholder={sport === 'BORDTENNIS' ? tr("fx Bord 1") : tr("fx Bane 1")} required /></div>
    <div><label className="label" htmlFor={`${prefix}-surface`}>{sport === 'BORDTENNIS' ? tr("Type") : tr("Underlag")}</label>
      <select id={`${prefix}-surface`} name="surface" className="input" value={surface} onChange={(e) => setSurface(e.target.value)}>
        {!options.surfaces.includes(surface) && <option value={surface} disabled>{surfaceLabel(surface,locale)}{" " + tr("\u2014 v\xE6lg nyt underlag")}</option>}
        {options.surfaces.map((s) => <option key={s} value={s}>{surfaceLabel(s,locale)}</option>)}
      </select></div>
    <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="indoor" checked={indoor} onChange={(e) => setIndoor(e.target.checked)} />{tr("Indend\xF8rs")}</label>
  </>;
}
function ExistingCourt({ court, sports }: {court: Court;sports: Sport[];}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(renameCourt, null);
  return <li className="rounded-xl border border-slate/15 p-3">
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="courtId" value={court.id} />
      <Fields court={court} sports={sports} />
      <div className="w-28"><label className="label" htmlFor={`price-${court.id}`}>{tr("Pris / time")}</label><input className="input" id={`price-${court.id}`} name="priceHour" type="number" min={0} defaultValue={court.priceHour ?? ''} placeholder={tr("klubbens")} /></div>
      <div className="w-28"><label className="label" htmlFor={`member-${court.id}`}>{tr("Medlemspris")}</label><input className="input" id={`member-${court.id}`} name="memberPriceHour" type="number" min={0} defaultValue={court.memberPriceHour ?? ''} placeholder={tr("klubbens")} /></div>
      <SubmitButton pendingText={tr("Gemmer\u2026")}>{tr("Gem")}</SubmitButton>
    </form>
    {state?.error && <p role="alert" className="text-sm text-red-700">{tr(state.error)}</p>}
    {state?.ok && <p role="status" className="text-sm">{tr(state.ok)}</p>}
    <p className="mt-2 text-xs text-slate">{tr("Tomme prisfelter bruger klubbens pris. Sportsgrenen kan ikke \xE6ndres efter f\xF8rste booking.")}</p>
    {court.bookings === 0 ? <form action={removeCourt}><input type="hidden" name="courtId" value={court.id} /><SubmitButton className="btn-ghost" pendingText={tr("Sletter\u2026")}>{tr("Slet") + " "}{court.sport === 'BORDTENNIS' ? tr("bordet") : tr("banen")}</SubmitButton></form> : <p className="text-xs text-slate">{court.bookings}{" " + tr("bookinger \u2014 kan ikke slettes.")}</p>}
  </li>;
}
export function CourtForm({ courts, sports }: {courts: Court[];sports: Sport[];}) {const { tr, locale } = useWebsiteInternational();
  const [state, action] = useFormState(addCourt, null);
  const [sportState, sportAction] = useFormState(saveClubSports, null);
  return <div className="space-y-5">
    <form action={sportAction} className="rounded-xl bg-mist p-4 space-y-3">
      <fieldset><legend className="font-bold mb-2">{tr("Klubbens sportsgrene")}</legend><p className="text-sm text-slate mb-3">{tr("V\xE6lg alle de sportsgrene, klubben tilbyder. Gem valget, f\xF8r du opretter baner eller borde.")}</p>
        <div className="flex flex-wrap gap-4">{SPORTS.map((s) => <label key={s} className="flex gap-2 items-center"><input name="sports" type="checkbox" value={s} defaultChecked={sports.includes(s)} />{sportLabel(s, locale)}</label>)}</div>
      </fieldset>
      <SubmitButton pendingText={tr("Gemmer\u2026")}>{tr("Gem sportsgrene")}</SubmitButton>
      {sportState?.error && <p role="alert">{tr(sportState.error)}</p>}{sportState?.ok && <p role="status">{tr(sportState.ok)}</p>}
    </form>
    {sports.length > 0 && <>
      <h3 className="font-bold">{tr(facilityLabel(sports))}</h3>
      <ul className="space-y-3">{courts.map((c) => <ExistingCourt key={`${c.id}-${sports.join(',')}`} court={c} sports={sports} />)}</ul>
      <form action={action} className="rounded-xl bg-mist p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3"><Fields key={sports.join(',')} sports={sports} /><SubmitButton pendingText={tr("Tilf\xF8jer\u2026")}>{tr("Tilf\xF8j") + " "}{sports.length === 1 && sports[0] === 'BORDTENNIS' ? tr("bord") : tr("bane / bord")}</SubmitButton></div>
        {state?.error && <p role="alert">{tr(state.error)}</p>}{state?.ok && <p role="status">{tr(state.ok)}</p>}
      </form>
    </>}
  </div>;
}
