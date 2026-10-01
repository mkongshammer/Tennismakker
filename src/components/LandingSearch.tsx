'use client';
import { useState } from 'react';
import { exploreFromHome } from '../lib/landing-actions';
import { MARKETS, countryLabel } from '../lib/international';
import { SPORTS, sportLabel, type Locale, type Sport } from '../lib/sports';
import { landingCopy } from '../lib/landing-copy';
import { SubmitButton } from './SubmitButton';

export function LandingSearch({ country, sport, locale }: { country: string; sport: Sport; locale: Locale }) {
  const [kind, setKind] = useState('courts'), copy = landingCopy(locale);
  return <div className="landing-search" id="find-dit-spil">
    <div className="flex flex-wrap justify-center gap-1 px-2 pt-2" role="group" aria-label={copy.playCta}>
      {(['courts', 'coaches', 'players'] as const).map(value => <button type="button" key={value} aria-pressed={value === kind} onClick={() => setKind(value)} className={`min-h-12 rounded-full px-5 text-sm font-semibold transition-colors ${kind === value ? 'bg-ink text-white' : 'text-slate hover:bg-mist'}`}>{copy[value]}</button>)}
    </div>
    <form action={exploreFromHome} className="mt-3 grid items-end gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:p-5">
      <input type="hidden" name="kind" value={kind}/><input type="hidden" name="locale" value={locale}/>
      <label className="block rounded-2xl bg-mist/70 px-4 py-2.5 text-xs font-bold text-slate">{copy.country}<select name="country" defaultValue={country} className="mt-1 min-h-8 w-full bg-transparent pr-5 text-base font-semibold text-ink">{MARKETS.map(m => <option value={m.code} key={m.code}>{countryLabel(m.code, locale)}</option>)}</select></label>
      <label className="block rounded-2xl bg-mist/70 px-4 py-2.5 text-xs font-bold text-slate">{copy.sport}<select name="sport" defaultValue={sport} className="mt-1 min-h-8 w-full bg-transparent pr-5 text-base font-semibold text-ink">{SPORTS.map(s => <option value={s} key={s}>{sportLabel(s, locale)}</option>)}</select></label>
      <SubmitButton className="btn-court h-[68px] gap-3 rounded-2xl sm:min-w-40" pendingText={copy.search}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>{copy.search}</SubmitButton>
    </form>
  </div>;
}
