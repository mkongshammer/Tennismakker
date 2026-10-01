import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectCountryFromHeaders,countryFromLanguage} from './geo';
import {visitorIp,lookupIpCountry} from './ip-country';
import {MARKETS} from './international';
import {loadIsolatedModule} from './testing/isolated-module';
import * as sports from './sports';
test('country detection uses visitor IP rather than browser language or proxy address',()=>{
 const h=new Headers({'x-forwarded-for':'8.8.8.8, 10.0.0.1','accept-language':'da-DK'});
 assert.equal(visitorIp(h),'8.8.8.8');
 assert.deepEqual(detectCountryFromHeaders(h,()=> 'US'),{country:'US',suggestedCountry:'US',needsChoice:false,source:'ip'});
 assert.equal(MARKETS.find(m=>m.code==='US')!.defaultLocale,'en-US');
 assert.equal(MARKETS.find(m=>m.code==='SE')!.defaultLocale,'sv');
});
test('unknown, unsupported and conflicting locations ask for a country',()=>{
 const unknown=detectCountryFromHeaders(new Headers({'accept-language':'en-US'}),()=>null);
 assert.equal(unknown.country,null);assert.equal(unknown.suggestedCountry,'US');assert.ok(unknown.needsChoice);
 const conflict=detectCountryFromHeaders(new Headers({'cf-ipcountry':'DE','x-forwarded-for':'8.8.8.8'}),()=> 'US');
 assert.equal(conflict.source,'conflict');assert.ok(conflict.needsChoice);
 for(const code of ['XX','T1','JP'])assert.ok(detectCountryFromHeaders(new Headers({'cf-ipcountry':code}),()=>null).needsChoice);
 assert.equal(countryFromLanguage('nn-NO,no;q=0.9'),'NO');assert.equal(countryFromLanguage('en'),null);
});
test('private and malformed IPs are not geolocated and IPv6 is accepted',()=>{
 for(const ip of ['127.0.0.1','10.2.3.4','172.16.1.1','192.168.0.1','::1','fd00::1','2001:db8::1','bad','8.8.8.8:443'])assert.equal(visitorIp(new Headers({'x-forwarded-for':ip})),null);
 assert.equal(visitorIp(new Headers({'x-forwarded-for':'::ffff:8.8.8.8'})),'8.8.8.8');
 assert.equal(visitorIp(new Headers({'cf-connecting-ip':'2001:4860:4860::8888','x-forwarded-for':'10.0.0.1'})),'2001:4860:4860::8888');
});
test('the installed offline IP database resolves a Danish and American network',()=>{
 assert.equal(lookupIpCountry('80.160.0.1'),'DK');assert.equal(lookupIpCountry('8.8.8.8'),'US');
 assert.equal(lookupIpCountry('not an address'),null);
});
test('saved country and language choices take precedence over IP; first visits inherit the country language',async()=>{
 let user:any=null,values:Record<string,string>={},detections=0;
 const prefs=loadIsolatedModule('src/lib/preferences.ts',{
  'next/headers':{headers:async()=>new Headers({'accept-language':'da-DK'}),cookies:async()=>({get:(key:string)=>values[key]?{value:values[key]}:undefined})},
  './session':{getCurrentUser:async()=>user},
  './sports':sports,
  './geo':{detectCountry:async()=>{detections++;return {country:'US',suggestedCountry:'US',needsChoice:false,source:'ip'};}},
 });
 const automatic=await prefs.getPreferences();assert.equal(automatic.country,'US');assert.equal(automatic.locale,'en-US');assert.equal(automatic.countryChosen,false);
 values={'rb_prefs_country':'SE','rb_prefs_locale':'de'};detections=0;
 const manual=await prefs.getPreferences();assert.equal(manual.country,'SE');assert.equal(manual.locale,'de');assert.ok(manual.countryChosen);assert.equal(detections,0);
 user={country:'NO',locale:'en',countryChosen:true};values={};
 const profile=await prefs.getPreferences();assert.equal(profile.country,'NO');assert.equal(profile.locale,'en');assert.equal(detections,0);
});
