'use client';
// Front-desk register: tap what was sold, how it was paid, done. Items and
// stock underneath; gift-card status at the bottom.
import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { Select } from '../../components/ui/Select';
import { cancelReaderSaleAction, readerAction, recordSaleAction, saveShopItem, shopItemAction } from '../../lib/shop-actions';

type Item = { id: string; name: string; priceKr: number; stock: number; active: boolean };
type Sale = { id: string; items: string; totalKr: number; method: string; status: string; createdAt: Date; buyer: string | null };
type Gift = { id: string; code: string; amountKr: number; status: string; recipientEmail: string | null; createdAt: Date };
export type Reader = { id: string; label: string; status: string; deviceType: string | null };

function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { const { pending } = useFormStatus(); return <button {...rest} disabled={pending}>{children}</button>; }

function ReaderWait({ saleId, onDone, tr }: { saleId: string; onDone: (status: string) => void; tr: (s: string) => string }) {
  const [detail, setDetail] = useState<string>('');
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try { const r = await (await fetch(`/admin/butik/reader-status?sale=${saleId}`, { cache: 'no-store' })).json(); if (stop) return; if (r.status !== 'PENDING') { onDone(r.status); return; } setDetail(r.detail ?? ''); } catch { /* try again */ }
      if (!stop) setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; };
  }, [saleId, onDone]);
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-court-tint p-4 text-sm font-semibold text-court-dark">
      <span><span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-court" />{tr('Venter på kortet på læseren …')}{detail && detail !== 'Waiting for the card' ? <span className="ml-2 font-normal">{detail}</span> : null}</span>
      <form action={cancelReaderSaleAction}><input type="hidden" name="saleId" value={saleId} /><button className="btn-ghost btn-sm">{tr('Annullér')}</button></form>
    </div>
  );
}

function Readers({ readers, stripeReady }: { readers: Reader[]; stripeReady: boolean }) {
  const { tr } = useWebsiteInternational();
  const [state, action] = useFormState(readerAction, null);
  return (
    <section className="card space-y-4" id="readers">
      <div><h2 className="display text-2xl">{tr('Kortlæsere')}</h2><p className="mt-1 text-sm text-slate">{tr('En Stripe Terminal-læser (fx BBPOS WisePOS E eller Stripe Reader S700) i receptionen. Kassen sender beløbet til læseren, kunden tapper, og pengene går direkte til klubbens konto. Køb læseren i Stripe-dashboardet under Terminal.')}</p></div>
      {readers.length > 0 && (
        <ul className="divide-y divide-slate/10 text-sm">
          {readers.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><span className="font-semibold">{r.label}</span>{r.deviceType ? <span className="text-slate"> · {r.deviceType}</span> : null}</span><span className="flex items-center gap-3"><span className={r.status === 'online' ? 'badge-success' : 'badge-neutral'}>{r.status}</span><form action={action}><input type="hidden" name="readerId" value={r.id} /><Pending name="intent" value="remove" className="text-xs font-semibold text-slate hover:text-[#a2401c]">{tr('Fjern')}</Pending></form></span></li>)}
        </ul>
      )}
      {!stripeReady && <p className="rounded-xl bg-warning-soft p-3 text-sm font-semibold text-warning-ink">{tr('Gør klubbens Stripe-konto færdig under Betaling, før en læser kan parres.')}</p>}
      <form action={action} className="grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-5">
        <label className="label block sm:col-span-2">{tr('Parringskode fra læserens skærm')}<input className="input" name="registrationCode" required placeholder="sepia-cerulean-orynx" /></label>
        <label className="label block">{tr('Navn')}<input className="input" name="label" maxLength={60} placeholder={tr('Reception')} /></label>
        <label className="label block">{tr('Postnummer')}<input className="input" name="postalCode" maxLength={12} placeholder="02446" /></label>
        <label className="label block">{tr('Stat')}<input className="input" name="state" maxLength={3} placeholder="MA" /></label>
        <div className="flex items-center gap-3 sm:col-span-5"><Pending className="btn-court" disabled={!stripeReady}>{tr('Par kortlæser')}</Pending>{state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}</div>
      </form>
    </section>
  );
}

