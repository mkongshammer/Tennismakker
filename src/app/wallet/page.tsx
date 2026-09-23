import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '../../lib/db';
import {getCurrentUser} from '../../lib/session';
import {stripe} from '../../lib/stripe';
import {confirmWalletTopup} from '../../lib/wallet';
import {DepositForm} from './DepositForm';
export const dynamic='force-dynamic';
export default async function WalletPage({searchParams}:{searchParams:Promise<{session?:string}>}) {
 const user=await getCurrentUser();if(!user)redirect('/login');
 const {session}=await searchParams;let notice='';
 if(session){const topup=await db.walletTopup.findFirst({where:{sessionId:session,userId:user.id}});if(topup){try{await confirmWalletTopup(await (await stripe()).checkout.sessions.retrieve(session));notice='Betalingsstatus er opdateret. En indbetaling vises først, når betalingen er bekræftet.';}catch{notice='Indbetalingen kunne ikke bekræftes endnu. Opdatér siden om lidt.';}}}
 const club=user.clubId?await db.club.findUnique({where:{id:user.clubId}}):null;
 const wallet=club?await db.clubWallet.findUnique({where:{userId_clubId:{userId:user.id,clubId:club.id}},include:{entries:{orderBy:{createdAt:'desc'},take:50}}}):null;
 return <div className="mx-auto max-w-2xl space-y-6"><h1 className="display text-3xl">Min klubwallet</h1><p>{club?.name??'Din profil er ikke tilknyttet en klub.'}</p><p className="text-3xl font-bold">{((wallet?.balanceOre??0)/100).toLocaleString('da-DK')} kr.</p>{notice&&<p>{notice}</p>}{wallet?.frozen?<p>Din wallet er sat på pause efter en betalingsændring. Kontakt klubben for afstemning.</p>:club?.walletEnabled&&club.solutionMode==='CUSTOM'?<DepositForm tiers={JSON.parse(club.walletTiers)}/>:<p>Klubben har ikke åbnet for nye indbetalinger.</p>}<section className="card"><h2 className="font-bold">Bevægelser</h2><ul className="divide-y">{wallet?.entries.map(e=><li key={e.id} className="flex justify-between gap-3 py-3"><span>{e.label}<small className="block">{e.createdAt.toLocaleDateString('da-DK')}</small></span><span>{(e.amountOre/100).toLocaleString('da-DK')} kr.</span></li>)}</ul></section><Link className="btn-ghost" href="/profil">Tilbage til profil</Link>{club&&<Link className="btn-court ml-2" href={`/klub/${club.slug}`}>Book bane</Link>}</div>;
}
