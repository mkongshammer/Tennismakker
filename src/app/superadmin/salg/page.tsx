import {redirect} from 'next/navigation';
import {getCurrentUser} from '../../../lib/session';
import {salesReadiness} from '../../../lib/sales-readiness';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await getCurrentUser();if(user?.role!=='SUPERADMIN')redirect('/login');
 const checks=await salesReadiness();
 return <div className="max-w-3xl mx-auto space-y-5"><h1 className="display text-3xl">International salgsstatus</h1><p>Kontrol af priser og betalingsopsætning. Ingen betalinger oprettes og ingen mails sendes. Klubber og trænere skal desuden færdiggøre deres egne udbetalingskonti.</p>{checks.map(c=><section className="card space-y-2" key={c.name}><h2 className="font-bold">{c.ok?'✓':'!'} {c.name}</h2><p>{c.detail}</p></section>)}</div>;
}
