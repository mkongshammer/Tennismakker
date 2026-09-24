import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchResasports,resaDate,resaCsv} from './resasports';
import {parseClubCsv} from './club-import-core';
import {loadIsolatedModule} from './testing/isolated-module';
const credentials={username:'test-api',password:'never-log',applicationId:'12',actorId:'34',sandbox:true};
const member={id_user:1,first_name:'Test',last_name:'Member',email:'test@example.invalid',mobile:'12345678'};
const facility={id_facility:2,name_facility:'Padel 1'};
const booking={id_booking:3,id_user:1,id_facility:2,start_timestamp:'2027-01-02 10:30:00',end_timestamp:'2027-01-02 12:00:00',dead_timestamp:null};
function provider(overrides:Record<string,unknown[]|undefined>={},inspect?:(url:string,options:RequestInit)=>void){return (async(url:any,options:any)=>{inspect?.(url,options);const key=url.includes('getUsers')?'users':url.includes('getFacilities')?'facilities':'bookings';return Response.json({success:true,data:{[key]:overrides[key]??{users:[member],facilities:[facility],bookings:[booking]}[key]}});}) as typeof fetch;}
test('read-only Resasports methods use fixed origin, POST body credentials and explicit club scope',async()=>{
 let calls=0;const snapshot=await fetchResasports(credentials,'2027-01-01','2027-01-03',provider({},(url,options)=>{calls++;assert.match(url,/^https:\/\/sport-sandbox.nubapp.com\/api\/v4\/(users\/getUsers|facilities\/getFacilities|bookings\/getBookings)\.php$/);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal((options.body as URLSearchParams).get('id_application'),'12');assert.equal((options.body as URLSearchParams).get('p'),'never-log');assert.ok(!url.includes('never-log'));}));
 assert.equal(calls,3);assert.equal(snapshot.bookings[0].start,'2027-01-02T09:30:00Z');assert.ok(!JSON.stringify(snapshot).includes('never-log'));
 assert.throws(()=>resaCsv(snapshot,{}),/Vælg/);const rows=parseClubCsv(resaCsv(snapshot,{'2':'Bane; "2"'}));assert.equal(rows[1].court,'Bane; "2"');assert.equal(rows[1].external_id,'3');
});
test('timezone conversion preserves summer/winter time and refuses DST ambiguity and missing hour',()=>{assert.equal(resaDate('2027-07-02 10:30:00'),'2027-07-02T08:30:00Z');for(const s of ['2026-10-25 02:30:00','2027-03-28 02:30:00','2027-02-30 12:00:00'])assert.throws(()=>resaDate(s));});
test('partial data and provider business failures cannot produce an import',async()=>{
 for(const overrides of [{users:[{...member,email:false}]},{users:[member,member]},{bookings:[{...booking,id_user:99}]},{bookings:[{...booking,dead_timestamp:'2027-01-02 10:00:00'}]},{facilities:[facility,facility]}])await assert.rejects(fetchResasports(credentials,'2027-01-01','2027-01-03',provider(overrides)));
 await assert.rejects(fetchResasports(credentials,'2027-01-01','2027-01-03',(async()=>Response.json({success:false,message:'secret echoed'})) as typeof fetch),e=>{assert.ok(!(e as Error).message.includes('secret'));return true;});
});
test('pagination requests the next page and refuses repeating pages instead of claiming complete data',async()=>{let page=0;await assert.rejects(fetchResasports(credentials,'2027-01-01','2027-01-03',provider({users:Array.from({length:100},(_,i)=>({...member,id_user:i+1,email:`test${i}@example.invalid`}))},(_,o)=>{page++;assert.equal((o.body as URLSearchParams).get('page'),String(page));})),/gentagne/);assert.equal(page,2);});
test('Resasports access is rejected before making a provider request for unauthorized users',async()=>{let called=false;const {previewResasports}=loadIsolatedModule('src/lib/resasports-actions.ts',{'./club-management-actions':{requireCustomClub:async()=>{throw Error('Ingen adgang');}},'./resasports':{fetchResasports:async()=>{called=true;}}});assert.deepEqual(await previewResasports(null,new FormData()),{error:'Ingen adgang'});assert.equal(called,false);});
