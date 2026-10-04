import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadIsolatedModule} from './testing/isolated-module';

function fixture(user:any={role:'CLUB_ADMIN',clubId:'club-own'},fail=false){
 let calls=0;
 const {clubInvoices}=loadIsolatedModule('src/lib/club-invoices.ts',{
  './session':{getCurrentUser:async()=>user},
  './db':{db:{club:{findUniqueOrThrow:async()=>({stripeCustomerId:'cus_own'})}}},
  './stripe':{stripe:async()=>({invoices:{list:async({customer,status}:any)=>{calls++;assert.equal(customer,'cus_own');assert.equal(status,'paid');if(fail)throw Error('Unavailable');return{data:[
   {id:'own',number:'INV-1',customer:'cus_own',status:'paid',created:1,amount_paid:3375,currency:'eur',hosted_invoice_url:'https://invoice.stripe.com/own',invoice_pdf:'https://pay.stripe.com/own.pdf'},
   {id:'foreign',customer:'cus_other',status:'paid',currency:'usd'},
   {id:'unpaid',customer:'cus_own',status:'open',currency:'eur'},
  ]};}}})},
 });return {clubInvoices,calls:()=>calls};
}
test('paid invoices preserve tax-inclusive amount and currency and exclude other customers',async()=>{const f=fixture();const r=await f.clubInvoices('club-own');assert.equal(r.unavailable,false);assert.equal(r.invoices.length,1);assert.equal(r.invoices[0].amount,3375);assert.equal(r.invoices[0].currency,'EUR');});
test('anonymous users and another club cannot access invoice data',async()=>{for(const user of [null,{role:'PLAYER',clubId:'club-own'},{role:'CLUB_ADMIN',clubId:'other'}]){const f=fixture(user);await assert.rejects(f.clubInvoices('club-own'),/adgang/);assert.equal(f.calls(),0);}});
test('invoice provider failure is shown as unavailable, not as no payments',async()=>{assert.deepEqual(await fixture(undefined,true).clubInvoices('club-own'),{invoices:[],unavailable:true});});
