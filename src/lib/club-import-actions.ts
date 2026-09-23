'use server';
import crypto from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {db} from './db';
import {requireCustomClub} from './club-management-actions';
import {parseClubCsv,importDate} from './club-import-core';
export async function importClubData(_prev:unknown,form:FormData):Promise<{ok?:string;error?:string;preview?:string;digest?:string}>{
 try {
  const {club}=await requireCustomClub();
  const text=String(form.get('csv')??''),source=String(form.get('source')??'').trim();
  if(!source||source.length>80)throw Error('Angiv kildesystemet, fx Resasports.');
  const rows=parseClubCsv(text);
  const courts=await db.court.findMany({where:{clubId:club.id}});
  for(const [i,r] of rows.entries()){
   if(!['member','booking'].includes(r.type)||!/^\S+@\S+\.\S+$/.test(r.email))throw Error(`Række ${i+2}: kontrollér type og e-mail.`);
   if(r.type==='member'&&(!r.name||r.name.length>150||(r.phone??'').length>40))throw Error(`Række ${i+2}: kontrollér navn og telefon.`);
   if(r.type==='booking'){
    if(!r.external_id||r.external_id.length>150||courts.filter(c=>c.name===r.court).length!==1)throw Error(`Række ${i+2}: eksternt ID og entydigt banenavn er påkrævet.`);
    const start=importDate(r.start),end=importDate(r.end);
    if(start<=new Date()||end<=start||+end-+start>86400000||+start>Date.now()+366*86400000)throw Error(`Række ${i+2}: vælg en fremtidig booking, højst et år frem og højst 24 timer lang.`);
   }
  }
  if(form.get('intent')!=='import')return {preview:`${rows.filter(r=>r.type==='member').length} medlemsrækker og ${rows.filter(r=>r.type==='booking').length} bookinger. Ved import kontrolleres konti, dubletter og overlap igen. Ingen betaling opkræves, og der sendes ingen mail.`,digest:crypto.createHash('sha256').update(text+source).digest('hex')};
  if(form.get('digest')!==crypto.createHash('sha256').update(text+source).digest('hex'))throw Error('Data er ændret. Vis forhåndsvisningen igen.');
  if(form.get('confirmed')!=='on')throw Error('Bekræft at du har gennemgået importen.');
  const result=await db.$transaction(async tx=>{
   // One import per club; repeated external IDs are idempotent.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${club.id}))`;
   for(const courtId of courts.map(c=>c.id).sort())await tx.$queryRaw`SELECT id FROM "Court" WHERE id=${courtId} FOR UPDATE`;
   let members=0,bookings=0,skipped=0;
   for(const r of rows.filter(r=>r.type==='member')){
    const email=r.email.toLowerCase();const existing=await tx.user.findUnique({where:{email}});
    if(existing&&(existing.role!=='PLAYER'||existing.clubId&&existing.clubId!==club.id))throw Error(`Medlem ${email} har en anden klub eller administratorrolle. Ingen rækker er importeret.`);
    if(existing){await tx.user.update({where:{id:existing.id},data:{clubId:club.id}});skipped++;}
    else {await tx.user.create({data:{email,name:r.name,phone:r.phone||null,clubId:club.id,passwordHash:crypto.randomBytes(32).toString('hex')}});members++;}
   }
   for(const r of rows.filter(r=>r.type==='booking')){
    const importKey=crypto.createHash('sha256').update(JSON.stringify([club.id,source,r.external_id])).digest('hex');
    if(await tx.booking.findUnique({where:{importKey}})){skipped++;continue;}
    const member=await tx.user.findFirst({where:{email:r.email.toLowerCase(),clubId:club.id}});if(!member)throw Error(`Tilføj først medlemmet ${r.email} i samme import eller i medlemsadministrationen.`);
    const court=courts.find(c=>c.name===r.court)!,startsAt=importDate(r.start),endsAt=importDate(r.end);
    const clash=await tx.booking.findFirst({where:{courtId:court.id,status:{in:['CONFIRMED','HOLD']},startsAt:{lt:endsAt},endsAt:{gt:startsAt}}});
    if(clash)throw Error(`Booking ${r.external_id} overlapper en eksisterende booking. Ingen rækker er importeret.`);
    await tx.booking.create({data:{importKey,courtId:court.id,userId:member.id,startsAt,endsAt,kind:'COURT',status:'CONFIRMED',priceKr:0}});bookings++;
   }
   return {members,bookings,skipped};
  },{timeout:60000,isolationLevel:'Serializable'});
  revalidatePath('/admin','layout');return {ok:`Importeret: ${result.members} nye medlemmer, ${result.bookings} bookinger. ${result.skipped} eksisterende rækker blev bevaret. Nye medlemmer bruger “Glemt adgangskode” for at vælge eget login. Kontingent og gamle betalinger er ikke importeret.`};
 }catch(e){return {error:e instanceof Error?e.message:'Importen kunne ikke gennemføres.'};}
}
