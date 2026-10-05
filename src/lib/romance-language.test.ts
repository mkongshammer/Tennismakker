import {test} from 'node:test';
import assert from 'node:assert/strict';
import translations from '../../shared/translations.json';
import localized from '../../shared/localized-phrases.json';
import romance from '../../shared/romance-translations.json';
import {phrase} from './phrases';
import {landingCopy} from './landing-copy';
import {termsContent} from './terms-content';
import {marketFor,formatMoney} from './international';
import {profileLocation} from './profile-location';
import {bookingReceipt,cancellationNotice,passwordResetLink,matchAcceptedNotice} from './email';
import {describeLength,describeWeeklySlots} from './slots';
const placeholders=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
test('French and Spanish dictionaries are complete and preserve interpolation parameters',()=>{
 for(const [key,entry] of Object.entries({...translations,...localized,...romance}))for(const locale of ['fr','es'] as const){
  assert.ok(entry[locale],`${locale}: ${key}`);
  const source='da' in entry?String(entry.da):key;
  assert.deepEqual(placeholders(entry[locale]),placeholders(source),`${locale}: ${key}`);
 }
});
test('France and Spain use their language defaults without changing EUR/USD pricing',()=>{
 for(const [country,locale] of [['FR','fr'],['ES','es']]){assert.equal(marketFor(country)?.defaultLocale,locale);assert.equal(marketFor(country)?.currency,'EUR');assert.equal(profileLocation({country,locale,area:'Test city'}).locale,locale);}
 assert.equal(profileLocation({country:'US',locale:'fr',area:'Boston'}).locale,'fr');
 assert.match(formatMoney(30,'USD','fr'),/USD/);assert.match(formatMoney(27,'EUR','es'),/EUR/);
});
test('landing and every regional terms paragraph translate while keeping links and prices',()=>{
 for(const locale of ['fr','es'] as const){
  const home=landingCopy(locale);for(const value of Object.values(home))assert.ok(value);
  assert.notEqual(home.title,landingCopy('en').title);
  for(const region of ['eu','usa','international'] as const){
   const prices={standard:region==='usa'?30:27,custom:region==='usa'?2249:1999,currency:region==='usa'?'USD':'EUR'};
   const english=termsContent(region,'en',prices),translated=termsContent(region,locale,prices);
   assert.deepEqual(translated.map(s=>s.id),english.map(s=>s.id));
   translated.forEach((s,i)=>{assert.notEqual(s.title,english[i].title);s.paragraphs.forEach((p,j)=>{assert.notEqual(p,english[i].paragraphs[j],`${locale}: ${region}: ${s.id}`);assert.ok(!/\{\w+\}/.test(p));});assert.equal(s.link?.href,english[i].link?.href);});
   assert.ok(translated.flatMap(s=>s.paragraphs).some(p=>p.includes(formatMoney(prices.standard,prices.currency,locale))));
  }
 }
});
test('registered statuses and calendar text translate without altering user content',()=>{
 assert.notEqual(phrase('12 tider frigivet til gæster.','fr'),'12 tider frigivet til gæster.');
 assert.match(phrase('12 tider frigivet til gæster.','es'),/12/);
 for(const locale of ['fr','es'] as const){assert.equal(phrase('My own club text 123','fr'),'My own club text 123');assert.ok(!describeWeeklySlots([{day:1,from:9,to:11}],locale).includes('Mandag'));assert.ok(!describeLength(60,locale).includes('time'));}
});
test('transactional email templates keep customer data, currency and links in French and Spanish',()=>{
 for(const locale of ['fr','es']){
  const opts={to:'test@example.invalid',name:'Alex',what:'Court Alpha',startsAt:new Date('2027-01-05T12:00:00Z'),priceKr:27,currency:'EUR',locale,timeZone:'Europe/Paris',bookingId:'b'};
  const receipt=bookingReceipt(opts);assert.match(receipt.body,/Alex/);assert.match(receipt.body,/Court Alpha/);assert.match(receipt.body,/EUR/);assert.ok(!receipt.body.includes('Din booking'));
  const refund=cancellationNotice({...opts,refundKr:27});assert.match(refund.body,/EUR/);assert.ok(!refund.body.includes(' kr'));
  const reset=passwordResetLink({to:opts.to,name:'Alex',url:'https://example.invalid/reset?token=abc',minutes:30,locale});assert.match(reset.body,/https:\/\/example.invalid\/reset\?token=abc/);assert.match(reset.body,/30/);assert.ok(!reset.subject.includes('adgangskode'));
  const match=matchAcceptedNotice({to:opts.to,requesterName:'Alex',accepterName:'Sam',message:'My own post',threadId:'thread1',locale});assert.match(match.body,/My own post/);assert.match(match.subject,/Sam/);
 }
});
