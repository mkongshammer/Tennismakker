'use client';
import {pricesForCountry,type PriceBook} from '../../lib/platform-pricing';
import {useState} from 'react';
import {useFormState} from 'react-dom';
import {registerClub} from '../../lib/club-onboarding-actions';
import {CUSTOM_FEATURES} from '../../lib/club-features';
import {SPORTS,sportLabel,type Locale} from '../../lib/sports';
import {MARKETS,TIME_ZONES,bookingCurrency,countryLabel,marketFor,formatMoney} from '../../lib/international';
import {US_STATES,usStateTimeZone} from '../../../shared/us-address.mjs';
import {phrase} from '../../lib/phrases';
import {termsHref} from '../../lib/legal-market';
import {SubmitButton} from '../../components/SubmitButton';

const DEFAULT_COURT_PRICE:Record<string,number>={DKK:100,SEK:150,NOK:150,EUR:12,GBP:10,USD:15,CAD:20,CHF:12,PLN:50,CZK:275};

export function SignupForm({priceBook,locale='da',initialCountry='DK',initialMode='STANDARD'}:{priceBook:PriceBook;locale?:Locale;initialCountry?:string;initialMode?:'STANDARD'|'CUSTOM'}){
 const [mode,setMode]=useState(initialMode),[sports,setSports]=useState<string[]>(['TENNIS']),[state,action]=useFormState(registerClub,null);
 const [country,setCountry]=useState(initialCountry),[currency,setCurrency]=useState(bookingCurrency(initialCountry)),[timeZone,setTimeZone]=useState(marketFor(initialCountry)?.timeZone??'Europe/Copenhagen'),[usState,setUsState]=useState('');
 const prices=pricesForCountry(priceBook,country);
 const tr=(value:string)=>phrase(value,locale),price=mode==='CUSTOM'?prices.custom:prices.standard,money=(p:number)=>formatMoney(p,prices.currency,locale);
 const isUS=country==='US';
 return <form action={action} className="space-y-6"><input type="hidden" name="locale" value={locale}/>
 <section className="card space-y-4"><h2 className="display text-2xl">{tr("1. Vælg jeres løsning")}</h2><div className="grid gap-3 sm:grid-cols-2">{[['STANDARD','Standard',prices.standard],['CUSTOM','Custom',prices.custom]].map(([id,label,p])=><label key={id} className={`rounded-2xl border p-4 cursor-pointer ${mode===id?'border-court bg-court/5':'border-slate/20'}`}><input type="radio" name="mode" value={id??''} checked={mode===id} onChange={()=>setMode(id==='CUSTOM'?'CUSTOM':'STANDARD')}/> <strong>{label}</strong><p className="mt-2">{p==null?tr("Pris ikke offentliggjort"):id==='CUSTOM'?`${money(Number(p))} ${tr("én gang")} + ${money(prices.standard)}/${tr("måned")}`:`${money(Number(p))}/${tr("måned")}`}</p><p className="text-sm text-slate mt-1">{id==='STANDARD'?tr("Standard klubadministration med baner, bookinger og betaling."):tr("Standardadministration plus de funktioner, I vælger nedenfor. Engangsprisen er den samme uanset antal funktioner.")}</p></label>)}</div>{mode==='CUSTOM'&&<div className="grid gap-3 sm:grid-cols-2">{CUSTOM_FEATURES.map(feature=><label key={feature.id} className="flex gap-3 rounded-xl border border-slate/15 p-3"><input type="checkbox" name="features" value={feature.id}/>{phrase(feature.label,locale)}</label>)}</div>}<p className="text-sm text-slate">{tr("Klubpriser er ekskl. eventuel moms eller sales tax. Det samlede beløb vises før betaling.")}</p><input type="hidden" name="monthlyQuote" value={prices.standard}/><input type="hidden" name="billingCurrency" value={prices.currency}/><input type="hidden" name="quote" value={price??''}/></section>
 <section className="card space-y-4"><h2 className="display text-2xl">{tr("2. Klub og baner")}</h2><div className="grid gap-4 sm:grid-cols-2">
 <label className="label">{tr("Land")}<select className="input" name="country" autoComplete="country" value={country} onChange={e=>{const next=e.target.value;setCountry(next);const m=marketFor(next)!;setCurrency(bookingCurrency(next));setTimeZone(m.timeZone);setUsState('');}}>{MARKETS.map(m=><option key={m.code} value={m.code}>{countryLabel(m.code,locale)}</option>)}</select></label>
 <label className="label">{tr("Valuta for klubbookinger")}<div className="input flex items-center" aria-label={tr("Valuta for klubbookinger")}>{currency}</div></label>
 <label className="label sm:col-span-2">{tr("Klubbens tidszone")}<select className="input" name="timeZone" value={timeZone} onChange={e=>setTimeZone(e.target.value)}>{TIME_ZONES.map(z=><option key={z}>{z}</option>)}</select></label>
 <label className="label">{tr("Klubbens navn")}<input className="input" name="name" autoComplete="organization" required maxLength={150}/></label>
 <label className="label">{tr("Dit navn")}<input className="input" name="contact" autoComplete="name" required maxLength={150}/></label>
 {isUS?<>
   <label className="label sm:col-span-2">Street address<input className="input" name="address" autoComplete="street-address" enterKeyHint="next" required maxLength={150} placeholder="123 Main St"/></label>
   <label className="label">City<input className="input" name="city" autoComplete="address-level2" required maxLength={100} placeholder="Boston"/></label>
   <label className="label">State<select className="input" name="state" autoComplete="address-level1" required value={usState} onChange={e=>{setUsState(e.target.value);if(e.target.value)setTimeZone(usStateTimeZone(e.target.value));}}><option value="" disabled>Select state</option>{US_STATES.map(s=><option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}</select></label>
   <label className="label">ZIP code<input className="input" name="postalCode" autoComplete="postal-code" inputMode="numeric" required maxLength={10} pattern="[0-9]{5}(-[0-9]{4})?" placeholder="02108"/></label>
   <p className="self-end pb-3 text-xs text-slate">Your browser can securely autofill a saved US address. City, state and ZIP stay editable before you continue.</p>
 </>:<>
   <label className="label">{tr("By")}<input className="input" name="city" autoComplete="address-level2" required maxLength={100}/></label>
   <label className="label">{tr("Adresse")}<input className="input" name="address" autoComplete="street-address" required maxLength={150}/></label>
 </>}
 <label className="label">{tr("Banepris pr. time")} ({currency})<input className="input" name="priceHour" type="number" min="0" max="10000" key={currency} defaultValue={DEFAULT_COURT_PRICE[currency]??12} required/></label></div>
 <p className="text-sm text-slate">{tr("Vælg sportsgrene og antal baner eller borde. I kan ændre navne, underlag, priser og åbningstider i administrationen.")}</p>
 <div className="grid gap-3 sm:grid-cols-2">{SPORTS.map(s=><div key={s} className="rounded-xl border border-slate/15 p-3"><label className="flex gap-2"><input type="checkbox" name="sports" value={s} checked={sports.includes(s)} onChange={e=>setSports(e.target.checked?[...sports,s]:sports.filter(x=>x!==s))}/>{sportLabel(s,locale)}</label>{sports.includes(s)&&<label className="label mt-2 block">{s==='BORDTENNIS'?tr("Antal borde"):tr("Antal baner")}<input className="input" name={'count_'+s} type="number" min="1" max="30" defaultValue="1" required/></label>}</div>)}</div></section>
 <section className="card space-y-4"><h2 className="display text-2xl">{tr("3. Opret klublogin")}</h2><label className="label block">{tr("E-mail")}<input className="input" name="email" type="email" autoComplete="email" required/></label><label className="label block">{tr("Adgangskode")}<input className="input" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required/></label><p className="text-sm text-slate">{tr("Brug mindst 10 tegn. Det samme login virker på hjemmesiden og under Klublogin i appen.")}</p>
 <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="terms" required/><span>{tr("Jeg må oprette klubben og accepterer")} <a className="underline" href={termsHref(country)} target="_blank" rel="noreferrer">{tr("handelsbetingelserne")}</a> {tr("og")} <a className="underline" href="/databehandleraftale" target="_blank" rel="noreferrer">{tr("databehandleraftalen")}</a>. {mode==='CUSTOM'&&`${tr("Custom koster")} ${price==null?'—':money(price)} ${tr("én gang, uanset antal funktioner.")} `}{tr("Abonnementet på")} {money(prices.standard)}/{tr("måned starter ved betaling og fornyes månedligt indtil opsigelse. Klubben offentliggøres først efter RacketBuddys godkendelse.")}</span></label>
 {state?.error&&<p role="alert" className="text-court font-semibold">{phrase(state.error,locale)}</p>}<SubmitButton className="btn-court w-full" disabled={price==null} pendingText={tr("Opretter klub…")}>{tr("Opret klub og fortsæt til betaling")}</SubmitButton>{price==null&&<p>{tr("Custom-prisen skal offentliggøres af RacketBuddy, før I kan tilmelde jer.")}</p>}</section>
 </form>;
}
