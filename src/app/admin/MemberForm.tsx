'use client';import { useWebsiteInternational } from "../../components/InternationalProvider";
import { useFormState } from 'react-dom';
import { addClubMember } from '../../lib/club-management-actions';
import { SubmitButton } from '../../components/SubmitButton';
export function MemberForm({ types }: {types: {id: string;name: string;}[];}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(addClubMember, null);
  return <section className="card space-y-4"><h2 className="display text-2xl">{tr("Tilf\xF8j medlem")}</h2><p className="text-sm text-slate">{tr("Medlemmet f\xE5r tilknytning til klubben. Kontingent aktiveres f\xF8rst ved betaling. Eksisterende loginoplysninger \xE6ndres ikke.")}</p><form action={action} className="space-y-3">
 {['name', 'email', 'phone'].map((field, i) => <label key={field} className="label block">{['Navn', 'E-mail', 'Telefon'][i]}<input className="input" name={field} type={['text', 'email', 'tel'][i]} required={field !== 'phone'} /></label>)}
 <label className="label block">{tr("Kontingent")}<select name="typeId" className="input"><option value="">{tr("Intet kontingent valgt")}</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <SubmitButton pendingText={tr("Tilf\xF8jer\u2026")}>{tr("Tilf\xF8j medlem")}</SubmitButton></form>
 {state?.error && <p role="alert">{state.error}</p>}{state?.ok && <p>{state.ok}</p>}{state?.password && <div className="rounded-xl bg-mist p-4"><p>{tr("Gem login nu og udlever det til medlemmet:")}</p><p>{state.email}</p><code className="select-all break-all">{state.password}</code></div>}</section>;
}
