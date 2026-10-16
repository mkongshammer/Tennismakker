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

export async function regionalSharedConfig():Promise<RegionalSharedConfig|null>{
  if(deploymentRegion()!=='US')return null;
  const origin=process.env.REGIONAL_SETTINGS_ORIGIN;
  if(!origin||!process.env.REGION_INTERNAL_SECRET)return null;
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
