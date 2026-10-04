import {db} from './db';
import {getCurrentUser} from './session';
import {stripe} from './stripe';

/** Only the signed-in club administrator can read their club's paid invoices. */
export async function clubInvoices(clubId:string) {
 const user=await getCurrentUser();
 if(user?.role!=='CLUB_ADMIN'||user.clubId!==clubId)throw Error('Ingen adgang.');
 const club=await db.club.findUniqueOrThrow({where:{id:clubId},select:{stripeCustomerId:true}});
 if(!club.stripeCustomerId)return {invoices:[],unavailable:false};
 try {
  const rows=await (await stripe()).invoices.list({customer:club.stripeCustomerId,status:'paid',limit:12},{timeout:10000,maxNetworkRetries:0});
  return {unavailable:false,invoices:rows.data.filter(invoice=>(typeof invoice.customer==='string'?invoice.customer:invoice.customer?.id)===club.stripeCustomerId&&invoice.status==='paid').map(invoice=>({
   id:invoice.id,number:invoice.number,created:invoice.created,amount:invoice.amount_paid,currency:invoice.currency.toUpperCase(),
   url:invoice.hosted_invoice_url,pdf:invoice.invoice_pdf,
  }))};
 } catch { return {invoices:[],unavailable:true}; }
}
