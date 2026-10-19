import {internalRequestAuthorized} from '../../../../lib/internal-auth';
import {getSettings} from '../../../../lib/settings';
import {getAgentConfig} from '../../../../lib/agent-config';
import {db} from '../../../../lib/db';
import {DEFAULT_PRICE_BOOK,parsePriceBook,PRICE_BOOK_SETTING_KEY} from '../../../../lib/platform-pricing';

export const dynamic='force-dynamic';

export async function GET(req:Request){
  if(!internalRequestAuthorized(req))return new Response('Unauthorized',{status:401});
  const [settings,agents]=await Promise.all([getSettings(),getAgentConfig()]);
  const row=await db.platformSetting.findUnique({where:{key:PRICE_BOOK_SETTING_KEY}}).catch(()=>null);
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
    agentConfig:{
      enabled:agents.enabled,
      fastModel:agents.fastModel,
      smartModel:agents.smartModel,
      apiKey:agents.apiKey,
    },
    clubSignupPriceBook,
  },{headers:{'Cache-Control':'private, no-store'}});
}
