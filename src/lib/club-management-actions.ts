'use server';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { getCurrentUser } from './session';
export async function requireCustomClub() {
  const user=await getCurrentUser();
  if(user?.role!=='CLUB_ADMIN' || !user.clubId) throw Error('Kun klubbens administrator har adgang.');
  const club=await db.club.findUnique({where:{id:user.clubId}});
  if(club?.solutionMode!=='CUSTOM')throw Error('Denne funktion kræver en custom-klubløsning.');
  return {user,club};
}
export async function setClubSolution(form:FormData) {
  const user=await getCurrentUser();if(user?.role!=='SUPERADMIN')throw Error('Ingen adgang.');
  const mode=String(form.get('solutionMode'));
  if(!['STANDARD','CUSTOM'].includes(mode))throw Error('Ugyldig løsning.');
  await db.club.update({where:{id:String(form.get('clubId'))},data:{solutionMode:mode}});
  revalidatePath('/admin','layout');revalidatePath('/superadmin','layout');
}
export async function addClubMember(_prev:unknown,form:FormData):Promise<{ok?:string;error?:string;password?:string;email?:string}> {
  try {
    const {club}=await requireCustomClub();
    const email=String(form.get('email')??'').trim().toLowerCase(),name=String(form.get('name')??'').trim(),phone=String(form.get('phone')??'').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length<2||name.length>150||phone.length>40)throw Error('Udfyld et gyldigt navn, e-mail og telefonnummer.');
    const typeId=String(form.get('typeId')??'');
    const type=typeId?await db.membershipType.findFirst({where:{id:typeId,clubId:club.id}}):null;
    if(typeId&&!type)throw Error('Kontingentet tilhører ikke klubben.');
    const password=crypto.randomBytes(15).toString('base64url');
    const passwordHash=await bcrypt.hash(password,12);
    const result=await db.$transaction(async tx=>{
      let member=await tx.user.findUnique({where:{email}});const created=!member;
      if(member && (member.role!=='PLAYER'||(member.clubId&&member.clubId!==club.id)))throw Error('Kontoen er knyttet til en anden klub eller administratorrolle. Bed personen kontakte RacketBuddy.');
      if(!member)member=await tx.user.create({data:{email,name,phone:phone||null,passwordHash,clubId:club.id}});
      else await tx.user.update({where:{id:member.id},data:{clubId:club.id}});
      if(type)await tx.membership.upsert({where:{typeId_userId:{typeId:type.id,userId:member.id}},create:{typeId:type.id,userId:member.id,priceKr:type.priceKr,status:'PENDING'},update:{}});
      return {created};
    });
    revalidatePath('/admin','layout');
    return {ok:'Medlemmet er tilføjet. Et valgt kontingent afventer betaling. Der er ikke sendt mail.',...(result.created?{password,email}:{})};
  }catch(e){return {error:e instanceof Error?e.message:'Kunne ikke tilføje medlemmet.'};}
}
