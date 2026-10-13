// Stripe remains a single external webhook endpoint. EU verifies Stripe's
// signature first; verified US events are then relayed over RacketBuddy's
// authenticated internal channel to the Virginia data shard.
import {db} from '../../../../lib/db';
import {stripe} from '../../../../lib/stripe';
import {getSettings} from '../../../../lib/settings';
import {InvalidStripeSignature,verifiedStripeEvent} from '../../../../lib/stripe-event';
import {handleStripeEvent} from '../../../../lib/stripe-webhook-handler';
import {stripeEventRegion} from '../../../../lib/stripe-event-region';
import {deploymentRegion,regionalShardingActive} from '../../../../lib/region';
import {regionalInternalHeaders} from '../../../../lib/internal-auth';

export const dynamic='force-dynamic';

async function relayToUS(payload:{eventId?:string;type:string;object:any;live:boolean}){
  const origin=process.env.US_INTERNAL_ORIGIN??process.env.US_APP_URL;
  if(!origin)throw Error('US internal origin is not configured.');
  const url=new URL('/api/internal/stripe-event',origin);
  const response=await fetch(url,{
    method:'POST',
    headers:regionalInternalHeaders(),
    body:JSON.stringify(payload),
    cache:'no-store',
    signal:AbortSignal.timeout(15_000),
  });
  if(!response.ok)throw Error(`US Stripe relay returned ${response.status}`);
}

export async function POST(req:Request){
  const signature=req.headers.get('stripe-signature');
  const secret=(await getSettings()).stripeWebhookSecret;
  if(!secret){console.error('Webhook-hemmeligheden er ikke sat — webhook afvist.');return new Response('Webhook er ikke konfigureret',{status:500});}
  if(!signature)return new Response('Mangler signatur',{status:400});

  const rawBody=await req.text();
  let type:string,object:any,eventId:string|undefined,live=false;
  try{
    const verified=await verifiedStripeEvent(await stripe(),rawBody,signature,secret);
    type=verified.type;object=verified.object;eventId=verified.id;live=verified.livemode===true;
  }catch(err){
    if(err instanceof InvalidStripeSignature)return new Response('Ugyldig signatur',{status:400});
    console.error('Stripe-webhook: verificeret event kunne ikke hentes.');
    return new Response('Kunne ikke hente event',{status:500});
  }
  if(!object)return new Response('Event uden indhold',{status:400});

  try{
    const target=await stripeEventRegion(object);
    const deployed=deploymentRegion();
    if(regionalShardingActive()&&deployed==='EU'&&target==='US'){
      await relayToUS({eventId,type,object,live});
    }else if(regionalShardingActive()&&target&&deployed!=='GLOBAL'&&target!==deployed){
      throw Error(`Stripe event belongs to ${target}, not ${deployed}.`);
    }else{
      // Legacy events have no region metadata and intentionally stay in EU,
      // where all pre-sharding records were created.
      await handleStripeEvent(type,object);
    }
  }catch(err){
    console.error(`Stripe-webhook fejlede ved håndtering af ${type}:`,err);
    return new Response('Intern fejl ved behandling',{status:500});
  }

  if(live&&eventId){
    const key='stripeLastVerifiedWebhookV1',value=JSON.stringify({eventId,type,receivedAt:new Date().toISOString()});
    try{await db.platformSetting.upsert({where:{key},create:{key,value},update:{value}});}catch{console.error('Kunne ikke gemme tidspunkt for verificeret Stripe-webhook.');}
  }
  return Response.json({received:true});
}
