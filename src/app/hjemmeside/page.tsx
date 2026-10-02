import {OrderForm} from './OrderForm';
import {getPreferences} from '../../lib/preferences';
import {phrase} from '../../lib/phrases';
import {formatMoney} from '../../lib/international';
import {websitePrice} from '../../lib/platform-pricing';
export const dynamic='force-dynamic';
export default async function Page(){
 const {country,locale}=await getPreferences(),tr=(s:string)=>phrase(s,locale),price=websitePrice(country);
 return <div className="max-w-4xl mx-auto space-y-10"><section className="rounded-2xl bg-ink p-8 sm:p-12 text-chalk"><p className="eyebrow">{tr('Hjemmeside til klubben')}</p><h1 className="display text-4xl mt-3">{tr('Jeres klub. Jeres egen hjemmeside.')}</h1><p className="mt-4">{tr('Vi bygger hjemmesiden med jeres farver, indhold, booking og betaling på jeres eget domæne.')}</p><p className="display text-4xl mt-8">{formatMoney(price.amount,price.currency,locale)}</p><p className="mt-2">{tr('Engangspris for opsætning. Jeres klubabonnement fortsætter separat.')}</p><p className="mt-3 text-sm">{tr('Klubpriser er ekskl. eventuel moms eller sales tax. Det samlede beløb vises før betaling.')}</p></section><section className="card"><h2 className="display text-2xl">{tr('Det får I')}</h2><ul className="mt-4 space-y-3">{['Eget domæne og klubdesign','Banebooking og betaling','Nyheder, kontakt og praktisk information','Tilpasset mobil, tablet og computer'].map(s=><li key={s}>✓ {tr(s)}</li>)}</ul><p className="mt-5 text-slate">{tr('Send os logo, tekster, banepriser og adgang til domænet. I godkender et udkast, før vi opkræver betaling.')}</p></section><section><h2 className="display text-2xl mb-4">{tr('Få et uforpligtende oplæg')}</h2><OrderForm locale={locale} country={country}/></section></div>;
}
