import phrases from '../../shared/phrases.json';
import { T } from './i18n';
import { baseLocale, type Locale } from './sports';
const byDanish = new Map(Object.values(T).map(entry => [entry.da,entry]));
export function phrase(value: string, locale: Locale='da') {
  if (locale==='da') return value;
  const entry=byDanish.get(value);
  return (locale==='en-US' ? entry?.['en-US'] : undefined) || entry?.[baseLocale(locale)] || (phrases as Record<string,string>)[value] || value;
}
