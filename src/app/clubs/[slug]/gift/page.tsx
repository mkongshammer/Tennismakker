import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { buyGiftCardAction, redeemGiftCardAction } from "../../../../lib/shop-actions";
import { Icon } from "../../../../components/ui";

export const dynamic = "force-dynamic";
const AMOUNTS = [25, 50, 100, 150, 250];

export default async function GiftPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string; paid?: string; bought?: string; error?: string }> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const club = await db.club.findUnique({ where: { slug }, select: { id: true, name: true, currency: true, stripeChargesEnabled: true } });
  if (!club) notFound();
  const paid = q.paid ? await db.giftCard.findFirst({ where: { id: q.paid, clubId: club.id }, select: { status: true, code: true, recipientEmail: true } }) : null;
  const sym = club.currency === "USD" ? "$" : `${club.currency} `;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href={`/clubs/${slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-court"><Icon name="chevron" size={16} className="rotate-180" />{club.name}</Link>
      <header className="rounded-3xl bg-ink p-6 text-white sm:p-8">
        <p className="eyebrow text-white/60">Gift card</p>
        <h1 className="display mt-2 text-3xl">Give court time at {club.name}</h1>
        <p className="mt-2 text-white/80">The card goes into the recipient's club wallet and pays for courts, lessons, events and the pro shop. Never expires.</p>
      </header>
      {q.error && <p role="alert" className="rounded-xl bg-[#fdeee8] p-4 text-sm font-semibold text-[#a2401c]">{q.error}</p>}
      {paid && (
        <div className="rounded-2xl bg-success-soft p-5 text-success-ink">
          <p className="font-bold">{paid.status === "PENDING" ? "Payment received, confirming…" : "Paid. Thank you!"}</p>
          {paid.status !== "PENDING" && <p className="mt-1 text-sm">Code <span className="font-mono font-bold">{paid.code}</span>{paid.recipientEmail ? `, also e-mailed to ${paid.recipientEmail}.` : ". A receipt is on its way by e-mail."}</p>}
          {paid.status === "PENDING" && <p className="mt-1 text-sm">Refresh in a moment to see the code.</p>}
        </div>
      )}
      {q.bought && q.code && <div className="rounded-2xl bg-success-soft p-5 text-success-ink"><p className="font-bold">Gift card created.</p><p className="mt-1 text-sm">Code <span className="font-mono font-bold">{q.code}</span></p></div>}

      <section className="card space-y-4">
        <h2 className="display text-xl">Redeem a code</h2>
        <form action={redeemGiftCardAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="slug" value={slug} />
          <input className="input flex-1 font-mono uppercase" name="code" defaultValue={q.code ?? ""} placeholder="RB-XXXX-XXXX" required />
          <button className="btn-court">{user ? "Add to my wallet" : "Log in and redeem"}</button>
        </form>
      </section>

      <section className="card space-y-4">
        <h2 className="display text-xl">Buy a gift card</h2>
        {!club.stripeChargesEnabled ? <p className="text-slate">The club isn't set up for online payments yet.</p> : (
          <form action={buyGiftCardAction} className="space-y-4">
            <input type="hidden" name="slug" value={slug} />
            <fieldset><legend className="label">Amount</legend>
              <div className="flex flex-wrap gap-2">{AMOUNTS.map((a, i) => <label key={a} className="cursor-pointer rounded-full border border-slate/20 px-4 py-2 font-semibold has-[:checked]:border-court has-[:checked]:bg-court has-[:checked]:text-white"><input type="radio" name="amountKr" value={a} defaultChecked={i === 1} className="sr-only" />{sym}{a}</label>)}</div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="label block">Recipient's name<input className="input" name="recipientName" maxLength={80} /></label>
              <label className="label block">Recipient's e-mail <span className="font-normal text-slate">(we'll send them the code)</span><input className="input" name="recipientEmail" type="email" /></label>
            </div>
            <label className="label block">Message<textarea className="input min-h-20" name="message" maxLength={300} placeholder="Happy birthday! See you on court." /></label>
            <button className="btn-court w-full">Continue to payment</button>
            <p className="text-center text-xs text-slate">Secure card payment by Stripe. Paid straight to {club.name}.</p>
          </form>
        )}
      </section>
    </div>
  );
}
