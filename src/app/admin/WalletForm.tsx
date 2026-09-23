'use client';
import {useFormState} from 'react-dom';
import {saveWallet} from '../../lib/wallet-actions';
import {SubmitButton} from '../../components/SubmitButton';
export function WalletForm({enabled,tiers}:{enabled:boolean;tiers:{paidOre:number;creditOre:number}[]}) {
 const [state,action]=useFormState(saveWallet,null);
 return <section className="card space-y-4"><h2 className="display text-2xl">Klubwallet</h2><p className="text-sm text-slate">Medlemmer indbetaler et valgfrit beløb. Det bedste opnåede rabattrin gælder for hele indbetalingen. Eksempel: Betal 1.800 kr., få 2.000 kr. i bookingkredit. Kreditten bruges kun i jeres klub.</p><form action={action} className="space-y-4">
 <label className="flex gap-2"><input type="checkbox" name="enabled" defaultChecked={enabled}/>Åbn for indbetalinger</label>
 {[0,1,2].map(i=><div key={i} className="grid gap-3 sm:grid-cols-2"><label className="label">Indbetaling fra (kr.)<input className="input" name={`paid${i}`} type="number" min="10" step="0.01" defaultValue={tiers[i]?tiers[i].paidOre/100:undefined}/></label><label className="label">Bookingværdi ved denne indbetaling (kr.)<input className="input" name={`credit${i}`} type="number" min="10" step="0.01" defaultValue={tiers[i]?tiers[i].creditOre/100:undefined}/></label></div>)}
 <p className="text-sm text-slate">Uden et rabattrin får medlemmet samme beløb i kredit som indbetalingen. Eksisterende kredit bevares, når nye indbetalinger slås fra.</p><SubmitButton pendingText="Gemmer…">Gem wallet</SubmitButton></form>{state?.error&&<p role="alert">{state.error}</p>}{state?.ok&&<p>{state.ok}</p>}</section>;
}
