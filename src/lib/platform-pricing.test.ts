import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MARKETS,SALES_CURRENCIES,validCurrency} from './international';
import {DEFAULT_PRICE_BOOK,parsePriceBook,pricesForCountry} from './platform-pricing';
test('every supported country sells only EUR or USD; Denmark uses EUR',()=>{
 for(const m of MARKETS){const p=pricesForCountry(DEFAULT_PRICE_BOOK,m.code);assert.ok(SALES_CURRENCIES.includes(p.currency));assert.equal(m.currency,p.currency);assert.equal(p.standard,['US','CA'].includes(m.code)?30:27);}
 assert.equal(pricesForCountry(DEFAULT_PRICE_BOOK,'DK').currency,'EUR');assert.equal(validCurrency('DKK'),true);
});
test('price books reject missing, fractional, negative or corrupt tariffs',()=>{
 assert.deepEqual(parsePriceBook(JSON.stringify(DEFAULT_PRICE_BOOK)),DEFAULT_PRICE_BOOK);
 for(const book of [{EUR:DEFAULT_PRICE_BOOK.EUR},{...DEFAULT_PRICE_BOOK,EUR:{standard:0,custom:1999}},{...DEFAULT_PRICE_BOOK,USD:{standard:30.1,custom:2249}},{...DEFAULT_PRICE_BOOK,USD:{standard:30,custom:-1}}])assert.throws(()=>parsePriceBook(JSON.stringify(book)));
 assert.equal(parsePriceBook(JSON.stringify({...DEFAULT_PRICE_BOOK,USD:{standard:30,custom:null}})).USD.custom,null);
});

test('historical currencies remain readable while new sales stay EUR/USD',()=>{for(const c of ['DKK','GBP','SEK','NOK','CAD','CHF','PLN','CZK']){assert.equal(validCurrency(c),true);assert.equal(SALES_CURRENCIES.includes(c as any),false);}});
