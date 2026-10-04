import {clubInvoices} from '../lib/club-invoices';
import {formatDate,formatMoney} from '../lib/international';
import {phrase} from '../lib/phrases';
import type {Locale} from '../lib/sports';

export async function ClubInvoices({clubId,locale,timeZone}:{clubId:string;locale:Locale;timeZone:string}) {
 const result=await clubInvoices(clubId),tr=(text:string)=>phrase(text,locale);
 return <section className="card space-y-4"><h2 className="display text-xl">{tr('Fakturaer og kvitteringer')}</h2>
 {result.unavailable?<p role="status">{tr('Fakturaerne kunne ikke hentes. Prøv igen, eller åbn betalingsportalen.')}</p>:result.invoices.length?<ul className="divide-y divide-slate/15">{result.invoices.map(invoice=><li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{invoice.number??tr('Betalt faktura')}</p><p className="text-sm text-slate">{formatDate(new Date(invoice.created*1000),locale,timeZone,{day:'numeric',month:'long',year:'numeric'})} · {formatMoney(invoice.amount/100,invoice.currency,locale)}</p></div><div className="flex gap-4 text-sm font-semibold text-court">{invoice.url&&<a href={invoice.url} target="_blank" rel="noreferrer" className="underline">{tr('Se faktura')}</a>}{invoice.pdf&&<a href={invoice.pdf} target="_blank" rel="noreferrer" className="underline">PDF</a>}</div></li>)}</ul>:<p className="text-sm text-slate">{tr('Betalte abonnementsfakturaer vises her, når betalingen er registreret.')}</p>}
 </section>;
}
