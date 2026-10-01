import { marketFor, validLocale } from './international';
import { isDanishRegion } from './regions';
/** Danish profiles retain their region taxonomy; other markets use a local city/area. */
export function validArea(country: string, area: string) {
  return country === 'DK' ? isDanishRegion(area) : area.trim().length >= 2 && area.trim().length <= 100;
}
export function profileLocation(input: {country?: unknown; locale?: unknown; area?: unknown}) {
  const country=String(input.country ?? 'DK').toUpperCase(), locale=String(input.locale ?? 'da'), area=String(input.area ?? '').trim();
  if (!marketFor(country) || !validLocale(locale) || !validArea(country,area)) throw Error(locale==='da' ? 'Vælg et gyldigt land, sprog og område.' : 'Choose a valid country, language and city/area.');
  return {country,locale,area,countryChosen:true};
}
