import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as dates from 'date-fns';
import {loadIsolatedModule} from './testing/isolated-module';
import {hourDate} from './slots';
for(const type of ['nativeAdapter','manualAdapter','icalAdapter'])test(`${type} hides partial overlaps and keeps adjacent times`,async()=>{
 const day=new Date(Date.now()+3*86400000);day.setHours(10,0,0,0);const end=dates.addHours(day,3);
 let query:any;
 const club={courts:[{id:'court',name:'Bane'}],rules:[],priceRules:[],openHour:10,closeHour:13,lastMinuteHours:0,lastSyncAt:new Date()};
 const db={club:{findUnique:async()=>club},booking:{findMany:async({where}:any)=>{query=where;return [{courtId:'court',startsAt:dates.addMinutes(day,-30),endsAt:dates.addMinutes(day,30)}];}},guestSlot:{findMany:async()=>[0,1,2].map(h=>({courtId:'court',court:club.courts[0],startsAt:dates.addHours(day,h),endsAt:dates.addHours(day,h+1),priceKr:100}))},externalBusy:{findMany:async()=>[]}};
 const api=loadIsolatedModule('src/lib/integrations/adapters.ts',{'date-fns':dates,'../db':{db},'../pricing':{priceFor:()=>100},'../slots':{hourDate}});
 const result=await api[type].getAvailability({clubId:'club',from:day,until:end});assert.deepEqual(result.slots.map((s:any)=>s.startsAt.getHours()),[11,12]);
 assert.equal(+query.endsAt.gt,+day);assert.ok(query.OR[1].OR.some((x:any)=>x.holdExpiresAt?.gt instanceof Date));assert.ok(query.OR[1].OR.some((x:any)=>x.checkoutParams?.not===null));
});
test('failed or missing calendar sync cannot advertise availability',async()=>{
 for(const state of [{lastSyncAt:null},{lastSyncAt:new Date(),lastSyncError:'failed'},{lastSyncAt:new Date(Date.now()-21*60000)}]){
  const api=loadIsolatedModule('src/lib/integrations/adapters.ts',{'date-fns':dates,'../db':{db:{club:{findUnique:async()=>({courts:[],priceRules:[],...state})}}},'../pricing':{priceFor:()=>100},'../slots':{hourDate}});
  assert.equal((await api.icalAdapter.getAvailability({clubId:'c',from:new Date(),until:new Date()})).slots.length,0);
 }
});
test('booking fails closed on calendar provider failure and preserves last successful sync time',async()=>{
 let update:any;
 const club={integrationType:'ICAL',icalUrl:'https://calendar.example.invalid/feed',lastSyncAt:new Date(0),courts:[]};
 const original=global.fetch;global.fetch=async()=>new Response('down',{status:503});
 try{
  const api=loadIsolatedModule('src/lib/integrations/index.ts',{'date-fns':dates,'../db':{db:{club:{findUnique:async()=>club,update:async(args:any)=>{update=args.data;}}}},'../ical':{},'./adapters':{},'./types':{}});
  await assert.rejects(api.refreshBeforeBooking('c'),/kunne ikke kontrolleres/);assert.ok(update.lastSyncError);assert.equal(update.lastSyncAt,undefined);
 }finally{global.fetch=original;}
});
