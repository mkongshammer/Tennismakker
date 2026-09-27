/** Actual control services + temporary SQL database; only Shelly is simulated. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {PrismaClient} from '@prisma/client';
import {loadIsolatedModule} from '../src/lib/testing/isolated-module';
import * as core from '../src/lib/club-control-core';
async function main(){
 const pg=await PGlite.create();await pg.exec(execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script'],{encoding:'utf8'}));
 const server=new PGLiteSocketServer({db:pg,host:'127.0.0.1',port:0});await server.start();
 const db=new PrismaClient({datasources:{db:{url:`postgresql://postgres:postgres@${server.getServerConn()}/postgres?connection_limit=1&sslmode=disable`}}});
 let count=0;const pass=(label:string)=>{console.log('PASS '+label);count++;};
 const originalFetch=global.fetch;global.fetch=async()=>{throw Error('External network forbidden in control test');};
 try{
  const club=await db.club.create({data:{name:'Simulated padel club',slug:'control-test',city:'Test',solutionMode:'CUSTOM'}});
  const courts=await Promise.all([1,2,3,4].map(n=>db.court.create({data:{name:`Bane ${n}`,sport:'PADEL',clubId:club.id}})));
  const user=await db.user.create({data:{name:'Test member',email:'member@example.invalid',passwordHash:'unusable',clubId:club.id}});
  const admin={id:user.id,clubId:club.id,role:'CLUB_ADMIN'};
  const control=await db.clubControl.create({data:{clubId:club.id,enabled:true,serverUrl:'https://test.invalid',authKeyCipher:'test-only',accessBeforeMinutes:15,accessAfterMinutes:10,lightsBeforeMinutes:10,lightsAfterMinutes:5,doorPulseSeconds:5}});
  const devices=await Promise.all(['a','b'].map(externalId=>db.clubControlDevice.create({data:{controlId:control.id,name:externalId,externalId,channelCount:externalId==='a'?4:2,online:true}})));
  const channels=await Promise.all([...courts.map((c,i)=>({deviceId:devices[0].id,channel:i,kind:'COURT_LIGHT',courtId:c.id,label:c.name})),{deviceId:devices[1].id,channel:0,kind:'COMMON_LIGHT',courtId:null,label:'Ganglys'},{deviceId:devices[1].id,channel:1,kind:'DOOR',courtId:null,label:'Indgang'}].map(data=>db.clubControlChannel.create({data:{...data,setupConfirmedAt:new Date()}})));
  const outputs=new Map<string,boolean>(['a_0','a_1','a_2','a_3','b_0','b_1'].map(k=>[k,false]));
  let offline=false,fail=false;const calls:{refs:any[];on:boolean;pulse?:number}[]=[];
  const provider={getShellyDeviceStates:async()=>devices.map(d=>({id:d.externalId,online:offline?0:1})),shellySwitchOutput:(state:any,ch:number)=>state?outputs.get(`${state.id}_${ch}`)??null:null,setShellySwitchGroup:async(_credentials:any,refs:any[],on:boolean,pulse?:number)=>{calls.push({refs,on,pulse});const failed=new Map<string,string>();for(const r of refs){const key=`${r.deviceId}_${r.channel}`;if(fail)failed.set(key,'simulated controller failure');else if(!pulse)outputs.set(key,on);}return{failed};}};
  const service=loadIsolatedModule('src/lib/club-control.ts',{'./db':{db},'./crypto-box':{open:()=> 'synthetic-key'},'./club-control-core':core,'./shelly-cloud':provider});
  const start=new Date(Date.now()+3600000),end=new Date(+start+3600000);const at=(minutes:number)=>new Date(+start+minutes*60000);
  const booking=await db.booking.create({data:{courtId:courts[1].id,userId:user.id,kind:'COURT',status:'CONFIRMED',startsAt:start,endsAt:end,priceKr:0}});
  await service.reconcileClubControl(club.id,at(-11));assert.equal(calls.length,0);pass('No light before configured lead time');
  await service.reconcileClubControl(club.id,at(-10));assert.equal(outputs.get('a_1'),true);assert.equal(outputs.get('b_0'),true);for(const k of ['a_0','a_2','a_3','b_1'])assert.equal(outputs.get(k),false);pass('Booked court and corridor turn on; other courts and door remain untouched');
  const before=calls.length;await service.reconcileClubControl(club.id,at(0));assert.equal(calls.length,before);pass('Repeated automatic reconciliation does not resend unchanged states');
  await service.reconcileClubControl(club.id,at(65));assert.equal(outputs.get('a_1'),true);await service.reconcileClubControl(club.id,at(65.01));assert.equal(outputs.get('a_1'),false);assert.equal(outputs.get('b_0'),false);pass('Court and corridor turn off after configured trailing window');
  await db.booking.update({where:{id:booking.id},data:{status:'HOLD'}});await service.reconcileClubControl(club.id,start);assert.equal(outputs.get('a_1'),false);await db.booking.update({where:{id:booking.id},data:{status:'CANCELLED'}});await service.reconcileClubControl(club.id,start);assert.equal(outputs.get('a_1'),false);pass('Unpaid and cancelled bookings do not activate lights');
  const actions=loadIsolatedModule('src/lib/club-control-actions.ts',{'./db':{db},'./club-management-actions':{requireCustomClub:async()=>({club})},'./session':{getCurrentUser:async()=>admin},'next/cache':{revalidatePath(){}},'next/navigation':{},'./crypto-box':{},'./club-control-setup':{},'./club-control':service,'./shelly-cloud':{}});
  const f=new FormData();f.set('channelId',channels[0].id);f.set('minutes','15');assert.ok((await actions.setManualLight(null,f)).ok);assert.equal(outputs.get('a_0'),true);const override=await db.clubControlChannel.findUniqueOrThrow({where:{id:channels[0].id}});await service.reconcileClubControl(club.id,new Date(+override.manualOnUntil!+1));assert.equal(outputs.get('a_0'),false);pass('Admin manual-on works and automatically expires');
  assert.ok((await actions.setManualLight(null,f)).ok);f.set('minutes','0');assert.ok((await actions.setManualLight(null,f)).ok);assert.equal(outputs.get('a_0'),false);pass('Admin Auto button immediately restores booking-based state');
  for(const channelId of [channels[5].id,'another-club-channel']){f.set('channelId',channelId);f.set('minutes','15');assert.ok((await actions.setManualLight(null,f)).error);}pass('Manual light action refuses doors and unowned channels');
  await db.booking.update({where:{id:booking.id},data:{status:'CONFIRMED'}});
  const denied=async(fn:()=>Promise<any>,status:number)=>assert.rejects(fn,(e:any)=>e.status===status);
  await denied(()=>service.unlockDoorForBooking('other-user',booking.id,start),404);await denied(()=>service.unlockDoorForBooking(user.id,booking.id,at(-15.01)),403);await denied(()=>service.unlockDoorForBooking(user.id,booking.id,at(70.01)),403);pass('Door rejects another user, too early and too late access');
  const opened=await service.unlockDoorForBooking(user.id,booking.id,at(-15));assert.equal(opened.ok,true);assert.equal(calls.at(-1)?.pulse,5);assert.deepEqual(calls.at(-1)?.refs,[{deviceId:'b',channel:1}]);pass('At window start only the mapped door receives the five-second pulse');
  const beforeDouble=calls.length;await denied(()=>service.unlockDoorForBooking(user.id,booking.id,at(-15)),429);assert.equal(calls.length,beforeDouble);pass('Double-tap is rejected by database cooldown without another command');
  assert.equal((await service.unlockDoorForBooking(user.id,booking.id,at(70))).ok,true);pass('Door remains accessible at exact window end');
  await db.clubControlChannel.update({where:{id:channels[5].id},data:{lastCommandAt:null}});fail=true;await denied(()=>service.unlockDoorForBooking(user.id,booking.id,start),502);assert.ok(await db.clubControlEvent.findFirst({where:{bookingId:booking.id,action:'DOOR_OPEN',outcome:'FAILED'}}));pass('Controller failure returns an error and records failed door audit');fail=false;
  offline=true;const offlineResult=await service.reconcileClubControl(club.id,start);assert.equal(offlineResult.failed,5);assert.ok((await db.clubControl.findUniqueOrThrow({where:{id:control.id}})).lastError);offline=false;pass('Offline controllers are reported as errors, not success');
  fail=true;const failedResult=await service.reconcileClubControl(club.id,start);assert.ok(failedResult.failed>0);assert.ok(await db.clubControlEvent.findFirst({where:{clubId:club.id,action:'LIGHT_ON',outcome:'FAILED'}}));fail=false;await service.reconcileClubControl(club.id,start);assert.equal(outputs.get('a_1'),true);pass('Failed light commands are audited and recover on a later retry');
  await db.clubControl.update({where:{id:control.id},data:{enabled:false}});const n=calls.length;assert.equal((await service.reconcileClubControl(club.id,start)).skipped,'ikke aktiv');await denied(()=>service.unlockDoorForBooking(user.id,booking.id,start),409);assert.equal(calls.length,n);pass('Paused system sends neither light nor door commands');
  console.log(`PASS ${count} control integration scenarios; temporary SQL database and simulated hardware only.`);
 }finally{global.fetch=originalFetch;await db.$disconnect();await server.stop();await new Promise<void>(r=>setImmediate(r));await new Promise<void>(r=>setImmediate(r));await pg.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
