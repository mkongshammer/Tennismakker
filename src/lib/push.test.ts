import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadIsolatedModule} from './testing/isolated-module';
import * as policy from './push-policy';
const path='src/app/api/v1/push/route.ts';
function route(db:any,user:any={id:'me'}) {
 return loadIsolatedModule(path,{'../../../../lib/db':{db},'../../../../lib/push-policy':policy,'../../../../lib/api/helpers':{
 requireUser:async()=>user?{user}:{response:{status:401}},json:(body:any)=>({status:200,body}),apiError:()=>({status:400}),preflight:()=>({status:204})}});
}
const req=(body:any)=>new Request('https://test/api/v1/push',{method:'POST',body:JSON.stringify(body)});
test('push endpoints reject unauthenticated users before DB access',async()=>{
 const r=route({},null);
 for(const method of ['GET','POST','DELETE'])assert.equal((await r[method](req({}))).status,401);
});
test('unregister always scopes device deletion to authenticated owner',async()=>{
 let where:any;
 const r=route({pushDevice:{deleteMany:async(args:any)=>{where=args.where;}}});
 assert.equal((await r.DELETE(req({token:'ExpoPushToken[abcdefghijklmnop]',userId:'other'}))).status,200);
 assert.equal(where.userId,'me');
 assert.equal((await r.DELETE(req({token:'garbage'}))).status,400);
});
test('preferences validate booleans and cannot modify another user',async()=>{
 let args:any;
 const r=route({pushPreference:{upsert:async(a:any)=>{args=a;}}});
 assert.equal((await r.POST(req({preferences:{bookings:'yes'}}))).status,400);
 await r.POST(req({userId:'other',preferences:{bookings:false,reminders:true,messages:false,coaching:true,userId:'other'}}));
 assert.deepEqual(args.where,{userId:'me'});
 assert.equal(args.create.userId,'me');
 assert.equal(args.update.userId,undefined);
});
test('worker skips withdrawn consent, wrong recipient and stale booking before contacting Expo',async()=>{
 for(const scenario of ['consent','recipient','booking']) {
  let state='';
  const item={id:'q',deviceId:'d',data:JSON.stringify({recipientId:scenario==='recipient'?'other':'me'}),category:'bookings',bookingId:scenario==='booking'?'b':null,expectedStatus:'CONFIRMED',expiresAt:new Date(Date.now()+100000),attempts:0};
  const db={pushPreference:{findMany:async()=>[]},pushDevice:{findUnique:async()=>({id:'d',userId:'me',expiresAt:new Date(Date.now()+100000),user:{pushPreference:{bookings:scenario!=='consent'}}}),deleteMany:async()=>{}},pushBookingState:{deleteMany:async()=>{}},booking:{findUnique:async()=>({userId:'me',status:'CANCELLED'})},pushDelivery:{
   findMany:async(a:any)=>a.where.state==='PENDING'?[item]:[],updateMany:async()=>({count:1}),update:async(a:any)=>{state=a.data.state;},deleteMany:async()=>{}
  }};
  const worker=loadIsolatedModule('src/lib/push.ts',{'./db':{db},'./push-policy':policy});
  const original=global.fetch;
  global.fetch=async()=>{assert.fail('Must not send stale push');};
  try{assert.deepEqual(await worker.runPushNotifications(),{submitted:0});assert.equal(state,'SKIPPED');}finally{global.fetch=original;}
 }
});
test('provider rejection deactivates token; transient failures retry with bounded attempts',async()=>{
 for(const scenario of ['invalid','transient']) {
  let removed=false,result:any;
  const item={id:'q',deviceId:'d',data:JSON.stringify({recipientId:'me'}),category:'bookings',expiresAt:new Date(Date.now()+100000),attempts:0};
  const db={pushPreference:{findMany:async()=>[]},pushDevice:{findUnique:async()=>({id:'d',token:'test',userId:'me',expiresAt:new Date(Date.now()+100000),user:{pushPreference:{bookings:true}}}),deleteMany:async(a:any)=>{if(a.where.id)removed=true;}},pushBookingState:{deleteMany:async()=>{}},pushDelivery:{findMany:async(a:any)=>a.where.state==='PENDING'?[item]:[],updateMany:async(a:any)=>{if(a.data.error)result=a.data;return {count:1};},deleteMany:async()=>{}}};
  const worker=loadIsolatedModule('src/lib/push.ts',{'./db':{db},'./push-policy':policy});
  const original=global.fetch;
  global.fetch=async()=>scenario==='invalid'?new Response(JSON.stringify({data:{status:'error',details:{error:'DeviceNotRegistered'}}})):new Response('',{status:503});
  try{await worker.runPushNotifications();if(scenario==='invalid')assert.equal(removed,true);else{assert.equal(result.state,'PENDING');assert.ok(result.nextAttemptAt>Date.now());}}finally{global.fetch=original;}
 }
});
