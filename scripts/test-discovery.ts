/**
 * Discovery correctness and scale, against an isolated PGlite database.
 * Never reads DATABASE_URL. Run: npm run test:discovery
 *
 * Correctness: whole-state searches, ambiguous cities, ZIPs, radius edges,
 * clubs across a state border, clubs without coordinates, name search.
 * Scale: 10 → 1,000 clubs; asserts that rows loaded and availability
 * reads stay bounded by the page, not by the table.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {PrismaClient} from '@prisma/client';
import {loadIsolatedModule} from '../src/lib/testing/isolated-module';
import * as usPlaces from '../src/lib/us-places';
import * as discoveryFilters from '../src/lib/discovery-filters';
import * as sports from '../src/lib/sports';

type Row={name:string;city:string;state:string;lat:number|null;lon:number|null;address?:string|null;sport?:string;price?:number;charges?:boolean};

async function main(){
 const pg=await PGlite.create();
 const sql=execFileSync('node',['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script'],{encoding:'utf8'});
 await pg.exec(sql);
 const server=new PGLiteSocketServer({db:pg,host:'127.0.0.1',port:0,maxConnections:20});await server.start();
 const conn=`postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
 const db=new PrismaClient({datasources:{db:{url:conn+'?connection_limit=1&sslmode=disable'}}});
 let checks=0;const check=(name:string)=>{checks++;console.log('PASS '+name);};
 const counters={availability:0,clubFindMany:0,rowsLoaded:0,groupBy:0};
 const countingDb=new Proxy(db,{get(target,prop){
  if(prop==='club')return new Proxy((target as any).club,{get(c,p){
   if(p==='findMany')return async(args:any)=>{counters.clubFindMany++;const rows=await c.findMany(args);counters.rowsLoaded+=rows.length;return rows;};
   return (c as any)[p];
  }});
  if(prop==='review')return new Proxy((target as any).review,{get(r,p){if(p==='groupBy')return async(args:any)=>{counters.groupBy++;return r.groupBy(args);};return (r as any)[p];}});
  return (target as any)[prop];
 }});
 const availabilityDelayMs=5;
 const discovery=loadIsolatedModule('src/lib/discovery.ts',{
  './db':{db:countingDb},
  './reviews':{clubRatings:async(ids:string[])=>{if(!ids.length)return new Map();counters.groupBy++;return new Map();}},
  './integrations':{getClubAvailability:async(clubId:string,from:Date,until:Date)=>{counters.availability++;await new Promise(r=>setTimeout(r,availabilityDelayMs));const club=await db.club.findUnique({where:{id:clubId},include:{courts:true}});const start=new Date(Math.max(+from,Date.now()+3600000));return {slots:club!.courts.map(c=>({courtId:c.id,courtName:c.name,surface:c.surface,startsAt:start,endsAt:new Date(+start+3600000),indoor:c.indoor,priceKr:club!.priceHour})),needsClubEntry:false};}},
  './us-places':usPlaces,
  './discovery-filters':discoveryFilters,
  './sports':sports,
 });
 const reset=()=>{counters.availability=0;counters.clubFindMany=0;counters.rowsLoaded=0;counters.groupBy=0;};
 let n=0;
 async function seed(rows:Row[]){
  for(const r of rows){
   const slug=`club-${++n}`;
   const club=await db.club.create({data:{slug,name:r.name,city:r.city,country:'US',currency:'USD',timeZone:'America/New_York',status:'APPROVED',latitude:r.lat,longitude:r.lon,address:r.address===undefined?(r.lat!=null?`1 Main St, ${r.city}, ${r.state} 00000`:null):r.address,priceHour:r.price??30,stripeChargesEnabled:r.charges??true,openHour:7,closeHour:22}});
   await db.court.create({data:{clubId:club.id,name:'Court 1',sport:r.sport??'TENNIS',surface:'HARD'}});
  }
 }
 const search=(q:string,extra:Record<string,string>={})=>discovery.discoverClubs(discoveryFilters.parseDiscoveryFilters({q,...extra}));
 try{
  await seed([
   {name:'Brookline Racquet Club',city:'Brookline',state:'MA',lat:42.3318,lon:-71.1212},
   {name:'Williamstown Tennis',city:'Williamstown',state:'MA',lat:42.7120,lon:-73.2037},      // far west MA, ~130 mi from Boston
   {name:'Provincetown Courts',city:'Provincetown',state:'MA',lat:42.0584,lon:-70.1787},      // Cape tip
   {name:'Nashua Indoor Tennis',city:'Nashua',state:'NH',lat:42.7654,lon:-71.4676},            // NH, ~35 mi from Boston
   {name:'Springfield Racquet',city:'Springfield',state:'MA',lat:42.1015,lon:-72.5898},
   {name:'Springfield Tennis Center',city:'Springfield',state:'IL',lat:39.7817,lon:-89.6501},
   {name:'Downtown Boston Courts',city:'Boston',state:'MA',lat:null,lon:null,address:'10 Summer St, Boston, MA 02110'}, // no coordinates, but a US address
   {name:'Hidden Hills Tennis',city:'Hidden Hills',state:'MA',lat:null,lon:null,address:null},   // no coordinates, no address
   {name:'Brooklyn Padel House',city:'Brooklyn',state:'NY',lat:40.7204,lon:-73.9617,sport:'PADEL'},
  ]);
  // 1. Whole state, not a radius around its center.
  let r=await search('Massachusetts');
  assert.equal(r.place?.kind,'state');
  const names=(x:any)=>x.clubs.map((c:any)=>c.name).sort();
  assert.deepEqual(names(r),['Brookline Racquet Club','Downtown Boston Courts','Provincetown Courts','Springfield Racquet','Williamstown Tennis']);
  assert.ok(!names(r).includes('Nashua Indoor Tennis'),'NH club must not appear in an MA search');
  assert.ok(!names(r).includes('Hidden Hills Tennis'),'a club with neither coordinates nor a state in its address cannot be placed in a state');
  check('A state search returns every club in the state, east to west, and none across the border');
  // 2. City radius: Boston 50 mi includes Nashua NH (cross-border) and the coordinate-less Boston club, excludes Williamstown.
  r=await search('Boston, MA');
  assert.deepEqual(names(r),['Brookline Racquet Club','Downtown Boston Courts','Nashua Indoor Tennis','Provincetown Courts']);
  assert.equal(r.clubs[0].name,'Brookline Racquet Club');
  assert.equal(r.clubs.at(-1)!.name,'Downtown Boston Courts','unknown distance sorts last');
  assert.equal(r.clubs.at(-1)!.distanceMiles,null);
  check('A city search uses the radius across state borders and keeps a same-city club without coordinates');
  r=await search('Boston, MA',{radius:'10'});
  assert.deepEqual(names(r),['Brookline Racquet Club','Downtown Boston Courts']);
  check('Radius filtering is honoured');
  // 3. ZIP.
  r=await search('02446');
  assert.equal(r.place?.kind,'zip');assert.equal(r.clubs[0].name,'Brookline Racquet Club');assert.ok(r.clubs[0].distanceMiles!<2);
  check('A ZIP search centres on the ZIP');
  // 4. Ambiguity.
  r=await search('Springfield');
  assert.ok(r.place?.alternatives?.length);
  assert.equal(r.clubs.length,1,'only the chosen Springfield is listed');
  const chosen=r.clubs[0].name;const other=chosen==='Springfield Racquet'?'Springfield Tennis Center':'Springfield Racquet';
  const altState=other==='Springfield Racquet'?'MA':'IL';
  const alt=r.place!.alternatives!.find((a:any)=>a.label===`Springfield, ${altState}`);assert.ok(alt,JSON.stringify(r.place!.alternatives));
  const second=await search(alt.query);assert.deepEqual(names(second),[other]);
  check('An ambiguous city shows the best-known one and the alternatives lead to the other');
  // 5. Nonexistent place and name search.
  r=await search('Atlantis, ZZ');assert.equal(r.placeUnresolved,true);assert.equal(r.clubs.length,0);
  r=await search('Padel House',{sport:'PADEL'});assert.deepEqual(names(r),['Brooklyn Padel House']);assert.equal(r.place,null);
  check('Unknown places are reported and club names still search');
  // 6. Nationwide, sport filter.
  r=await search('',{sport:'PADEL'});assert.deepEqual(names(r),['Brooklyn Padel House']);assert.equal(r.totalForSport,1);
  r=await search('');assert.equal(r.total,8);assert.equal(r.clubs.length,8);
  check('Nationwide browse counts per sport');

  // Scale: add clubs around the country, then measure.
  const cities=[['Austin','TX',30.2672,-97.7431],['Denver','CO',39.7392,-104.9903],['Seattle','WA',47.6062,-122.3321],['Miami','FL',25.7617,-80.1918],['Chicago','IL',41.8781,-87.6298],['Phoenix','AZ',33.4484,-112.074],['Atlanta','GA',33.749,-84.388],['Boston','MA',42.3601,-71.0589],['Los Angeles','CA',34.0522,-118.2437],['New York','NY',40.7128,-74.006]] as const;
  const report:string[]=[];
  for(const target of [10,100,500,1000]){
   const have=await db.club.count();
   const rows:Row[]=[];
   for(let i=have;i<target;i++){const c=cities[i%cities.length];rows.push({name:`Club ${i}`,city:c[0],state:c[1],lat:c[2]+((i*37)%100-50)/100,lon:c[3]+((i*53)%100-50)/100});}
   await seed(rows);
   const total=await db.club.count();
   const runs:[string,()=>Promise<any>][]=[
    ['Boston, MA (50 mi)',()=>search('Boston, MA')],
    ['Massachusetts',()=>search('Massachusetts')],
    ['nationwide page 1',()=>search('')],
    ['Boston, MA · today',()=>search('Boston, MA',{today:'1'})],
   ];
   for(const [label,fn] of runs){
    reset();const t0=performance.now();const res=await fn();const ms=Math.round(performance.now()-t0);
    report.push(`${String(total).padStart(5)} clubs · ${label.padEnd(20)} total=${String(res.total).padStart(4)} shown=${String(res.clubs.length).padStart(2)} rowsLoaded=${String(counters.rowsLoaded).padStart(4)} availability=${String(counters.availability).padStart(2)} ${String(ms).padStart(5)} ms`);
    assert.ok(res.clubs.length<=discoveryFilters.DISCOVERY_PAGE_SIZE);
    assert.ok(counters.availability<=Math.max(discoveryFilters.DISCOVERY_PAGE_SIZE,discovery.TODAY_FILTER_CANDIDATES),`availability reads bounded (${counters.availability})`);
    assert.equal(counters.clubFindMany,1,'one club query per search');
    if(label.startsWith('Boston'))assert.ok(counters.rowsLoaded<total/2||total<=20,`geographic prefilter should not load the whole table (${counters.rowsLoaded}/${total})`);
   }
   // Paging is stable and complete.
   const p1=await search('');const last=await search('',{page:String(Math.ceil(p1.total/p1.pageSize))});
   assert.equal(p1.page,1);assert.ok(last.clubs.length>0);assert.ok(last.page*last.pageSize>=last.total);
  }
  // Market interest: register → confirm → notify on club approval → unsubscribe → prune.
  const mails:any[]=[];
  const interest=loadIsolatedModule('src/lib/market-interest.ts',{'./db':{db},'./settings':{getSettings:async()=>({appUrl:'https://racketbuddy.test'})},'./email':{sendMail:async(m:any)=>{mails.push(m);return true;}},'./us-places':usPlaces,'./discovery':{placeKey:discovery.placeKey},'./sports':sports,'./market-interest-core':await import('../src/lib/market-interest-core')});
  const core=await import('../src/lib/market-interest-core');
  const headers=new Headers({'x-forwarded-for':'203.0.113.5'});
  let out=await interest.registerInterest({email:'Fan@Example.com',sport:'tennis',q:'Burlington, VT'},{headers,source:'web'});
  assert.ok(out.ok&&out.confirmationSent&&!out.alreadyConfirmed,JSON.stringify(out));
  assert.equal(mails.length,1);assert.match(mails[0].subject,/Confirm/);assert.match(mails[0].body,/\/api\/v1\/market-interest\/confirm\?id=/);
  out=await interest.registerInterest({email:'fan@example.com',sport:'TENNIS',q:'burlington vt'},{headers,source:'api'});
  assert.ok(out.ok&&!out.confirmationSent,'same person, same place: no second mail within the hour');
  assert.equal(await db.marketInterest.count(),1,'idempotent per email/kind/sport/place');
  assert.equal(await interest.notifyInterestForClub((await db.club.create({data:{slug:'vt-club',name:'Burlington Tennis',city:'Burlington',country:'US',currency:'USD',timeZone:'America/New_York',status:'APPROVED',latitude:44.4759,longitude:-73.2121,address:'1 Lake St, Burlington, VT 05401',sports:'TENNIS'}})).id),0,'unconfirmed sign-ups are never notified');
  const row=await db.marketInterest.findFirstOrThrow();
  assert.equal(await interest.confirmInterest(row.id,'bad-token'),'invalid');
  assert.equal(await interest.confirmInterest(row.id,core.interestToken(row.id,'confirm')),'confirmed');
  assert.equal(await interest.confirmInterest(row.id,core.interestToken(row.id,'confirm')),'already');
  const far=await db.club.create({data:{slug:'far-club',name:'Far Away Tennis',city:'Austin',country:'US',currency:'USD',timeZone:'America/Chicago',status:'APPROVED',latitude:30.27,longitude:-97.74,address:'1 Congress Ave, Austin, TX 78701',sports:'TENNIS'}});
  assert.equal(await interest.notifyInterestForClub(far.id),0,'a club 1,500 miles away does not notify');
  const padel=await db.club.create({data:{slug:'vt-padel',name:'Burlington Padel',city:'Burlington',country:'US',currency:'USD',timeZone:'America/New_York',status:'APPROVED',latitude:44.47,longitude:-73.21,address:'2 Lake St, Burlington, VT 05401',sports:'PADEL'}});
  assert.equal(await interest.notifyInterestForClub(padel.id),0,'another sport does not notify');
  const near=await db.club.findUniqueOrThrow({where:{slug:'vt-club'}});
  mails.length=0;
  assert.equal(await interest.notifyInterestForClub(near.id),1);
  assert.match(mails[0].subject,/now bookable near Burlington, VT/);assert.match(mails[0].body,/\/clubs\/vt-club/);assert.match(mails[0].body,/unsubscribe\?id=/);
  assert.equal(await interest.notifyInterestForClub(near.id),0,'notified once, never twice');
  assert.equal((await db.marketInterest.findUniqueOrThrow({where:{id:row.id}})).notifiedAbout,near.id);
  // Rate limit: the 9th distinct place for one e-mail within the hour is refused.
  for(const city of ['Austin, TX','Denver, CO','Miami, FL','Chicago, IL','Seattle, WA','Phoenix, AZ'])assert.ok((await interest.registerInterest({email:'fan@example.com',sport:'TENNIS',q:city},{headers:new Headers(),source:'web'})).ok);
  const refused=await interest.registerInterest({email:'fan@example.com',sport:'TENNIS',q:'Atlanta, GA'},{headers:new Headers(),source:'web'});
  assert.equal(refused.ok,false);assert.equal((refused as any).status,429);
  const bad=await interest.registerInterest({email:'someone@example.com',sport:'TENNIS',q:'Atlantis, ZZ'},{headers:new Headers(),source:'web'});assert.equal(bad.ok,false);assert.equal((bad as any).status,400);
  assert.ok(await interest.unsubscribeInterest(row.id,core.interestToken(row.id,'unsubscribe')));
  assert.equal(await db.marketInterest.findUnique({where:{id:row.id}}),null,'unsubscribe deletes the row');
  assert.equal(await interest.unsubscribeInterest(row.id,core.interestToken(row.id,'unsubscribe')),true,'a second click is harmless');
  await db.marketInterest.updateMany({data:{createdAt:new Date(Date.now()-40*86400000)}});
  const pruned=await interest.pruneInterest();assert.equal(pruned.unconfirmedDeleted,6);assert.equal(await db.marketInterest.count(),0);
  const summary=await interest.marketInterestSummary();assert.deepEqual(summary,[]);
  check('Market interest: confirm-before-count, radius+sport matching, notify once, rate limit, unsubscribe deletes, retention prunes');
  console.log(report.join('\n'));
  check('Discovery stays bounded at 10, 100, 500 and 1,000 clubs: one indexed query, availability only for the page');
  console.log(`PASS ${checks} discovery checks.`);
 }finally{await db.$disconnect();await server.stop();await new Promise<void>(r=>setImmediate(r));await pg.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
