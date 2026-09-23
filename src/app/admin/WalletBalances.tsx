import {db} from '../../lib/db';
export async function WalletBalances({clubId}:{clubId:string}) {
 const rows=await db.clubWallet.findMany({where:{clubId},orderBy:{balanceOre:'desc'},take:200});
 const users=await db.user.findMany({where:{id:{in:rows.map(r=>r.userId)}},select:{id:true,name:true}});
 return <section className="card"><h2 className="display text-2xl">Medlemmernes bookingkredit</h2><p className="mt-2 text-sm text-slate">Kreditten er et tilgodehavende til banebooking. Den indeholder eventuel bonus og er ikke det samme som indbetalt kontantbeløb. Viser op til 200 wallets.</p><ul className="mt-4 divide-y">{rows.map(r=><li key={r.id} className="flex justify-between gap-3 py-3"><span>{users.find(u=>u.id===r.userId)?.name??'Medlem'}{r.frozen?' · Afventer betalingsafstemning':''}</span><span>{(r.balanceOre/100).toLocaleString('da-DK')} kr.</span></li>)}</ul>{!rows.length&&<p className="mt-4 text-slate">Ingen indbetalinger endnu.</p>}</section>;
}
