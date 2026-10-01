'use client';
import {useEffect, useRef, useState} from 'react';
import {useFormStatus} from 'react-dom';
import {setCountry,dismissCountryChoice} from '../lib/actions';
import {acceptAutomaticCountry} from '../lib/location-actions';
import {MARKETS,LANGUAGE_NAMES,LANGUAGES,countryLabel,marketFor} from '../lib/international';
import {phrase} from '../lib/phrases';
import type {CountryDetection} from '../lib/geo';
import type {Locale} from '../lib/sports';
function Continue({locale}:{locale:Locale}){const {pending}=useFormStatus();return <button className="btn-court w-full" disabled={pending}>{phrase(pending?'Gemmer…':'Fortsæt',locale)}</button>;}
export function CountryLocation({detection,country,locale}:{detection:CountryDetection;country:string;locale:Locale}) {
 const dialog=useRef<HTMLDialogElement>(null),[selected,setSelected]=useState(detection.suggestedCountry??country),[language,setLanguage]=useState(locale),[error,setError]=useState(false);
 const tr=(value:string)=>phrase(value,language);
 useEffect(()=>{if(!detection.needsChoice){void acceptAutomaticCountry().catch(()=>{});return;}dialog.current?.showModal();},[detection.needsChoice]);
 if(!detection.needsChoice)return null;
 return <dialog ref={dialog} aria-labelledby="country-dialog-title" aria-describedby="country-dialog-intro" onCancel={e=>{e.preventDefault();void dismissCountryChoice().then(()=>dialog.current?.close()).catch(()=>setError(true));}} className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border-0 bg-chalk p-6 shadow-2xl backdrop:bg-ink/55 sm:p-8">
  <p className="text-xs font-bold uppercase tracking-widest text-court">RacketBuddy</p><h2 id="country-dialog-title" className="display mt-3 text-2xl">{tr('Hvor spiller du?')}</h2>
  <p id="country-dialog-intro" className="mt-3 text-sm text-slate">{tr('Vi kunne ikke bestemme dit land sikkert. Vælg land og sprog, så viser vi de relevante klubber. Du kan altid ændre valget.')}</p>
  <form action={async form=>{try{await setCountry(form);dialog.current?.close();}catch{setError(true);}}} className="mt-6 space-y-4">
   <label className="label">{tr('Land')}<select name="country" autoFocus className="input mt-1" value={selected} onChange={e=>{setSelected(e.target.value);setLanguage(marketFor(e.target.value)!.defaultLocale as Locale);}}>{MARKETS.map(m=><option key={m.code} value={m.code}>{countryLabel(m.code,language)}</option>)}</select></label>
   <label className="label">{tr('Sprog')}<select className="input mt-1" name="locale" value={language} onChange={e=>setLanguage(e.target.value as Locale)}>{LANGUAGES.map(l=><option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>)}</select></label>
   <Continue locale={language}/>{error&&<p role="alert" className="text-sm">{tr('Valget kunne ikke gemmes. Prøv igen.')}</p>}
  </form>
  <form action={dismissCountryChoice} className="mt-4 text-center"><button className="min-h-11 text-sm font-semibold text-slate underline">{tr('Ikke nu')}</button></form>
  <p className="mt-4 text-center text-xs text-slate-light"><a href="https://db-ip.com" target="_blank" rel="noreferrer">IP Geolocation by DB-IP</a></p>
 </dialog>;
}
