import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {db} from '../../lib/db';
import {createSession} from '../../lib/session';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const ticket=new URL(req.url).searchParams.get('ticket')??'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(ticket))return new Response('Ugyldig adgang.',{status:401});
 const hash=crypto.createHash('sha256').update(ticket).digest('hex');
 const handoff=await db.$transaction(async tx=>{
  const row=await tx.appHandoff.findUnique({where:{hash}});if(!row||row.expiresAt<=new Date())return null;
  const claim=await tx.appHandoff.deleteMany({where:{hash,expiresAt:{gt:new Date()}}});return claim.count?row:null;
 });
 if(!handoff)return new Response('Adgangen er udløbet. Åbn siden igen fra appen.',{status:401,headers:{'Cache-Control':'no-store'}});
 const user=await db.user.findUnique({where:{id:handoff.userId}});
 if(!user||(handoff.destination==='/admin'&&(user.role!=='CLUB_ADMIN'||!user.clubId)))return new Response('Ingen adgang.',{status:403});
 await createSession(user.id);
 const response=NextResponse.redirect(new URL(handoff.destination,req.url));
 response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
