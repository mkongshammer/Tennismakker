import { headers } from 'next/headers';
import { marketFor } from './international';
import { lookupIpCountry, visitorIp } from './ip-country';
export type CountryDetection = {country:string|null;suggestedCountry:string|null;needsChoice:boolean;source:'ip'|'edge'|'unknown'|'conflict'|'unsupported'};
const COUNTRY_HEADERS = ['cf-ipcountry','x-vercel-ip-country','cloudfront-viewer-country','x-geo-country'];
/** Browser language is a dialog suggestion, never proof of location. */
export function countryFromLanguage(value:string|null):string|null {
 const tag=value?.split(',')[0]?.split(';')[0]?.trim()??'';
 const region=tag.split('-').slice(1).find(part=>/^[A-Z]{2}$/i.test(part));
 if(marketFor(region))return region!.toUpperCase();
 return ({da:'DK',de:'DE',sv:'SE',no:'NO',nb:'NO',nn:'NO',fr:'FR',es:'ES'} as Record<string,string>)[tag.toLowerCase().split('-')[0]]??null;
}
/** Discovery only: never use country hints for access, taxes or payment eligibility. */
export function detectCountryFromHeaders(h:Pick<Headers,'get'>,lookup=lookupIpCountry):CountryDetection {
 const edge=COUNTRY_HEADERS.map(name=>h.get(name)?.trim().toUpperCase()).filter((v):v is string=>Boolean(v&&/^[A-Z]{2}$/.test(v)));
 const ip=visitorIp(h),fromIp=ip?lookup(ip):null;
 const candidates=[...new Set([...edge.filter(v=>!['XX','T1'].includes(v)),...(fromIp?[fromIp]:[])])];
 const guessed=candidates.find(code=>marketFor(code))??countryFromLanguage(h.get('accept-language'));
 if(edge.some(v=>['XX','T1'].includes(v))||candidates.length>1)return {country:null,suggestedCountry:guessed,needsChoice:true,source:'conflict'};
 const country=candidates[0];
 if(country&&marketFor(country))return {country,suggestedCountry:country,needsChoice:false,source:edge.length?'edge':'ip'};
 return {country:null,suggestedCountry:guessed,needsChoice:true,source:country?'unsupported':'unknown'};
}
export async function detectCountry():Promise<CountryDetection>{return detectCountryFromHeaders(await headers());}
