import {stripe} from './stripe';
import type {DataRegion} from './region';

function normalise(value:unknown):Exclude<DataRegion,'GLOBAL'>|null{
  const region=String(value??'').toUpperCase();
  return region==='US'||region==='EU'?region:null;
}

function objectRegion(object:any){
  return normalise(object?.metadata?.region)
    ??normalise(object?.subscription_details?.metadata?.region)
    ??normalise(object?.parent?.subscription_details?.metadata?.region)
    ??normalise(object?.payment_intent?.metadata?.region)
    ??null;
}

function id(value:any):string|null{return typeof value==='string'?value:typeof value?.id==='string'?value.id:null;}

/**
 * New RacketBuddy Stripe objects carry metadata.region. For event types where
 * Stripe does not copy metadata onto the emitted object, resolve the related
 * PaymentIntent/subscription/customer once. Legacy objects intentionally
 * return null and remain on the EU shard where they were created.
 */
export async function stripeEventRegion(object:any):Promise<'US'|'EU'|null>{
  const direct=objectRegion(object);if(direct)return direct;
  const client=await stripe().catch(()=>null);if(!client)return null;
  try{
    const paymentIntentId=id(object?.payment_intent);
    if(paymentIntentId){const pi=await client.paymentIntents.retrieve(paymentIntentId);const region=normalise(pi.metadata?.region);if(region)return region;}

    const subscriptionId=id(object?.subscription)
      ??id(object?.parent?.subscription_details?.subscription)
      ??id(object?.subscription_details?.subscription);
    if(subscriptionId){const sub=await client.subscriptions.retrieve(subscriptionId);const region=normalise(sub.metadata?.region);if(region)return region;}

    const customerId=id(object?.customer);
    if(customerId){const customer=await client.customers.retrieve(customerId);if(!customer.deleted){const region=normalise(customer.metadata?.region);if(region)return region;}}
  }catch(error){
    console.error('Could not resolve Stripe event region:',error);
  }
  return null;
}
