import { detectCountryFromHeaders } from '../../../../lib/geo';
import { json, preflight, requireUser, publicUser, requireRegionalCountry } from '../../../../lib/api/helpers';
import {marketFor,validLocale} from '../../../../lib/international';
import {dataRegionForCountry, regionalShardingActive} from '../../../../lib/region';
import {db} from '../../../../lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function OPTIONS() { return preflight(); }
export async function GET(req: Request) {
  const response = json(detectCountryFromHeaders(req.headers));
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
/** Change discovery preferences without silently moving an account between data regions. */
export async function POST(req:Request){
 const auth=await requireUser(req);if('response' in auth)return auth.response;
 const body=await req.json().catch(()=>({})),country=String(body.country??'').toUpperCase(),locale=String(body.locale??'');
 if(!marketFor(country)||!validLocale(locale))return json({error:'Choose a valid country and language.'},400);
 const regionError=requireRegionalCountry(country);if(regionError)return regionError;
 if(regionalShardingActive()&&dataRegionForCountry(country)!==dataRegionForCountry(auth.user.country)){
   return json({error:'Changing between US and EU data regions requires an account migration.',code:'REGION_MIGRATION_REQUIRED'},409);
 }
 const user=await db.user.update({where:{id:auth.user.id},data:{country,locale,countryChosen:true,...(country!==auth.user.country?{area:null}:{})},include:{coachProfile:true}});
 return json({user:publicUser(user)});
}
