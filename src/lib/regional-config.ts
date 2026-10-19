import {regionalInternalHeaders} from './internal-auth';
import {deploymentRegion} from './region';
import type {Settings} from './settings';

export type RegionalSharedConfig={
  sharedSettings:Pick<Settings,'paymentProvider'|'stripeSecretKey'|'commissionPct'|'emailApiKey'|'emailFrom'|'ordersEmail'>;
  clubSignupPriceBook:unknown;
  agentConfig?:{
    enabled:boolean;
    fastModel:string;
    smartModel:string;
    apiKey:string;
  };
};

let cache:{at:number;value:RegionalSharedConfig|null}|null=null;
const TTL_MS=10_000;

const hostOf=(value:string|undefined)=>{try{return value?new URL(value.includes('://')?value:`https://${value}`).hostname.toLowerCase():null;}catch{return null;}};

/**
 * True when the settings origin names this deployment itself (its APP_URL,
 * US_APP_URL or CANONICAL_HOST). After the domain cutover racketbuddy.app
 * moved from EU to US, and a settings origin left on the apex made the US
 * service ask itself — silently losing the e-mail and Stripe keys.
 */
export function settingsOriginIsSelf(origin:string,env:Record<string,string|undefined>=process.env){
  const target=hostOf(origin);if(!target)return false;
  return [env.APP_URL,env.US_APP_URL,env.CANONICAL_HOST].map(hostOf).includes(target);
}

export async function regionalSharedConfig():Promise<RegionalSharedConfig|null>{
  if(deploymentRegion()!=='US')return null;
  const origin=process.env.REGIONAL_SETTINGS_ORIGIN;
  if(!origin||!process.env.REGION_INTERNAL_SECRET)return null;
  if(settingsOriginIsSelf(origin)){console.error(`REGIONAL_SETTINGS_ORIGIN (${origin}) points at this US deployment; set it to the EU service (e.g. https://eu.racketbuddy.app). E-mail and Stripe keys are unavailable until fixed.`);return null;}
  if(cache&&Date.now()-cache.at<TTL_MS)return cache.value;
  try{
    const url=new URL('/api/internal/regional-config',origin);
    const response=await fetch(url,{headers:regionalInternalHeaders(),cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error(`Regional config returned ${response.status}`);
    const value=await response.json() as RegionalSharedConfig;
    cache={at:Date.now(),value};
    return value;
  }catch(error){
    console.error('Could not load shared regional config:',error);
    cache={at:Date.now(),value:null};
    return null;
  }
}
