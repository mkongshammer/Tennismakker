'use client';
import {useFormStatus} from 'react-dom';
import {phrase} from '../lib/phrases';
import { setCountry } from '../lib/actions';
import { COUNTRIES, countryName, type Locale } from '../lib/sports';
import { marketFor } from '../lib/international';
import { translator } from '../lib/i18n';

export function CountryPicker({ active, locale }: { active: string; locale: Locale }) {
  return <form action={setCountry} className="flex flex-wrap items-end gap-3"><CountryFields active={active} locale={locale}/></form>;
}
function CountryFields({ active, locale }: { active: string; locale: Locale }) {
  const t = translator(locale), {pending} = useFormStatus();
  return <><input type="hidden" name="locale" value={locale}/>
    <label className="label"><span>{t('common.country')}</span>
      <div className="relative mt-1 min-w-48">
        <select key={active} disabled={pending} onChange={event=>{
          const form = event.currentTarget.form;
          const localeInput = form?.elements.namedItem('locale');
          const defaultLocale = marketFor(event.currentTarget.value)?.defaultLocale;
          if (localeInput instanceof HTMLInputElement && defaultLocale) localeInput.value = defaultLocale;
          form?.requestSubmit();
        }} className="input mt-0 min-w-48 appearance-none pr-12" name="country" defaultValue={active}>
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{countryName(c.code,locale)}</option>)}
        </select>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate">
          <path d="m7 9.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </label>
    <button className="btn-ghost min-h-11" disabled={pending}>{pending ? phrase('Gemmer…',locale) : t('common.save')}</button>
  </>;
}
