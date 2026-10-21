'use client';
// Front-desk register: tap what was sold, how it was paid, done. Items and
// stock underneath; gift-card status at the bottom.
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { Select } from '../../components/ui/Select';
import { recordSaleAction, saveShopItem, shopItemAction } from '../../lib/shop-actions';

type Item = { id: string; name: string; priceKr: number; stock: number; active: boolean };
type Sale = { id: string; items: string; totalKr: number; method: string; createdAt: Date; buyer: string | null };
type Gift = { id: string; code: string; amountKr: number; status: string; recipientEmail: string | null; createdAt: Date };

function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { const { pending } = useFormStatus(); return <button {...rest} disabled={pending}>{children}</button>; }

export function ShopPanel({ items, sales, gifts, slug }: { items: Item[]; sales: Sale[]; gifts: Gift[]; slug: string }) {
  const { tr, money, date } = useWebsiteInternational();
  const [state, action] = useFormState(recordSaleAction, null);
  const [istate, iaction] = useFormState(saveShopItem, null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState('CASH');
  const active = items.filter((i) => i.active);
  const total = active.reduce((s, i) => s + i.priceKr * (qty[i.id] ?? 0), 0);
  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + d) }));
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div><h2 className="display text-2xl">{tr('Kasse')}</h2><p className="mt-1 text-sm text-slate">{tr('Registrér et salg i receptionen: bolde, drikkevarer, leje af ketsjer. Kort trækkes på jeres egen terminal; vælg Wallet for at trække på medlemmets klubwallet.')}</p></div>
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
              <label className="label block">{tr('Betalt med')}<Select className="input" name="method" value={method} onChange={(e: any) => setMethod(e.target.value)}><option value="CASH">{tr('Kontant')}</option><option value="CARD">{tr('Kort (egen terminal)')}</option><option value="WALLET">{tr('Medlemmets wallet')}</option></Select></label>
              <label className="label block">{tr('Medlemmets e-mail')} {method !== 'WALLET' && <span className="font-normal text-slate">({tr('valgfri')})</span>}<input className="input" name="memberEmail" type="email" required={method === 'WALLET'} placeholder="member@example.com" /></label>
              <Pending className="btn-court" disabled={total <= 0}>{tr('Registrér')} · {money(total)}</Pending>
            </div>
            {state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}
          </form>
        )}
      </section>

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
          <ul className="divide-y divide-slate/10 text-sm">{sales.map((s) => <li key={s.id} className="flex flex-wrap items-baseline gap-3 py-2"><span className="w-28 shrink-0 text-slate">{date(s.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span><span className="min-w-0 flex-1 truncate">{(JSON.parse(s.items) as any[]).map((i) => `${i.qty}× ${i.name}`).join(', ')}{s.buyer ? ` · ${s.buyer}` : ''}</span><span className="text-xs text-slate">{tr({ CASH: 'Kontant', CARD: 'Kort', WALLET: 'Wallet' }[s.method] ?? s.method)}</span><span className="w-20 text-right font-semibold">{money(s.totalKr)}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
