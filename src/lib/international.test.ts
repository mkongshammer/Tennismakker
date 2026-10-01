import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MARKETS,CURRENCIES,formatMoney,toMinor,wallTime,wallTimeCandidates,wallParts,calendarDays,dayKey} from './international';
import {profileLocation} from './profile-location';
import {priceFor} from './pricing';
import {zonedOccurrences} from './fixed-slots-core';
import {validateCheckoutPayment,validateOrderCheckout} from './payment-validation';
import {resaDate} from './resasports';
import {phrase} from './phrases';
import {loadIsolatedModule} from './testing/isolated-module';
import * as dates from 'date-fns';
test('supported countries have valid local defaults and no implicit conversion',()=>{
 assert.equal(MARKETS.length,19);for(const market of MARKETS){assert.ok(CURRENCIES.includes(market.currency));assert.ok(wallTime('2027-01-02',10,0,market.timeZone));}
 assert.match(formatMoney(80,'EUR','en'),/EUR\s*80/);assert.match(formatMoney(80,'DKK','da'),/80.*DKK/);assert.equal(toMinor(12.34,'USD'),1234);assert.throws(()=>toMinor(1.001,'EUR'));assert.throws(()=>toMinor(1,'JPY'));
});
test('international profiles accept local cities, keep Danish regions and reject unknown markets',()=>{
 assert.deepEqual(profileLocation({country:'us',locale:'en-US',area:'Boston'}),{country:'US',locale:'en-US',area:'Boston',countryChosen:true});
 assert.throws(()=>profileLocation({country:'DK',locale:'da',area:'Boston'}));assert.throws(()=>profileLocation({country:'ZZ',locale:'en',area:'Test'}));assert.throws(()=>profileLocation({country:'DE',locale:'fr',area:'Berlin'}));
 assert.equal(phrase('Log ind på klubben','en'),'Log in to your club');assert.equal(phrase('Log ind på klubben','da'),'Log ind på klubben');
});
test('booking proof rejects a matching numeric amount in the wrong currency',()=>{
 const booking={id:'b',priceKr:25,currency:'EUR'},session:any={id:'cs_test',mode:'payment',amount_total:2500,currency:'eur',payment_status:'paid',payment_intent:'pi_test',metadata:{bookingId:'b'}};
 assert.doesNotThrow(()=>validateCheckoutPayment(booking,session));assert.throws(()=>validateCheckoutPayment(booking,{...session,currency:'dkk'}));
 assert.doesNotThrow(()=>validateCheckoutPayment({id:'b',priceKr:25},{...session,currency:'dkk'}));
 assert.doesNotThrow(()=>validateOrderCheckout({id:'order',priceKr:25,currency:'USD'},{...session,currency:'usd',metadata:{membershipId:'order'}},'membershipId'));
 assert.throws(()=>validateOrderCheckout({id:'order',priceKr:25,currency:'USD'},{...session,metadata:{membershipId:'order'}},'membershipId'));
});
test('venue days and local prices remain correct when UTC falls on another day',()=>{
 const instant=new Date('2027-01-04T01:00:00Z');assert.equal(dayKey(instant,'America/Los_Angeles'),'2027-01-03');assert.equal(dayKey(instant,'Europe/Copenhagen'),'2027-01-04');
 const rule={courtIds:'',daysOfWeek:'0',fromHour:17,toHour:18,priceKr:50,memberPriceHour:null};
 const court={id:'court',priceHour:null,memberPriceHour:null};
 assert.equal(priceFor({club:{priceHour:80,memberPriceHour:null,timeZone:'America/Los_Angeles'},court,isMember:false,startsAt:instant,rules:[rule]}),50);
 assert.equal(priceFor({club:{priceHour:80,memberPriceHour:null,timeZone:'Europe/Copenhagen'},court,isMember:false,startsAt:instant,rules:[rule]}),80);
});
test('spring gaps are rejected and repeated autumn hours select one deterministic instant',()=>{
 assert.equal(wallTime('2027-03-14',2,30,'America/New_York'),null);assert.equal(wallTime('2027-03-28',2,30,'Europe/Copenhagen'),null);
 assert.equal(wallTimeCandidates('2027-11-07',1,30,'America/New_York').length,2);assert.equal(wallTime('2027-11-07',1,30,'America/New_York')!.toISOString(),'2027-11-07T05:30:00.000Z');
 assert.throws(()=>resaDate('2027-11-07 01:30:00','America/New_York'));assert.equal(resaDate('2027-07-02 10:30:00','America/Los_Angeles'),'2027-07-02T17:30:00Z');
 assert.equal(calendarDays(new Date('2027-03-14T05:00:00Z'),new Date('2027-03-15T04:00:00Z'),'America/New_York').length,2);
});
test('recurring reservations keep venue hours across US daylight saving',()=>{
 const dates=zonedOccurrences(new Date('2027-03-01T00:00:00Z'),new Date('2027-03-22T00:00:00Z'),1,18,'America/New_York');assert.equal(dates.length,4);assert.ok(dates.every(d=>wallParts(d,'America/New_York').hour===18));assert.equal(dates[0].getUTCHours(),23);assert.equal(dates.at(-1)!.getUTCHours(),22);
});
test('availability advertises the venue hour, not the server hour',async()=>{
 const club={timeZone:'America/Los_Angeles',currency:'USD',openHour:10,closeHour:12,courts:[{id:'court',name:'Court 1'}],priceRules:[]};
 const api=loadIsolatedModule('src/lib/integrations/adapters.ts',{'date-fns':dates,'../db':{db:{club:{findUnique:async()=>club},booking:{findMany:async()=>[]}}},'../pricing':{priceFor},'../slots':{}});
 const result=await api.nativeAdapter.getAvailability({clubId:'club',from:new Date('2040-01-02T08:00:00Z'),until:new Date('2040-01-03T08:00:00Z')});
 assert.deepEqual(result.slots.map((slot:any)=>slot.startsAt.toISOString()),['2040-01-02T18:00:00.000Z','2040-01-02T19:00:00.000Z']);
});
