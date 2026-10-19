 'use client';
import {useFormState} from 'react-dom';
import {orderWebsite} from '../../lib/actions';
import {phrase} from '../../lib/phrases';
import type {Locale} from '../../lib/sports';
import {SubmitButton} from '../../components/SubmitButton';
export function OrderForm({locale,country}:{locale:Locale;country:string}){
 const [state,action]=useFormState(orderWebsite,null),tr=(s:string)=>phrase(s,locale);
 if(state?.ok)return <div className="card" role="status">{tr(state.ok)}</div>;
 return <form action={action} className="card space-y-4"><input type="hidden" name="country" value={country}/><input type="hidden" name="locale" value={locale}/><div className="grid gap-4 sm:grid-cols-2">{[['clubName','Klubbens navn'],['contactName','Dit navn'],['email','E-mail'],['phone','Telefon'],['domain','Domæne, hvis I har et']].map(([name,label])=><label className="label" key={name}>{tr(label)}<input className="input" name={name} type={name==='email'?'email':name==='phone'?'tel':'text'} required={['clubName','contactName','email'].includes(name)} maxLength={254}/></label>)}</div><label className="label block">{tr('Noget vi skal vide?')}<textarea className="input" name="notes" rows={3} maxLength={4000}/></label><p className="text-sm text-slate">{tr('Domæneregistrering betales separat. Vi aftaler den konkrete pris med jer.')}</p>{state?.error&&<p role="alert">{tr(state.error)}</p>}<SubmitButton className="btn-court" pendingText={tr('Sender…')}>{tr('Send forespørgsel')}</SubmitButton><p className="text-sm text-slate">{tr('Vi opkræver først, når I har set et udkast og sagt ja.')}</p></form>;
}
