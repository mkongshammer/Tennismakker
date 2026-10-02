export type TermsRegion = 'eu' | 'usa';
const EUROPEAN_TERMS_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO']);
export function termsRegionForCountry(country?: string | null): TermsRegion | null {
  const code = String(country ?? '').toUpperCase();
  return code === 'US' ? 'usa' : EUROPEAN_TERMS_COUNTRIES.has(code) ? 'eu' : null;
}
export function termsHref(country?: string | null): string {
  const region = termsRegionForCountry(country);
  return region ? `/vilkaar/${region}` : '/vilkaar';
}
export const TERMS_VERSION = '2026-10-02';
