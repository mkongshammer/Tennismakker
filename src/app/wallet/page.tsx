import { getPreferences } from '../../lib/preferences';
import { formatMoney, formatDate } from '../../lib/international';
import { phrase } from '../../lib/phrases';
import { InternationalProvider } from '../../components/InternationalProvider';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { getCurrentUser } from '../../lib/session';
import { stripe } from '../../lib/stripe';
import { confirmWalletTopup } from '../../lib/wallet';
import { DepositForm } from './DepositForm';
export const dynamic = 'force-dynamic';
export default async function WalletPage({ searchParams }: {searchParams: Promise<{session?: string;}>;}) {
  const prefs = await getPreferences(),tr = (text: string) => phrase(text, prefs.locale);
  const user = await getCurrentUser();if (!user) redirect('/login');
  const { session } = await searchParams;let notice = '';
  if (session) {const topup = await db.walletTopup.findFirst({ where: { sessionId: session, userId: user.id } });if (topup) {try {await confirmWalletTopup(await (await stripe()).checkout.sessions.retrieve(session));notice = 'Betalingsstatus er opdateret. En indbetaling vises først, når betalingen er bekræftet.';} catch {notice = 'Indbetalingen kunne ikke bekræftes endnu. Opdatér siden om lidt.';}}}
  const club = user.clubId ? await db.club.findUnique({ where: { id: user.clubId } }) : null;
  const wallet = club ? await db.clubWallet.findUnique({ where: { userId_clubId: { userId: user.id, clubId: club.id } }, include: { entries: { orderBy: { createdAt: 'desc' }, take: 50 } } }) : null;
  const currency = wallet?.currency ?? club?.currency ?? "DKK",money = (n: number) => formatMoney(n, currency, prefs.locale);
  return <InternationalProvider locale={prefs.locale} currency={currency} timeZone={club?.timeZone}><div className="mx-auto max-w-2xl space-y-6"><h1 className="display text-3xl">{tr("Min klubwallet")}</h1><p>{club?.name ?? 'Din profil er ikke tilknyttet en klub.'}</p><p className="text-3xl font-bold">{money((wallet?.balanceOre ?? 0) / 100)}</p>{notice && <p>{notice}</p>}{wallet?.frozen ? <p>{tr("Din wallet er sat p\xE5 pause efter en betalings\xE6ndring. Kontakt klubben for afstemning.")}</p> : club?.walletEnabled && club.solutionMode === 'CUSTOM' ? <DepositForm tiers={JSON.parse(club.walletTiers)} /> : <p>{tr("Klubben har ikke \xE5bnet for nye indbetalinger.")}</p>}<section className="card"><h2 className="font-bold">{tr("Bev\xE6gelser")}</h2><ul className="divide-y">{wallet?.entries.map((e) => <li key={e.id} className="flex justify-between gap-3 py-3"><span>{e.label}<small className="block">{formatDate(e.createdAt, prefs.locale, club?.timeZone, { day: "numeric", month: "short", year: "numeric" })}</small></span><span>{money(e.amountOre / 100)}</span></li>)}</ul></section><Link className="btn-ghost" href="/profil">{tr("Tilbage til profil")}</Link>{club && <Link className="btn-court ml-2" href={`/klub/${club.slug}`}>{tr("Book bane")}</Link>}</div></InternationalProvider>;
}
