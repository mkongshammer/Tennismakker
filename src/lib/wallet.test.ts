import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadIsolatedModule} from './testing/isolated-module';
import * as policy from './wallet-policy';
function setup(balance=10000){
 let state:any={balance,bookings:{a:{id:'a',userId:'u',kind:'COURT',status:'HOLD',priceKr:100,holdExpiresAt:new Date(Date.now()+60000),court:{clubId:'c'},checkoutParams:null,startsAt:new Date(Date.now()+48*3600000)},b:{id:'b',userId:'u',kind:'COURT',status:'HOLD',priceKr:100,holdExpiresAt:new Date(Date.now()+60000),court:{clubId:'c'},checkoutParams:null,startsAt:new Date(Date.now()+48*3600000)}},entries:[],payments:[],topupStatus:'PENDING'};
 let queue=Promise.resolve(),failLedger=false;
 const tx:any={
  booking:{findUnique:async({where}:any)=>structuredClone(state.bookings[where.id]),updateMany:async({where,data}:any)=>{const b=state.bookings[where.id];if(b.status!==where.status)return{count:0};Object.assign(b,data);return{count:1};}},
  user:{findUnique:async()=>({clubId:'c'})},
  clubWallet:{findUnique:async()=>({id:'w',balanceOre:state.balance,frozen:false}),updateMany:async({where,data}:any)=>{if(state.balance<where.balanceOre.gte)return{count:0};state.balance-=data.balanceOre.decrement;return{count:1};},update:async({data}:any)=>{state.balance+=data.balanceOre.increment;return{id:'w'};},upsert:async({update}:any)=>{state.balance+=update.balanceOre.increment;return{id:'w'};}},
  walletEntry:{create:async({data}:any)=>{if(failLedger)throw Error('ledger unavailable');state.entries.push(data);}},payment:{create:async({data}:any)=>state.payments.push(data),updateMany:async()=>({count:1})},
  walletTopup:{updateMany:async({where,data}:any)=>{if(state.topupStatus!==where.status)return{count:0};state.topupStatus=data.status;return{count:1};}},
 };
 const db:any={...tx,walletTopup:{findUnique:async()=>({id:'t',userId:'u',clubId:'c',paidOre:180000,creditOre:200000,destination:'acct_club',sessionId:'cs_test'})},$transaction:async(fn:any)=>{const previous=queue;let release:any;queue=new Promise(r=>release=r);await previous;const backup=structuredClone(state);try{return await fn(tx);}catch(e){state=backup;throw e;}finally{release();}}};
 const intent:any={status:'succeeded',amount_received:180000,currency:'dkk',transfer_data:{destination:'acct_club'},metadata:{walletTopupId:'t'},latest_charge:{refunded:false,amount_refunded:0,disputed:false}};
 const api=loadIsolatedModule('src/lib/wallet.ts',{'./db':{db},'./billing':{},'./stripe':{stripe:async()=>({paymentIntents:{retrieve:async()=>intent}})},'./settings':{},'./memberships':{},'./wallet-policy':policy});
 return{api,state:()=>state,intent,fail:()=>{failLedger=true;}};
}
test('two bookings cannot spend the same last wallet balance',async()=>{
 const f=setup();const result=await Promise.allSettled([f.api.payBookingWithWallet('u','a'),f.api.payBookingWithWallet('u','b')]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.state().balance,0);assert.equal(f.state().entries.length,1);
});
test('ledger failure rolls back debit and booking confirmation',async()=>{
 const f=setup();f.fail();await assert.rejects(f.api.payBookingWithWallet('u','a'));assert.equal(f.state().balance,10000);assert.equal(f.state().bookings.a.status,'HOLD');
});
test('wallet ownership and existing card checkout are checked',async()=>{
 const f=setup();await assert.rejects(f.api.payBookingWithWallet('other','a'));f.state().bookings.a.checkoutParams='prepared';await assert.rejects(f.api.payBookingWithWallet('u','a'));assert.equal(f.state().balance,10000);
});
test('timely cancellation returns credit exactly once; late cancellation does not',async()=>{
 const f=setup();await f.api.payBookingWithWallet('u','a');await Promise.all([f.api.cancelWalletBooking('u','a'),f.api.cancelWalletBooking('u','a')]);assert.equal(f.state().balance,10000);assert.equal(f.state().entries.length,2);
 const late=setup();late.state().bookings.a.startsAt=new Date(Date.now()+3600000);await late.api.payBookingWithWallet('u','a');await late.api.cancelWalletBooking('u','a');assert.equal(late.state().balance,0);
});
test('topup requires exact paid evidence and webhook replay credits only once',async()=>{
 const f=setup(0);const s:any={id:'cs_test',mode:'payment',payment_status:'paid',currency:'dkk',amount_total:180000,client_reference_id:'t',metadata:{walletTopupId:'t'},payment_intent:'pi_test'};
 await assert.rejects(f.api.confirmWalletTopup({...s,amount_total:1}));assert.equal(f.state().balance,0);
 await f.api.confirmWalletTopup({...s,payment_status:'unpaid'});assert.equal(f.state().balance,0);
 await Promise.all([f.api.confirmWalletTopup(s),f.api.confirmWalletTopup(s)]);assert.equal(f.state().balance,200000);assert.equal(f.state().entries.length,1);
});
