import crypto from 'node:crypto';

function equalSecret(a:string,b:string){
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}

export function internalRequestAuthorized(req:Request):boolean{
  const configured=process.env.REGION_INTERNAL_SECRET;
  if(!configured||configured.length<32)return false;
  const auth=req.headers.get('authorization')??'';
  const token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';
  return Boolean(token)&&equalSecret(token,configured);
}

export function regionalInternalHeaders(){
  const secret=process.env.REGION_INTERNAL_SECRET;
  if(!secret)throw Error('REGION_INTERNAL_SECRET is not configured.');
  return {Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
}
