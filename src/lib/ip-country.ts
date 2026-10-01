import { readFileSync, existsSync } from 'node:fs';
import { isIP } from 'node:net';
import path from 'node:path';
import { Reader, type CountryResponse } from 'maxmind';
type CountryRecord = CountryResponse & {country_code?:string};
let reader: Reader<CountryRecord> | undefined;

/** Render puts the visitor first. Never look up the server's own egress IP. */
export function visitorIp(h: Pick<Headers,'get'>): string | null {
  const raw = (h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || '').trim();
  const value = raw.toLowerCase().startsWith('::ffff:') ? raw.slice(7) : raw;
  if (!isIP(value)) return null;
  if (isIP(value) === 4) {
    const [a,b,c] = value.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && [0,2].includes(c)) || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) || (a === 203 && b === 0 && c === 113)) return null;
  } else if (value === '::' || value === '::1' || /^(fc|fd|fe[89ab]|ff)/i.test(value) || value.toLowerCase().startsWith('2001:db8:')) return null;
  return value;
}
/** Offline lookup. Addresses never leave this server and are not stored here. */
export function lookupIpCountry(ip: string): string | null {
  try {
    if (!reader) {
      const root = path.join(process.cwd(),'node_modules/@ip-location-db/dbip-country-mmdb');
      const updated = path.join(process.cwd(),'data/ip-country.mmdb');
      reader = new Reader<CountryRecord>(readFileSync(existsSync(updated) ? updated : path.join(root,'dbip-country.mmdb')));
    }
    // When a database expires, ask instead of silently choosing from stale data.
    if (Date.now() - reader.metadata.buildEpoch.getTime() > 180*24*60*60*1000) return null;
    const record = reader.get(ip);
    return record?.country?.iso_code ?? record?.country_code ?? null;
  } catch { return null; }
}
