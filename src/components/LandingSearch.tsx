'use client';
import { useEffect, useState } from 'react';
import { exploreFromHome } from '../lib/landing-actions';
import { MARKETS, countryLabel } from '../lib/international';
import { SPORTS, sportLabel, type Locale, type Sport } from '../lib/sports';
import { landingCopy } from '../lib/landing-copy';
import { SubmitButton } from './SubmitButton';
import { DiscoveryPicker } from './DiscoveryPicker';
import { Ball } from './Ball';

function countryFlag(code: string) { return String.fromCodePoint(...[...code].map(letter => letter.charCodeAt(0) + 127397)); }

export function LandingSearch({ country, sport, locale }: { country: string; sport: Sport; locale: Locale }) {
  const [kind, setKind] = useState('courts'), copy = landingCopy(locale);
  const [selectedCountry, setCountry] = useState(country), [selectedSport, setSport] = useState(sport);
  const [panel, setPanel] = useState<'country' | 'sport' | null>(null);
  useEffect(() => setCountry(country), [country]);
  useEffect(() => setSport(sport), [sport]);
  return <div className="landing-search" id="find-dit-spil">
    <div className="flex flex-wrap justify-center gap-1 px-2 pt-2" role="group" aria-label={copy.playCta}>
      {(['courts', 'coaches', 'players'] as const).map(value => <button type="button" key={value} aria-pressed={value === kind} onClick={() => setKind(value)} className={`min-h-12 rounded-full px-5 text-sm font-semibold transition-colors ${kind === value ? 'bg-ink text-white' : 'text-slate hover:bg-mist'}`}>{copy[value]}</button>)}
    </div>
    <form action={exploreFromHome} className="discovery-form">
      <input type="hidden" name="kind" value={kind}/><input type="hidden" name="locale" value={locale}/>
      <DiscoveryPicker name="country" label={copy.country} title={copy.countryPrompt} hint={copy.countryHint} searchPlaceholder={copy.countrySearch} emptyText={copy.countryEmpty} value={selectedCountry} onChange={setCountry} open={panel==='country'} onOpen={()=>setPanel('country')} onClose={()=>setPanel(null)} options={MARKETS.map(m=>({value:m.code,label:countryLabel(m.code,locale),searchTerms:m.name,icon:<span aria-hidden="true">{countryFlag(m.code)}</span>}))}/>
      <DiscoveryPicker name="sport" label={copy.sport} title={copy.sportPrompt} hint={copy.sportHint} value={selectedSport} onChange={value=>setSport(value as Sport)} open={panel==='sport'} onOpen={()=>setPanel('sport')} onClose={()=>setPanel(null)} options={SPORTS.map(s=>({value:s,label:sportLabel(s,locale),icon:<Ball sport={s} size={30}/>}))}/>
      <SubmitButton className="btn-court h-16 gap-3 rounded-full sm:min-w-40" pendingText={copy.search}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>{copy.search}</SubmitButton>
    </form>
  </div>;
}
