import { setCountry } from '../lib/actions';
import { COUNTRIES, countryName, type Locale } from '../lib/sports';
import { translator } from '../lib/i18n';

export function CountryPicker({ active, locale }: { active: string; locale: Locale }) {
  const t = translator(locale);
  return <form action={setCountry} className="flex flex-wrap items-end gap-3">
    <label className="label"><span>{t('common.country')}</span><select className="input mt-1 min-w-48" name="country" defaultValue={active}>
      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{countryName(c.code,locale)}</option>)}
    </select></label>
    <button className="btn-ghost min-h-11">{t('common.save')}</button>
  </form>;
}
