import {internalRequestAuthorized} from '../../../../lib/internal-auth';
import {deploymentRegion,regionalShardingActive} from '../../../../lib/region';
import {stripeEventRegion} from '../../../../lib/stripe-event-region';
import {handleStripeEvent} from '../../../../lib/stripe-webhook-handler';
import {db} from '../../../../lib/db';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  if(!internalRequestAuthorized(req))return new Response('Unauthorized',{status:401});
  if(deploymentRegion()!=='US'||!regionalShardingActive())return new Response('US shard is not active',{status:503});
  const payload=await req.json().catch(()=>null) as {eventId?:string;type?:string;object?:any;live?:boolean}|null;
  if(!payload?.type||!payload.object)return new Response('Invalid event',{status:400});

  const target=await stripeEventRegion(payload.object);
  if(target!=='US')return new Response('Event is not tagged for the US shard',{status:409});

  const key=payload.eventId?`regionalStripeEvent:${payload.eventId}`:null;
  if(key&&await db.platformSetting.findUnique({where:{key}}))return Response.json({received:true,duplicate:true});

  try{await handleStripeEvent(payload.type,payload.object);}catch(error){
    console.error('US regional Stripe event failed:',error);
    return new Response('Regional event failed',{status:500});
  }

  if(key){
    const value=JSON.stringify({type:payload.type,live:payload.live===true,processedAt:new Date().toISOString()});
    await db.platformSetting.upsert({where:{key},create:{key,value},update:{value}});
  }
  if(payload.live&&payload.eventId){
    const evidenceKey='stripeLastRelayedWebhookV1',value=JSON.stringify({eventId:payload.eventId,type:payload.type,receivedAt:new Date().toISOString()});
    await db.platformSetting.upsert({where:{key:evidenceKey},create:{key:evidenceKey,value},update:{value}});
  }
  return Response.json({received:true});
}
