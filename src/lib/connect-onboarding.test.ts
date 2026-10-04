import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadIsolatedModule} from './testing/isolated-module';
test('club payout setup lets Stripe collect the actual legal form and retries use one account key',async()=>{
 const calls:any[]=[];
 const {ensureConnectAccount}=loadIsolatedModule('src/lib/connect.ts',{
  './settings':{},'./db':{db:{club:{findUnique:async()=>({id:'club-1',name:'Commercial Padel',country:'US',members:[],stripeAccountId:null}),update:async()=>{}}}},
  './stripe':{stripe:async()=>({accounts:{create:async(params:any,options:any)=>{calls.push({params,options});return{id:'acct_test'};}}})},
 });
 await ensureConnectAccount('CLUB','club-1');await ensureConnectAccount('CLUB','club-1');
 assert.equal(calls[0].params.country,'US');assert.equal('business_type' in calls[0].params,false);assert.equal(calls[0].options.idempotencyKey,calls[1].options.idempotencyKey);
});