export function ShopPanel({ items, sales, gifts, slug, readers, stripeReady }: { items: Item[]; sales: Sale[]; gifts: Gift[]; slug: string; readers: Reader[]; stripeReady: boolean }) {
  const { tr, money, date } = useWebsiteInternational();
  const [state, action] = useFormState(recordSaleAction, null);
  const [readerDone, setReaderDone] = useState<string | null>(null);
  const pendingSale = state?.pendingSaleId && readerDone === null ? state.pendingSaleId : null;
  useEffect(() => { setReaderDone(null); }, [state?.pendingSaleId]);
  const [istate, iaction] = useFormState(saveShopItem, null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState('CASH');
  const active = items.filter((i) => i.active);
  const total = active.reduce((s, i) => s + i.priceKr * (qty[i.id] ?? 0), 0);
  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + d) }));
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div><h2 className="display text-2xl">{tr('Kasse')}</h2><p className="mt-1 text-sm text-slate">{tr('Registrér et salg i receptionen: bolde, drikkevarer, leje af ketsjer. Vælg Kortlæser for at tage kortet på jeres Stripe-læser, eller Wallet for at trække på medlemmets klubwallet.')}</p></div>
        {pendingSale && <ReaderWait saleId={pendingSale} tr={tr} onDone={(st) => setReaderDone(st)} />}
        {readerDone === 'PAID' && <p role="status" className="rounded-xl bg-success-soft p-4 text-sm font-semibold text-success-ink">{tr('Betalingen gik igennem på kortlæseren. Salget er registreret.')}</p>}
        {(readerDone === 'CANCELLED' || readerDone === 'FAILED') && <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm font-semibold text-danger-ink">{tr('Betalingen på kortlæseren blev ikke gennemført. Varerne er lagt tilbage på lager.')}</p>}
        {active.length === 0 ? <p className="rounded-xl bg-mist p-3 text-sm">{tr('Opret først nogle varer nedenfor.')}</p> : (
          <form action={action} onSubmit={() => setTimeout(() => setQty({}), 50)} className="space-y-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {active.map((i) => (
                <li key={i.id} className={`flex items-center gap-3 rounded-xl border p-3 ${qty[i.id] ? 'border-court bg-court-tint/30' : 'border-slate/15'}`}>
                  <input type="hidden" name="itemId" value={i.id} /><input type="hidden" name={`qty_${i.id}`} value={qty[i.id] ?? 0} />
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{i.name}</span><span className="text-xs text-slate">{money(i.priceKr)}{i.stock >= 0 ? ` · ${i.stock} ${tr('på lager')}` : ''}</span></span>
                  <button type="button" onClick={() => bump(i.id, -1)} className="h-9 w-9 rounded-full bg-mist font-bold" aria-label="−">−</button>
                  <span className="w-6 text-center font-bold">{qty[i.id] ?? 0}</span>
                  <button type="button" onClick={() => bump(i.id, 1)} className="h-9 w-9 rounded-full bg-ink font-bold text-white" aria-label="+">+</button>
                </li>
              ))}
            </ul>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="label block">{tr('Betalt med')}<Select className="input" name="method" value={method} onChange={(e: any) => setMethod(e.target.value)}><option value="CASH">{tr('Kontant')}</option><option value="CARD">{tr('Kort (egen terminal)')}</option>{readers.length > 0 && <option value="READER">{tr('Kortlæser (Stripe Terminal)')}</option>}<option value="WALLET">{tr('Medlemmets wallet')}</option></Select></label>
              {method === 'READER' && <label className="label block">{tr('Læser')}<Select className="input" name="readerId" defaultValue={readers[0]?.id}>{readers.map((r) => <option key={r.id} value={r.id}>{r.label}{r.status !== 'online' ? ` (${r.status})` : ''}</option>)}</Select></label>}
              <label className="label block">{tr('Medlemmets e-mail')} {method !== 'WALLET' && <span className="font-normal text-slate">({tr('valgfri')})</span>}<input className="input" name="memberEmail" type="email" required={method === 'WALLET'} placeholder="member@example.com" /></label>
              <Pending className="btn-court" disabled={total <= 0}>{tr('Registrér')} · {money(total)}</Pending>
            </div>
            {state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}
          </form>
        )}
      </section>

      <Readers readers={readers} stripeReady={stripeReady} />

      <section className="card space-y-4">
        <h2 className="display text-2xl">{tr('Varer')}</h2>
        {items.length > 0 && (
          <ul className="divide-y divide-slate/10">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className={`min-w-0 flex-1 ${i.active ? '' : 'text-slate line-through'}`}>{i.name}</span>
                <span className="w-20 text-right font-semibold">{money(i.priceKr)}</span>
                <span className="w-24 text-right text-slate">{i.stock >= 0 ? `${i.stock} ${tr('stk.')}` : tr('ubegrænset')}</span>
                <form action={shopItemAction}><input type="hidden" name="itemId" value={i.id} /><Pending name="intent" value={i.active ? 'archive' : 'restore'} className="text-xs font-semibold text-slate hover:text-ink">{i.active ? tr('Fjern') : tr('Gendan')}</Pending></form>
              </li>
            ))}
          </ul>
        )}
        <form action={iaction} className="flex flex-wrap items-end gap-3 rounded-xl bg-mist p-4">
          <label className="label block flex-1">{tr('Ny vare')}<input className="input" name="name" required maxLength={80} placeholder={tr('fx Dåse bolde')} /></label>
          <label className="label block w-28">{tr('Pris')}<input className="input" name="priceKr" type="number" min={0} max={5000} required /></label>
          <label className="label block w-32">{tr('Lager')}<input className="input" name="stock" type="number" min={0} placeholder={tr('tom = ubegrænset')} /></label>
          <Pending className="btn-court">{tr('Tilføj')}</Pending>
          {istate?.error && <p role="alert" className="w-full text-sm font-semibold text-[#a2401c]">{tr(istate.error)}</p>}{istate?.ok && <p role="status" className="w-full text-sm font-semibold text-success">{tr(istate.ok)}</p>}
        </form>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="display text-2xl">{tr('Gavekort')}</h2><a className="btn-ghost btn-sm" href={`/clubs/${slug}/gift`} target="_blank" rel="noreferrer">{tr('Se købssiden')}</a></div>
        <p className="text-sm text-slate">{tr('Købes på klubbens side og betales til klubbens konto. Modtageren indløser koden til sin klubwallet, som betaler for baner, hold og butik.')}</p>
        {gifts.length === 0 ? <p className="text-sm text-slate">{tr('Ingen gavekort solgt endnu.')}</p> : (
          <ul className="divide-y divide-slate/10 text-sm">{gifts.map((g) => <li key={g.id} className="flex flex-wrap items-center gap-3 py-2"><span className="font-mono font-semibold">{g.code}</span><span className="text-slate">{g.recipientEmail ?? ''}</span><span className="flex-1" /><span className="font-semibold">{money(g.amountKr)}</span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${g.status === 'REDEEMED' ? 'bg-mist text-slate' : g.status === 'ACTIVE' ? 'bg-success-soft text-success' : 'bg-court-tint text-court-dark'}`}>{tr({ ACTIVE: 'Aktivt', REDEEMED: 'Indløst', PENDING: 'Afventer betaling', CANCELLED: 'Annulleret' }[g.status] ?? g.status)}</span><span className="text-xs text-slate">{date(g.createdAt, { month: 'short', day: 'numeric' })}</span></li>)}</ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="display text-2xl">{tr('Seneste salg')}</h2>
        {sales.length === 0 ? <p className="text-sm text-slate">{tr('Ingen salg endnu.')}</p> : (
          <ul className="divide-y divide-slate/10 text-sm">{sales.map((s) => <li key={s.id} className="flex flex-wrap items-baseline gap-3 py-2"><span className="w-28 shrink-0 text-slate">{date(s.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span><span className="min-w-0 flex-1 truncate">{(JSON.parse(s.items) as any[]).map((i) => `${i.qty}× ${i.name}`).join(', ')}{s.buyer ? ` · ${s.buyer}` : ''}</span><span className="text-xs text-slate">{tr({ CASH: 'Kontant', CARD: 'Kort', WALLET: 'Wallet', READER: 'Kortlæser' }[s.method] ?? s.method)}{s.status !== 'PAID' ? ` · ${tr({ PENDING: 'afventer', CANCELLED: 'annulleret', FAILED: 'afvist' }[s.status] ?? s.status)}` : ''}</span><span className="w-20 text-right font-semibold">{money(s.totalKr)}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
