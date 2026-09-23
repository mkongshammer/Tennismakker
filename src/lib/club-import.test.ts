import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {loadIsolatedModule} from './testing/isolated-module';
import * as core from './club-import-core';

function fixture() {
  let bookings:any[]=[];
  let imports=new Map<string,any>();
  const tx={
    $executeRaw:async()=>0, $queryRaw:async()=>[],
    user:{findFirst:async()=>({id:'member',clubId:'club'})},
    booking:{
      findFirst:async({where}:any)=>bookings.find(b=>b.startsAt<where.startsAt.lt&&b.endsAt>where.endsAt.gt),
      create:async({data}:any)=>{const row={...data,id:`booking-${bookings.length}`};bookings.push(row);return row;},
    },
    bookingImport:{
      findUnique:async({where}:any)=>imports.get(where.key),
      create:async({data}:any)=>{if(imports.has(data.key))throw Error('Duplicate import');imports.set(data.key,data);return data;},
    },
  };
  const db={court:{findMany:async()=>[{id:'court',name:'Bane 1'}]},$transaction:async(fn:any)=>{
    const beforeBookings=[...bookings],beforeImports=new Map(imports);
    try{return await fn(tx);}catch(error){bookings=beforeBookings;imports=beforeImports;throw error;}
  }};
  const api=loadIsolatedModule('src/lib/club-import-actions.ts',{
    'node:crypto':crypto,'next/cache':{revalidatePath(){}},'./db':{db},
    './club-management-actions':{requireCustomClub:async()=>({club:{id:'club'}})},'./club-import-core':core,
  });
  return {run:api.importClubData,counts:()=>({bookings:bookings.length,imports:imports.size})};
}
function form(overlap=false) {
  const at=(hour:number)=>new Date(Date.now()+7*86400000+hour*3600000).toISOString().replace(/\.\d{3}Z$/,'Z');
  const f=new FormData();f.set('source','Resasports');f.set('csv',[
    'type;email;court;start;end;external_id',
    `booking;member@example.dk;Bane 1;${at(0)};${at(1)};old-1`,
    `booking;member@example.dk;Bane 1;${at(overlap?0:2)};${at(overlap?1:3)};old-2`,
  ].join('\n'));return f;
}
async function confirm(run:any,f:FormData) {
  const preview=await run(null,f);assert.ok(preview.digest);
  f.set('digest',preview.digest);f.set('intent','import');f.set('confirmed','on');return run(null,f);
}
test('repeated CSV import preserves bookings without duplicates',async()=>{
  const f=fixture(),data=form();assert.ok((await confirm(f.run,data)).ok);
  assert.deepEqual(f.counts(),{bookings:2,imports:2});
  const repeated=await f.run(null,data);assert.ok(repeated.ok);assert.match(repeated.ok,/0 bookinger/);
  assert.deepEqual(f.counts(),{bookings:2,imports:2});
});
test('a booking conflict rolls back the entire CSV import and its deduplication records',async()=>{
  const f=fixture();assert.match((await confirm(f.run,form(true))).error,/overlapper/);
  assert.deepEqual(f.counts(),{bookings:0,imports:0});
});
