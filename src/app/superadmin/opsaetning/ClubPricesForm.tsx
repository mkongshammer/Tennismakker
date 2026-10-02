 'use client';
import {useFormState} from 'react-dom';
import {saveClubSignupPrices} from '../../../lib/club-onboarding-actions';
import {SubmitButton} from '../../../components/SubmitButton';
import type {PriceBook} from '../../../lib/platform-pricing';
export function ClubPricesForm({prices}:{prices:PriceBook}){
 const [state,action]=useFormState(saveClubSignupPrices,null);
 return <form action={action} className="card space-y-4"><h2 className="display text-2xl">Klubabonnementer på hjemmesiden</h2><p>Europa, inklusive Danmark, betaler i EUR. USA og Canada betaler i USD. Custom har én fast engangspris plus det månedlige abonnement. Nye priser gælder kun nye aftaler.</p><div className="grid gap-6 sm:grid-cols-2">{(['EUR','USD'] as const).map(currency=><fieldset key={currency} className="space-y-3"><legend className="font-bold">{currency}</legend><label className="label block">Abonnement / måned<input className="input" name={`${currency}_standard`} type="number" min="1" max="100000" defaultValue={prices[currency].standard} required/></label><label className="label block">Custom / engangspris<input className="input" name={`${currency}_custom`} type="number" min="1" max="100000" defaultValue={prices[currency].custom??''}/></label></fieldset>)}</div><SubmitButton className="btn-court" pendingText="Gemmer…">Gem priser og klargør Stripe</SubmitButton>{state?.error&&<p role="alert">{state.error}</p>}{state?.ok&&<p>{state.ok}</p>}</form>;
}
