'use client';
import {useFormState} from 'react-dom';
import {addClubMember} from '../../lib/club-management-actions';
import {SubmitButton} from '../../components/SubmitButton';
export function MemberForm({types}:{types:{id:string;name:string}[]}) {
 const [state,action]=useFormState(addClubMember,null);
 return <section className="card space-y-4"><h2 className="display text-2xl">Tilføj medlem</h2><p className="text-sm text-slate">Medlemmet får tilknytning til klubben. Kontingent aktiveres først ved betaling. Eksisterende loginoplysninger ændres ikke.</p><form action={action} className="space-y-3">
 {['name','email','phone'].map((field,i)=><label key={field} className="label block">{['Navn','E-mail','Telefon'][i]}<input className="input" name={field} type={['text','email','tel'][i]} required={field!=='phone'}/></label>)}
 <label className="label block">Kontingent<select name="typeId" className="input"><option value="">Intet kontingent valgt</option>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <SubmitButton pendingText="Tilføjer…">Tilføj medlem</SubmitButton></form>
 {state?.error&&<p role="alert">{state.error}</p>}{state?.ok&&<p>{state.ok}</p>}{state?.password&&<div className="rounded-xl bg-mist p-4"><p>Gem login nu og udlever det til medlemmet:</p><p>{state.email}</p><code className="select-all break-all">{state.password}</code></div>}</section>;
}
