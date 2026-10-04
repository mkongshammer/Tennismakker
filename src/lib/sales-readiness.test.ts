import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadIsolatedModule} from './testing/isolated-module';

test('configuration is never mistaken for verified tax registration, email delivery or a paid club purchase',async()=>{
 const client={accounts:{retrieve:async()=>({country:'US',charges_enabled:true,payouts_enabled:true})},tax:{settings:{retrieve:async()=>({status:'active'})},registrations:{list:async()=>({data:[]})}},billingPortal:{configurations:{list:async()=>({data:[{features:{subscription_cancel:{enabled:true},payment_method_update:{enabled:true},invoice_history:{enabled:true}}}]})}}};
 const {salesReadiness}=loadIsolatedModule('src/lib/sales-readiness.ts',{
  './db':{db:{club:{count:async()=>0,findMany:async()=>[],findFirst:async()=>null},coachProfile:{count:async()=>0},platformSetting:{findUnique:async()=>null}}},
  './stripe':{stripe:async()=>client},'./settings':{getSettings:async()=>({paymentProvider:'stripe',stripeSecretKey:'sk_live_offline',emailApiKey:'offline',emailFrom:'receipts@example.invalid'})},
  './webhook-setup':{inspectWebhook:async()=>({status:'ok'})},'./club-onboarding':{clubSignupPriceBook:async()=>({EUR:{standard:27,custom:1999},USD:{standard:30,custom:2249}})},
 });
 const result=await salesReadiness(),status=(id:string)=>result.find((c:any)=>c.id===id)?.status;
 assert.equal(status('stripe'),'verified');assert.equal(status('tax'),'owner');assert.equal(status('webhook'),'test');assert.equal(status('purchase'),'test');assert.equal(status('mail'),'configured');assert.equal(status('portal'),'configured');
});
