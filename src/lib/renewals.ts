// Automatisk fornyelse af kontingent.
import { db } from "./db";
import { stripe } from "./stripe";
import { getSettings } from "./settings";
import { sendMail, renewalNotice, renewalFailed } from "./email";
import { confirmMembership } from "./memberships";
import { dataRegionForCountry } from "./region";

export const NOTICE_DAYS = 14;

export async function startCardSetup(userId:string,returnPath:string):Promise<string>{
  const user=await db.user.findUnique({where:{id:userId}});if(!user)throw new Error("Brugeren findes ikke.");
  const s=await stripe();let customerId=user.stripeCustomerId;const region=dataRegionForCountry(user.country);
  if(!customerId){const customer=await s.customers.create({email:user.email,name:user.name,metadata:{userId,region}});customerId=customer.id;await db.user.update({where:{id:userId},data:{stripeCustomerId:customerId}});}
  const settings=await getSettings();
  const session=await s.checkout.sessions.create({mode:"setup",customer:customerId,metadata:{userId,region},success_url:`${settings.appUrl}${returnPath}?kort=gemt`,cancel_url:`${settings.appUrl}${returnPath}`});
  if(!session.url)throw new Error("Stripe returnerede ingen side.");return session.url;
}

export async function hasSavedCard(userId:string):Promise<boolean>{
  const user=await db.user.findUnique({where:{id:userId},select:{stripeCustomerId:true}});if(!user?.stripeCustomerId)return false;
  const methods=await (await stripe()).paymentMethods.list({customer:user.stripeCustomerId,type:"card",limit:1});return methods.data.length>0;
}

export type RenewalRun={notified:number;charged:number;failed:number};

export async function runRenewals():Promise<RenewalRun>{
  const out:RenewalRun={notified:0,charged:0,failed:0};
  const upcoming=await db.membershipType.findMany({where:{renewsFromId:{not:null},active:true,fromDate:{gte:new Date()}},include:{club:{select:{name:true,slug:true,currency:true,country:true,stripeAccountId:true}}}});
  for(const type of upcoming){
    const previous=await db.membership.findMany({where:{typeId:type.renewsFromId!,status:"PAID",autoRenew:true},include:{user:true}});
    const startsInDays=Math.round((type.fromDate.getTime()-Date.now())/86_400_000);
    for(const old of previous){
      const already=await db.membership.findUnique({where:{typeId_userId:{typeId:type.id,userId:old.userId}}});
      if(already?.status==="PAID")continue;
      if(startsInDays>1&&startsInDays<=NOTICE_DAYS&&!already){
        await db.membership.create({data:{typeId:type.id,userId:old.userId,priceKr:type.priceKr,currency:type.club.currency,status:"PENDING",autoRenew:true}});
        await sendMail(renewalNotice({to:old.user.email,name:old.user.name,clubName:type.club.name,typeName:type.name,seasonName:type.seasonName,priceKr:type.priceKr,currency:type.club.currency,chargeDate:type.fromDate,clubSlug:type.club.slug})).catch(err=>console.error("Fornyelsesbesked fejlede:",err));
        out.notified++;continue;
      }
      if(startsInDays<=1&&already?.status==="PENDING"){
        const ok=await chargeRenewal(already.id,type.club.stripeAccountId??null);if(ok)out.charged++;else out.failed++;
      }
    }
  }
  return out;
}

async function chargeRenewal(membershipId:string,destination:string|null):Promise<boolean>{
  const membership=await db.membership.findUnique({where:{id:membershipId},include:{user:true,type:{include:{club:{select:{name:true,slug:true,currency:true,country:true,stripeAccountId:true}}}}}});if(!membership)return false;
  const customerId=membership.user.stripeCustomerId,account=destination??membership.type.club.stripeAccountId;
  if(!customerId||!account){await notifyFailure(membership,"Der er ikke gemt et kort.");return false;}
  try{
    const s=await stripe();const methods=await s.paymentMethods.list({customer:customerId,type:"card",limit:1});const method=methods.data[0];
    if(!method){await notifyFailure(membership,"Det gemte kort findes ikke længere.");return false;}
    const region=dataRegionForCountry(membership.type.club.country);
    await s.paymentIntents.create({amount:membership.priceKr*100,currency:membership.currency.toLowerCase(),customer:customerId,payment_method:method.id,off_session:true,confirm:true,transfer_data:{destination:account},metadata:{membershipId,region}});
    await confirmMembership(membershipId);return true;
  }catch(err){await notifyFailure(membership,err instanceof Error?err.message:"Betalingen blev afvist.");return false;}
}

async function notifyFailure(membership:any,reason:string){
  await sendMail(renewalFailed({locale:membership.user.locale,to:membership.user.email,name:membership.user.name,clubName:membership.type.club.name,seasonName:membership.type.seasonName,reason,clubSlug:membership.type.club.slug})).catch(err=>console.error("Kunne ikke sende besked om fejlet fornyelse:",err));
}

export async function setAutoRenew(userId:string,membershipId:string,on:boolean):Promise<void>{
  await db.membership.updateMany({where:{id:membershipId,userId},data:{autoRenew:on}});
}
