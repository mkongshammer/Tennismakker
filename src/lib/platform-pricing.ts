import {salesCurrency} from './international';
export type PriceBook = Record<'EUR'|'USD',{standard:number;custom:number|null}>;
/**
 * The commercial model (owner decision, 2026-10-19):
 * - Clubs: one plan, the full system, USD 50 per month. No setup fee, no
 *   minimum term; charged from the day the subscription starts and can be
 *   cancelled at any time. `custom` is null: there is nothing to buy on top.
 * - Players and coaches: free. RacketBuddy takes 10% of coaching sessions
 *   booked through the platform (see COMMISSION_PCT / billing.ts); nothing
 *   is taken from clubs' court bookings.
 * EUR values remain for the legacy European agreements only.
 */
export const CLUB_MONTHLY_USD = 50;
export const COACH_COMMISSION_PCT = 0.10;
export const DEFAULT_PRICE_BOOK:PriceBook = {EUR:{standard:27,custom:1999},USD:{standard:CLUB_MONTHLY_USD,custom:null}};
/** Settings key for the owner-editable price book. Bumped from V3 so the new model applies on deploy. */
export const PRICE_BOOK_SETTING_KEY = 'clubSignupPricesV4';
export function parsePriceBook(value:string):PriceBook {
 const book=JSON.parse(value);
 for(const currency of ['EUR','USD']) {
  const p=book?.[currency];
  if(!p||!Number.isSafeInteger(p.standard)||p.standard<1||p.standard>100000||p.custom!==null&&(!Number.isSafeInteger(p.custom)||p.custom<1||p.custom>100000))throw Error('Invalid EUR/USD price configuration.');
 }
 return {EUR:book.EUR,USD:book.USD};
}
export function websitePrice(country:string){const currency=salesCurrency(country);return {currency,amount:currency==='USD'?749:669};}
export function pricesForCountry(book:PriceBook,country:string){const currency=salesCurrency(country);return {...book[currency],currency};}
