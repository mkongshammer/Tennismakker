'use server';
import {inspectWebhook} from './webhook-setup';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db} from './db';
import {getCurrentUser} from './session';
import {requireCustomClub} from './club-management-actions';
import {moneyOre,walletCredit} from './wallet-policy';
import {startWalletTopup} from './wallet';
export async function saveWallet(_prev:unknown,form:FormData):Promise<{ok?:string;error?:string}> {
 try {
  const {club}=await requireCustomClub();
  if(form.get('enabled')==='on'&&(await inspectWebhook()).status!=='ok')throw Error('Opdatér først Stripe-webhooken under superadmin → Platformindstillinger, så refunderinger og indsigelser kan modtages.');
  const tiers=[];
  for(let i=0;i<3;i++)if(String(form.get(`paid${i}`)??'').trim())tiers.push({paidOre:moneyOre(form.get(`paid${i}`)),creditOre:moneyOre(form.get(`credit${i}`))});
  walletCredit(1000,tiers);
  await db.club.update({where:{id:club.id},data:{walletEnabled:form.get('enabled')==='on',walletTiers:JSON.stringify(tiers)}});
  revalidatePath('/admin','layout');return {ok:'Wallet-indstillinger gemt.'};
 }catch(e){return {error:e instanceof Error?e.message:'Kunne ikke gemme.'};}
}
export async function depositWallet(_prev:unknown,form:FormData) {
 let url:string;
 try {const user=await getCurrentUser();if(!user?.clubId)throw Error('Log ind som medlem af klubben.');url=await startWalletTopup(user.id,user.clubId,moneyOre(form.get('amount')));}
 catch(e){return {error:e instanceof Error?e.message:'Betalingen kunne ikke åbnes.'};}
 redirect(url);
}
