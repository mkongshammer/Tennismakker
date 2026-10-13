import {internalRequestAuthorized} from '../../../../lib/internal-auth';
import {getSettings} from '../../../../lib/settings';
import {db} from '../../../../lib/db';
import {DEFAULT_PRICE_BOOK,parsePriceBook} from '../../../../lib/platform-pricing';

export const dynamic='force-dynamic';

export async function GET(req:Request){
  if(!internalRequestAuthorized(req))return new Response('Unauthorized',{status:401});
  const settings=await getSettings();
  const row=await db.platformSetting.findUnique({where:{key:'clubSignupPricesV3'}}).catch(()=>null);
  const clubSignupPriceBook=row?parsePriceBook(row.value):DEFAULT_PRICE_BOOK;
  return Response.json({
    sharedSettings:{
      paymentProvider:settings.paymentProvider,
      stripeSecretKey:settings.stripeSecretKey,
      commissionPct:settings.commissionPct,
      emailApiKey:settings.emailApiKey,
      emailFrom:settings.emailFrom,
      ordersEmail:settings.ordersEmail,
    },
    clubSignupPriceBook,
  },{headers:{'Cache-Control':'private, no-store'}});
}
