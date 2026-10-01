// Shared by the website and Expo app. Country controls discovery, never conversion of stored prices.
export const MARKETS = [
  ['DK', 'Denmark', 'DKK', 'da', 'Europe/Copenhagen', 56, 10.6],
  ['SE', 'Sweden', 'SEK', 'sv', 'Europe/Stockholm', 62, 15],
  ['NO', 'Norway', 'NOK', 'no', 'Europe/Oslo', 62, 10],
  ['DE', 'Germany', 'EUR', 'de', 'Europe/Berlin', 51, 10],
  ['GB', 'United Kingdom', 'GBP', 'en', 'Europe/London', 54, -2],
  ['US', 'United States', 'USD', 'en-US', 'America/New_York', 39, -98],
  ['CA', 'Canada', 'CAD', 'en', 'America/Toronto', 56, -106],
  ['FR', 'France', 'EUR', 'en', 'Europe/Paris', 47, 2],
  ['ES', 'Spain', 'EUR', 'en', 'Europe/Madrid', 40, -4],
  ['IT', 'Italy', 'EUR', 'en', 'Europe/Rome', 43, 12],
  ['NL', 'Netherlands', 'EUR', 'en', 'Europe/Amsterdam', 52, 5],
  ['BE', 'Belgium', 'EUR', 'en', 'Europe/Brussels', 50.5, 4.5],
  ['AT', 'Austria', 'EUR', 'de', 'Europe/Vienna', 47.5, 14],
  ['CH', 'Switzerland', 'CHF', 'de', 'Europe/Zurich', 47, 8],
  ['FI', 'Finland', 'EUR', 'en', 'Europe/Helsinki', 64, 26],
  ['IE', 'Ireland', 'EUR', 'en', 'Europe/Dublin', 53, -8],
  ['PT', 'Portugal', 'EUR', 'en', 'Europe/Lisbon', 39.5, -8],
  ['PL', 'Poland', 'PLN', 'en', 'Europe/Warsaw', 52, 19],
  ['CZ', 'Czechia', 'CZK', 'en', 'Europe/Prague', 50, 15],
].map(([code, name, currency, defaultLocale, timeZone, latitude, longitude]) => ({ code, name, currency, defaultLocale, timeZone, center: [latitude, longitude], live: true, flag: String.fromCodePoint(...String(code).split('').map(c => c.charCodeAt(0) + 127397)) }));

export const CURRENCIES = ['DKK', 'EUR', 'GBP', 'SEK', 'NOK', 'USD', 'CAD', 'CHF', 'PLN', 'CZK'];
export const LANGUAGES = ['da', 'en', 'en-US', 'de', 'sv', 'no'];
export const LANGUAGE_NAMES = { da: 'Dansk', en: 'English', 'en-US': 'American English', de: 'Deutsch', sv: 'Svenska', no: 'Norsk' };
export const TIME_ZONES = [...new Set([...MARKETS.map(c => c.timeZone), 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Halifax', 'America/St_Johns', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'Atlantic/Canary', 'Atlantic/Azores', 'UTC'])];

export function marketFor(code) { return MARKETS.find(c => c.code === String(code).toUpperCase()) ?? null; }
export function validLocale(locale) { return LANGUAGES.includes(locale); }
export function validCurrency(currency) { return CURRENCIES.includes(currency); }
export function validTimeZone(zone) {
  if (typeof zone !== 'string' || zone.length > 80) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; } catch { return false; }
}
export function countryLabel(code, locale = 'en') {
  try { return new Intl.DisplayNames([locale === 'no' ? 'nb' : locale], { type: 'region' }).of(code) ?? code; }
  catch { return marketFor(code)?.name ?? code; }
}
export function numberLocale(locale = 'da') { return locale === 'no' ? 'nb-NO' : locale; }
export function formatMoney(amount, currency = 'DKK', locale = 'da') {
  if (!validCurrency(currency) || !Number.isFinite(Number(amount))) return '—';
  return new Intl.NumberFormat(numberLocale(locale), { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2, maximumFractionDigits: 2 }).format(Number(amount));
}
export function toMinor(amount, currency = 'DKK') {
  if (!validCurrency(currency) || !Number.isFinite(amount) || amount < 0) throw Error('Invalid amount or currency.');
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(minor / 100 - amount) > 0.000001) throw Error('Amounts must have at most two decimals.');
  return minor;
}
export function formatDate(instant, locale = 'da', timeZone = 'Europe/Copenhagen', options = {}) {
  return new Intl.DateTimeFormat(numberLocale(locale), { timeZone, ...options }).format(new Date(instant));
}

const wallFormatters = new Map();
export function wallParts(instant, timeZone = 'Europe/Copenhagen') {
  if (!wallFormatters.has(timeZone)) wallFormatters.set(timeZone, new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  const parts = Object.fromEntries(wallFormatters.get(timeZone).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  const year = +parts.year, month = +parts.month, day = +parts.day;
  return { year, month, day, hour: +parts.hour, minute: +parts.minute, second: +parts.second, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}
export function dayKey(instant, timeZone = 'Europe/Copenhagen') {
  const p = wallParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
}
export function addCalendarDays(key, amount) {
  const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

// Return null for a missing spring-forward time. A repeated autumn time has one deterministic, earliest instant.
export function wallTimeCandidates(key, hour = 0, minute = 0, timeZone = 'Europe/Copenhagen') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isInteger(hour) || hour < 0 || hour > 24 || !Number.isInteger(minute) || minute < 0 || minute > 59 || (hour === 24 && minute)) throw Error('Invalid local date/time.');
  if (hour === 24) { key = addCalendarDays(key, 1); hour = 0; }
  const [year, month, day] = key.split('-').map(Number), wanted = Date.UTC(year, month - 1, day, hour, minute);
  const parsed = new Date(wanted);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw Error('Invalid local date.');
  const offsets = new Set();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const sample = wanted + delta * 3600000, p = wallParts(sample, timeZone);
    offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second) - sample);
  }
  const candidates = [...offsets].map(offset => wanted - offset).filter(value => {
    const p = wallParts(value, timeZone);
    return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
  }).sort((a,b) => a-b);
  return candidates.map(value=>new Date(value));
}
export function wallTime(key,hour=0,minute=0,timeZone="Europe/Copenhagen"){
  return wallTimeCandidates(key,hour,minute,timeZone)[0]??null;
}
export function localInputDate(value, timeZone = 'Europe/Copenhagen') {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(value));
  if (!match) throw Error('Invalid local date/time.');
  const instant = wallTime(match[1], +match[2], +match[3], timeZone);
  if (!instant) throw Error('This time does not exist because of daylight saving. Choose another time.');
  return instant;
}
export function calendarDays(from, until, timeZone = 'Europe/Copenhagen') {
  const first = dayKey(from,timeZone), last = dayKey(until,timeZone), out = [];
  for (let key = first; key <= last && out.length <= 370; key = addCalendarDays(key,1)) out.push(key);
  return out;
}
