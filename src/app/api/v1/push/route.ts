import { json, apiError, preflight, requireUser } from '../../../../lib/api/helpers';
import { db } from '../../../../lib/db';
import { PUSH_CATEGORIES, validExpoToken } from '../../../../lib/push-policy';
export const dynamic = 'force-dynamic';
export async function OPTIONS() { return preflight(); }
export async function GET(req: Request) {
  const auth = await requireUser(req); if ('response' in auth) return auth.response;
  const preferences = await db.pushPreference.findUnique({where:{userId:auth.user.id}});
  return json({preferences: Object.fromEntries(PUSH_CATEGORIES.map(k=>[k,preferences?.[k]??true]))});
}
export async function POST(req: Request) {
  const auth = await requireUser(req); if ('response' in auth) return auth.response;
  const body = await req.json().catch(()=>null);
  if (!body || typeof body !== 'object') return apiError('Ugyldig forespørgsel.');
  const userId=auth.user.id;
  if (body.preferences) {
    if (PUSH_CATEGORIES.some(k=>typeof body.preferences[k]!=='boolean')) return apiError('Vælg notifikationer til eller fra.');
    const data=Object.fromEntries(PUSH_CATEGORIES.map(k=>[k,body.preferences[k]]));
    await db.pushPreference.upsert({where:{userId},create:{userId,...data},update:data});
    return json({ok:true});
  }
  if(!validExpoToken(body.token) || !['ios','android'].includes(body.platform)) return apiError('Ugyldig enhed.');
  // Never outlive the authenticated session, including refreshes on app resume.
  const token=(req.headers.get('authorization')??'').slice(7).trim();
  const exp=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).exp;
  const expiresAt=new Date(Math.min(exp*1000,Date.now()+30*86400000));
  await db.$transaction(async tx=>{
    await tx.pushPreference.upsert({where:{userId},create:{userId},update:{}});
    const existing=await tx.pushDevice.findUnique({where:{token:body.token}});
    if(existing?.userId===userId) await tx.pushDevice.update({where:{id:existing.id},data:{expiresAt}});
    else {
      // New row on ownership change also drops all pending notifications/receipts.
      if(existing) await tx.pushDevice.delete({where:{id:existing.id}});
      await tx.pushDevice.create({data:{userId,token:body.token,platform:body.platform,expiresAt}});
    }
  });
  return json({ok:true});
}
export async function DELETE(req: Request) {
  const auth = await requireUser(req); if ('response' in auth) return auth.response;
  const body=await req.json().catch(()=>null);
  if(!validExpoToken(body?.token))return apiError('Ugyldig enhed.');
  await db.pushDevice.deleteMany({where:{userId:auth.user.id,token:body.token}});
  return json({ok:true});
}
