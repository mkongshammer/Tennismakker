import {test} from 'node:test';
import assert from 'node:assert/strict';
import {walletCredit,moneyOre} from './wallet-policy';
import {parseClubCsv,importDate} from './club-import-core';
import {clubHasSection} from './club-features';
import {zonedOccurrences} from './fixed-slots-core';
import {loadIsolatedModule} from './testing/isolated-module';
test('wallet gives exact 1800/2000 credit and selects best eligible tier',()=>{
 const tiers=[{paidOre:180000,creditOre:200000},{paidOre:360000,creditOre:420000}];
 assert.equal(walletCredit(180000,tiers),200000);assert.equal(walletCredit(90000,tiers),90000);
 assert.equal(walletCredit(360000,tiers),420000);assert.equal(moneyOre('1800,25'),180025);
 assert.throws(()=>moneyOre('1e6'));assert.throws(()=>moneyOre('1.005'));assert.throws(()=>walletCredit(-1,tiers));
 assert.throws(()=>walletCredit(180000,[{paidOre:0,creditOre:200000}]));
});
test('standard dashboard excludes custom features and custom includes them',()=>{
 for(const section of ['medlemmer','hold','lys-adgang','priser','hjemmeside'] as const){assert.equal(clubHasSection('STANDARD',section),false);assert.equal(clubHasSection('CUSTOM',section),true);}
 assert.equal(clubHasSection('STANDARD','bookinger'),true);
});
test('CSV supports quoted names and rejects malformed data and missing timezone',()=>{
 const rows=parseClubCsv('type;email;name\nmember;test@example.dk;"Jensen; Ole"');assert.equal(rows[0].name,'Jensen; Ole');
 assert.throws(()=>parseClubCsv('type;email\nmember;"broken'));
 assert.throws(()=>parseClubCsv('type;email\nmember;user@example.dk;extra'));
 assert.throws(()=>importDate('2027-01-10T18:00:00'));
 assert.equal(importDate('2027-01-10T18:00:00+01:00').toISOString(),'2027-01-10T17:00:00.000Z');
});
test('fixed bookings preserve Danish time across summer/winter switch',()=>{
 const dates=zonedOccurrences(new Date('2026-10-18'),new Date('2026-11-01'),0,18,'Europe/Copenhagen');
 assert.deepEqual(dates.map(d=>d.toISOString()),['2026-10-18T16:00:00.000Z','2026-10-25T17:00:00.000Z','2026-11-01T17:00:00.000Z']);
});
test('custom actions deny other roles and standard clubs before writes',async()=>{
 for(const role of ['PLAYER','CLUB_ADMIN']){
  const api=loadIsolatedModule('src/lib/club-management-actions.ts',{'node:crypto':{},bcryptjs:{},'next/cache':{},'./session':{getCurrentUser:async()=>({role,clubId:'c'})},'./db':{db:{club:{findUnique:async()=>({solutionMode:'STANDARD'})}}}});
  await assert.rejects(api.requireCustomClub());
 }
});
test('manual light action never commands another club or a door',async()=>{
 let invoked=false;
 const mocks:any={'next/cache':{revalidatePath(){}},'next/navigation':{},'./crypto-box':{},'./club-control-setup':{},'./shelly-cloud':{},'./club-management-actions':{requireCustomClub:async()=>({})},'./session':{getCurrentUser:async()=>({id:'u',role:'CLUB_ADMIN',clubId:'c'})},'./db':{db:{clubControlChannel:{findFirst:async({where}:any)=>{assert.equal(where.device.control.clubId,'c');assert.deepEqual(where.kind.in,['COURT_LIGHT','COMMON_LIGHT']);return null;}}}},'./club-control':{reconcileClubControl:async()=>{invoked=true;}}};
 const api=loadIsolatedModule('src/lib/club-control-actions.ts',mocks);const f=new FormData();f.set('minutes','30');f.set('channelId','other');
 assert.ok((await api.setManualLight(null,f)).error);assert.equal(invoked,false);
});
test('reservation lock preserves holds with a prepared checkout even after local expiry',async()=>{
 let query:any,writes=0,locked=false;
 const tx={$queryRaw:async()=>{locked=true;},booking:{findFirst:async({where}:any)=>{assert.equal(locked,true);query=where;return{id:'occupied'};},create:async()=>{writes++;}},externalBusy:{findFirst:async()=>null}};
 const {createCourtReservation}=loadIsolatedModule('src/lib/court-reservation.ts',{'./db':{db:{$transaction:async(fn:any)=>fn(tx)}}});
 await assert.rejects(createCourtReservation({data:{courtId:'c',startsAt:new Date(),endsAt:new Date(Date.now()+3600000)}}),/optaget/);
 assert.ok(query.OR[1].OR.some((x:any)=>x.checkoutParams?.not===null));assert.equal(writes,0);
});
