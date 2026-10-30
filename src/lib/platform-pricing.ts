import {salesCurrency} from './international';
export type PriceBook = Record<'EUR'|'USD',{standard:number;annual:number;custom:number|null}>;
/**
 * The commercial model (owner decision, 2026-10-19):
 * - Clubs: one plan, the full system. USD 99 per month or USD 999 per year
 *   (founding clubs: 50 / 500 for life, see FOUNDING_CLUB_SPOTS). No setup fee, no minimum term on monthly; charged
 *   from the day the subscription starts and can be cancelled at any time.
 *   `custom` is null: there is nothing to buy on top.
 * - Players and coaches: free. RacketBuddy takes 10% of coaching sessions
 *   booked through the platform (see COMMISSION_PCT / billing.ts); nothing
 *   is taken from clubs' court bookings.
 * EUR values remain for the legacy European agreements only.
 */
/**
 * Founding clubs (owner decision, 2026-10-31): the first 25 US clubs pay
 * USD 50/month or 500/year for as long as they stay customers. After that
 * new clubs pay USD 99/month or 999/year. A club's price is stored on the
 * club and in its Stripe subscription when it signs up, so founding clubs
 * keep theirs automatically; only new sign-ups see the new price.
 */
export const FOUNDING_CLUB_SPOTS = 25;
export const FOUNDING_MONTHLY_USD = 50;
export const FOUNDING_ANNUAL_USD = 500;
export const CLUB_MONTHLY_USD = 99;
export const CLUB_ANNUAL_USD = 999;
export const COACH_COMMISSION_PCT = 0.10;
export const DEFAULT_PRICE_BOOK:PriceBook = {EUR:{standard:27,annual:270,custom:1999},USD:{standard:CLUB_MONTHLY_USD,annual:CLUB_ANNUAL_USD,custom:null}};
/** Settings key for the owner-editable price book. Bumped from V3 so the new model applies on deploy. */
export const PRICE_BOOK_SETTING_KEY = 'clubSignupPricesV5';
export function parsePriceBook(value:string):PriceBook {
 const book=JSON.parse(value);
 for(const currency of ['EUR','USD']) {
  const p=book?.[currency];
  if(!p||!Number.isSafeInteger(p.standard)||p.standard<1||p.standard>100000||p.custom!==null&&(!Number.isSafeInteger(p.custom)||p.custom<1||p.custom>100000))throw Error('Invalid EUR/USD price configuration.');
  // Annual is optional in stored books from before it existed: ten months' worth by default.
  if(p.annual==null)p.annual=p.standard*10;
  if(!Number.isSafeInteger(p.annual)||p.annual<1||p.annual>1000000)throw Error('Invalid EUR/USD price configuration.');
 }
 return {EUR:{standard:book.EUR.standard,annual:book.EUR.annual,custom:book.EUR.custom},USD:{standard:book.USD.standard,annual:book.USD.annual,custom:book.USD.custom}};
}
export function websitePrice(country:string){const currency=salesCurrency(country);return {currency,amount:currency==='USD'?749:669};}
export function pricesForCountry(book:PriceBook,country:string){const currency=salesCurrency(country);return {...book[currency],currency};}
