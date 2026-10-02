import {salesCurrency} from './international';
export type PriceBook = Record<'EUR'|'USD',{standard:number;custom:number|null}>;
export const DEFAULT_PRICE_BOOK:PriceBook = {EUR:{standard:27,custom:1999},USD:{standard:30,custom:2249}};
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
