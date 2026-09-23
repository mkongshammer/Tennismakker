import crypto from 'node:crypto';
import {db} from '../../../../lib/db';
import {json,apiError,preflight,requireUser} from '../../../../lib/api/helpers';
export async function OPTIONS(){return preflight();}
export async function POST(req:Request){
 const auth=await requireUser(req);if('response' in auth)return auth.response;
 const body=await req.json().catch(()=>({}));
 const destination=body.destination==='/wallet'?'/wallet':'/admin';
 if(destination==='/admin'&&(auth.user.role!=='CLUB_ADMIN'||!auth.user.clubId))return apiError('Kun klubadministratorer har adgang.',403);
 const ticket=crypto.randomBytes(32).toString('base64url');
 await db.appHandoff.deleteMany({where:{OR:[{expiresAt:{lt:new Date()}},{userId:auth.user.id,destination}]}});
 await db.appHandoff.create({data:{hash:crypto.createHash('sha256').update(ticket).digest('hex'),userId:auth.user.id,destination,expiresAt:new Date(Date.now()+60000)}});
 return json({path:`/app-session?ticket=${encodeURIComponent(ticket)}`});
}
