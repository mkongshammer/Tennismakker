/** Isolated SQL integration tests. Never reads DATABASE_URL or production credentials. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {execFileSync,spawn} from 'node:child_process';
import {SignJWT} from 'jose';
import {ADMIN_PAGES,adminHref} from '../src/lib/admin-navigation';
import {SUPERADMIN_PAGES,superadminHref} from '../src/lib/superadmin-navigation';
import * as fixedCore from '../src/lib/fixed-slots-core';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {PrismaClient} from '@prisma/client';
import {loadIsolatedModule} from '../src/lib/testing/isolated-module';
import * as importCore from '../src/lib/club-import-core';
import * as walletPolicy from '../src/lib/wallet-policy';

async function main(){
 const pg=await PGlite.create();
 const sql=execFileSync('node',['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script'],{encoding:'utf8'});
 await pg.exec(sql);
 const server=new PGLiteSocketServer({db:pg,host:'127.0.0.1',port:0,maxConnections:20});await server.start();
 const conn=`postgresql://postgres:postgres@${server.getServerConn()}/postgres`;const parsed=new URL(conn);assert.equal(parsed.hostname,'127.0.0.1');
 const db=new PrismaClient({datasources:{db:{url:conn+'?connection_limit=1&sslmode=disable'}}});
 let checks=0;
 const check=(name:string)=>{checks++;console.log('PASS '+name);};
 try{
  const club=await db.club.create({data:{slug:'isolated-test',name:'Isolated club',city:'Test',solutionMode:'CUSTOM'}});
  const other=await db.club.create({data:{slug:'isolated-other',name:'Other club',city:'Test'}});
  const court=await db.court.create({data:{clubId:club.id,name:'Bane 1'}});
  const member=await db.user.create({data:{email:'member@example.invalid',name:'Test member',passwordHash:'unusable',clubId:club.id}});
  const admin=await db.user.create({data:{email:'admin@example.invalid',name:'Test admin',passwordHash:'unusable',clubId:club.id,role:'CLUB_ADMIN'}});
  const management=loadIsolatedModule('src/lib/club-management-actions.ts',{'node:crypto':crypto,bcryptjs:bcrypt,'next/cache':{revalidatePath(){}},'./db':{db},'./session':{getCurrentUser:async()=>admin}});
  const form=new FormData();form.set('email','new@example.invalid');form.set('name','New member');form.set('phone','12345678');
  const created=await management.addClubMember(null,form);assert.ok(created.password);const saved=await db.user.findUniqueOrThrow({where:{email:'new@example.invalid'}});assert.ok(await bcrypt.compare(created.password,saved.passwordHash));assert.equal(saved.clubId,club.id);check('Member creation stores working password, phone and own club');
  await db.user.create({data:{email:'other@example.invalid',name:'Other member',passwordHash:'unchanged',clubId:other.id}});form.set('email','other@example.invalid');assert.ok((await management.addClubMember(null,form)).error);assert.equal((await db.user.findUniqueOrThrow({where:{email:'other@example.invalid'}})).clubId,other.id);check('Member cannot be moved from another club');
  const reservation=loadIsolatedModule('src/lib/court-reservation.ts',{'./db':{db}});
  const start=new Date(Date.now()+3*86400000);start.setMinutes(0,0,0);const end=new Date(+start+3600000);
  const data={courtId:court.id,userId:member.id,kind:'COURT',startsAt:start,endsAt:end,priceKr:100,status:'HOLD',holdExpiresAt:new Date(Date.now()+600000)};
  const booking=await reservation.createCourtReservation({data});await assert.rejects(reservation.createCourtReservation({data:{...data,startsAt:new Date(+start+1800000),endsAt:new Date(+end+1800000)}}),/optaget/);check('SQL reservation rejects partial overlap');
  const wallet=loadIsolatedModule('src/lib/wallet.ts',{'./db':{db},'./stripe':{stripe:()=>{throw Error('External payments forbidden in local test');}},'./billing':{},'./settings':{},'./memberships':{},'./wallet-policy':walletPolicy});
  const w=await db.clubWallet.create({data:{userId:member.id,clubId:club.id,balanceOre:200000}});
  await wallet.payBookingWithWallet(member.id,booking.id);await wallet.payBookingWithWallet(member.id,booking.id);
  assert.equal((await db.clubWallet.findUniqueOrThrow({where:{id:w.id}})).balanceOre,190000);assert.equal(await db.walletEntry.count({where:{walletId:w.id}}),1);assert.equal(await db.payment.count({where:{bookingId:booking.id}}),1);check('Wallet payment and retry debit exactly once');
  assert.equal(await wallet.cancelWalletBooking(member.id,booking.id),100);assert.equal(await wallet.cancelWalletBooking(member.id,booking.id),0);assert.equal((await db.clubWallet.findUniqueOrThrow({where:{id:w.id}})).balanceOre,200000);check('Timely cancellation and retry refund exactly once');
  const second=await reservation.createCourtReservation({data});await db.walletEntry.create({data:{walletId:w.id,eventKey:`booking:${second.id}`,amountOre:0,label:'Force constraint failure'}});
  await assert.rejects(wallet.payBookingWithWallet(member.id,second.id));assert.equal((await db.clubWallet.findUniqueOrThrow({where:{id:w.id}})).balanceOre,200000);assert.equal((await db.booking.findUniqueOrThrow({where:{id:second.id}})).status,'HOLD');assert.equal(await db.payment.count({where:{bookingId:second.id}}),0);check('Real SQL unique constraint rolls back wallet debit, booking and payment');
  await db.booking.update({where:{id:second.id},data:{holdExpiresAt:new Date(Date.now()-1000)}});
  await reservation.createCourtReservation({data});check('Expired unprepared hold releases the court');
  await db.booking.update({where:{id:second.id},data:{checkoutParams:'prepared'}});await assert.rejects(reservation.createCourtReservation({data}),/optaget/);check('Prepared checkout continues to block an expired hold');
  const importer=loadIsolatedModule('src/lib/club-import-actions.ts',{'node:crypto':crypto,'next/cache':{revalidatePath(){}},'./db':{db},'./club-management-actions':{requireCustomClub:async()=>({club})},'./club-import-core':importCore});
  const importStart=new Date(+start+2*86400000).toISOString().replace('.000Z','Z'),importEnd=new Date(+end+2*86400000).toISOString().replace('.000Z','Z');
  const csv=`type;email;name;phone;court;start;end;external_id\nmember;import@example.invalid;Imported;12345678;;;;\nbooking;import@example.invalid;;;Bane 1;${importStart};${importEnd};resa-1`;
  const f=new FormData();f.set('csv',csv);f.set('source','Resasports:12');let preview=await importer.importClubData(null,f);assert.ok(preview.digest);f.set('intent','import');f.set('digest',preview.digest);f.set('confirmed','on');let result=await importer.importClubData(null,f);assert.ok(result.ok,result.error);result=await importer.importClubData(null,f);assert.ok(result.ok,result.error);assert.equal(await db.bookingImport.count(),1);check('CSV/direct-import path creates records and external-ID retry is idempotent');
  const bad=csv.replaceAll('import@example.invalid','rollback@example.invalid').replace('resa-1','resa-2');f.set('csv',bad);f.set('intent','preview');preview=await importer.importClubData(null,f);f.set('digest',preview.digest);f.set('intent','import');result=await importer.importClubData(null,f);assert.ok(result.error);assert.equal(await db.user.count({where:{email:'rollback@example.invalid'}}),0);assert.equal(await db.bookingImport.count(),1);check('Booking conflict rolls back the entire member/booking import');
  const fixed=loadIsolatedModule('src/lib/fixed-slots.ts',{'./db':{db},'./fixed-slots-core':fixedCore});
  const seasonStart=new Date(Date.now()+10*86400000);seasonStart.setUTCHours(0,0,0,0);const seasonEnd=new Date(+seasonStart+350*86400000);
  const recurrence=await fixed.createFixedSlot({courtId:court.id,userId:member.id,dayOfWeek:seasonStart.getUTCDay(),hour:18,fromDate:seasonStart,toDate:seasonEnd,priceKr:0});assert.equal(recurrence.created,51);assert.equal(recurrence.clashes.length,0);check('A 51-week recurring reservation creates real bookings across DST');
  const duplicate=await fixed.createFixedSlot({courtId:court.id,userId:member.id,dayOfWeek:seasonStart.getUTCDay(),hour:18,fromDate:seasonStart,toDate:seasonEnd,priceKr:0});assert.equal(duplicate.created,0);assert.equal(duplicate.clashes.length,51);check('Recurring reservations report all occupied occurrences without duplicating bookings');
  if(process.argv.includes('--http')){
   const owner=await db.user.create({data:{email:'owner@example.invalid',name:'Test owner',passwordHash:'unusable',role:'SUPERADMIN'}});
   const standardAdmin=await db.user.create({data:{email:'standard-admin@example.invalid',name:'Standard admin',passwordHash:'unusable',clubId:other.id,role:'CLUB_ADMIN'}});
   await db.$disconnect();await pg.exec('DEALLOCATE ALL');
   const origin='http://127.0.0.1:31879',secret=crypto.randomBytes(32).toString('hex');
   const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','31879','-H','127.0.0.1'],{env:{PATH:process.env.PATH,NODE_ENV:'production',DATABASE_URL:conn+'?connection_limit=1&sslmode=disable&statement_cache_size=0',AUTH_SECRET:secret,PAYMENT_PROVIDER:'mock',APP_URL:origin,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
   let output='';app.stdout.on('data',b=>{output+=String(b);});app.stderr.on('data',b=>{output+=String(b);});
   try{
    let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,output);
    const token=async(userId:string)=>new SignJWT({sub:userId}).setProtectedHeader({alg:'HS256'}).setExpirationTime('5m').sign(new TextEncoder().encode(secret));
    const adminToken=await token(admin.id),playerToken=await token(member.id);
    const ownerToken=await token(owner.id),standardToken=await token(standardAdmin.id);
    for(const [paths,t] of [[ADMIN_PAGES.map(p=>adminHref(p.id)),adminToken],[SUPERADMIN_PAGES.map(p=>superadminHref(p.id)),ownerToken]] as [string[],string][]){for(const path of paths){const response=await fetch(origin+path,{headers:{Cookie:`tm_session=${t}`},redirect:'manual'});const html=await response.text();assert.equal(response.status,200,`${path}: ${html.slice(0,200)} ${output.slice(-2000)}`);assert.ok(!html.includes('NEXT_HTTP_ERROR_FALLBACK;500'),path);if(path==='/admin/integrationer')assert.ok(html.includes('Hent direkte fra Resasports'));}check(`HTTP rendering of ${paths.length} authenticated administration pages`);}
    const login=await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:saved.email,password:created.password})});assert.equal(login.status,200);const loginData=await login.json();assert.equal(loginData.user.id,saved.id);assert.ok(loginData.token);check('Actual local login API accepts the member password created by administration');
    assert.equal((await fetch(origin+'/admin',{redirect:'manual'})).status,307);
    assert.equal((await fetch(origin+'/api/v1/app-handoff',{method:'POST',headers:{Authorization:`Bearer ${playerToken}`,'Content-Type':'application/json'},body:JSON.stringify({destination:'/admin'})})).status,403);
    const handoff=await fetch(origin+'/api/v1/app-handoff',{method:'POST',headers:{Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json'},body:JSON.stringify({destination:'/admin'})});assert.equal(handoff.status,200);const handoffData=await handoff.json();const consumed=await fetch(origin+handoffData.path,{redirect:'manual'});assert.equal(consumed.status,307);assert.ok(consumed.headers.get('set-cookie')?.includes('tm_session='));assert.equal((await fetch(origin+handoffData.path,{redirect:'manual'})).status,401);check('App-to-admin handoff checks role and consumes its login ticket exactly once');
    const restricted=await fetch(origin+'/admin/lys-adgang',{headers:{Cookie:`tm_session=${standardToken}`},redirect:'manual'});assert.equal(restricted.status,307);assert.equal(restricted.headers.get('location'),'/admin');check('STANDARD club cannot open CUSTOM lighting administration');
   }finally{app.kill('SIGTERM');await new Promise<void>(resolve=>{if(app.exitCode!==null)resolve();else app.once('exit',()=>resolve());});}
  }
  console.log(`PASS ${checks} isolated database checks. PGlite does not prove multi-session PostgreSQL concurrency.`);
 }finally{await db.$disconnect();await server.stop();
  // Socket close handlers schedule transaction cleanup on the next event-loop turn.
  await new Promise<void>(resolve=>setImmediate(resolve));
  await new Promise<void>(resolve=>setImmediate(resolve));
  await pg.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
