'use client';
import {useFormState} from 'react-dom';
import {saveClubSignupPrices} from '../../../lib/club-onboarding-actions';
import {SubmitButton} from '../../../components/SubmitButton';
import type {PriceBook} from '../../../lib/platform-pricing';
// RacketBuddy is sold in the US only, so the form edits USD prices only.
export function ClubPricesForm({prices,founding}:{prices:PriceBook;founding?:{monthly:number;annual:number;total:number;left:number;open:boolean}}){
 const [state,action]=useFormState(saveClubSignupPrices,null);
 return <form action={action} className="card space-y-4">
  <h2 className="display text-2xl">Klubabonnement (USD)</h2>
  <p>Én plan med hele systemet, intet oprettelsesgebyr, ingen binding. Prisen her er den almindelige pris, som nye klubber betaler, når founding-pladserne er brugt. Nye priser gælder kun nye aftaler.</p>
  {founding&&<p className="text-sm">Founding-pris: ${founding.monthly}/måned eller ${founding.annual}/år for livet til de første {founding.total} klubber. {founding.open?`${founding.left} pladser tilbage.`:'Alle pladser er brugt.'}</p>}
  <div className="grid gap-6 sm:grid-cols-2">
   <label className="label block">Abonnement / måned (USD)<input className="input" name="USD_standard" type="number" min="1" max="100000" defaultValue={prices.USD.standard} required/></label>
   <label className="label block">Abonnement / år (USD)<input className="input" name="USD_annual" type="number" min="1" max="1000000" defaultValue={prices.USD.annual} required/></label>
  </div>
  <SubmitButton className="btn-court" pendingText="Gemmer…">Gem pris</SubmitButton>
  {state?.error&&<p role="alert">{state.error}</p>}{state?.ok&&<p>{state.ok}</p>}
 </form>;
}
