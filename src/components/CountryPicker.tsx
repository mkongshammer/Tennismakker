'use client';
import {useFormStatus} from 'react-dom';
import {phrase} from '../lib/phrases';
import { setCountry } from '../lib/actions';
import { COUNTRIES, countryName, type Locale } from '../lib/sports';
import { translator } from '../lib/i18n';

export function CountryPicker({ active, locale }: { active: string; locale: Locale }) {
  return <form action={setCountry} className="flex flex-wrap items-end gap-3"><CountryFields active={active} locale={locale}/></form>;
}
function CountryFields({ active, locale }: { active: string; locale: Locale }) {
  const t = translator(locale), {pending} = useFormStatus();
  return <><input type="hidden" name="locale" value={locale}/>
    <label className="label"><span>{t('common.country')}</span><select key={active} disabled={pending} onChange={event=>event.currentTarget.form?.requestSubmit()} className="input mt-1 min-w-48" name="country" defaultValue={active}>
      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{countryName(c.code,locale)}</option>)}
    </select></label>
    <button className="btn-ghost min-h-11" disabled={pending}>{pending ? phrase('Gemmer…',locale) : t('common.save')}</button>
  </>;
}
