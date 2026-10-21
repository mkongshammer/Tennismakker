'use client';
// Membership billing for the club: who has paid, who hasn't, and one button
// to bill everyone for the season. Settings for due date, reminders and the
// reply-to address sit underneath, because they're set once and left alone.
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { Select } from '../../components/ui/Select';
import { billAction, saveBillingSettings, sendBillsAction } from '../../lib/billing-actions';

type Bill = { id: string; name: string; email: string; amount: number; status: 'PAID' | 'OPEN' | 'OVERDUE' | 'CANCELLED'; billed: boolean; dueDate: Date | null; paidAt: Date | null; paidMethod: string | null };
type BillType = { id: string; name: string; seasonName: string; priceKr: number; open: boolean; unbilled: number; bills: Bill[] };
type Settings = { dueDays: number; reminders: boolean; replyTo: string; note: string; contactEmail: string };

function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return <button {...rest} disabled={pending} aria-busy={pending}>{children}</button>;
}

const TONE: Record<Bill['status'], string> = {
  PAID: 'bg-success-soft text-success',
  OPEN: 'bg-court-tint text-court-dark',
  OVERDUE: 'bg-[#fdeee8] text-[#a2401c]',
  CANCELLED: 'bg-mist text-slate',
};

export function BillingPanel({ types, members, settings, chargesEnabled, part = 'main' }: { types: BillType[]; members: number; settings: Settings; chargesEnabled: boolean; part?: 'main' | 'settings' }) {
  const { tr, money, date } = useWebsiteInternational();
  const openTypes = types.filter((t) => t.open);
  const [typeId, setTypeId] = useState(openTypes[0]?.id ?? '');
  const [confirm, setConfirm] = useState(false);
  const [sendState, sendAction] = useFormState(sendBillsAction, null);
  const [settingsState, settingsAction] = useFormState(saveBillingSettings, null);
  const [view, setView] = useState(types.find((t) => t.bills.length)?.id ?? types[0]?.id ?? '');
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const chosen = types.find((t) => t.id === typeId);
  const shown = types.find((t) => t.id === view);
  const label = (s: Bill['status']) => tr({ PAID: 'Betalt', OPEN: 'Åben', OVERDUE: 'Forfalden', CANCELLED: 'Annulleret' }[s]);
  const rows = (shown?.bills ?? []).filter((b) => filter === 'ALL' || (filter === 'PAID' ? b.status === 'PAID' : b.status !== 'PAID'));
  const paid = shown?.bills.filter((b) => b.status === 'PAID') ?? [];
  const unpaid = shown?.bills.filter((b) => b.status !== 'PAID') ?? [];

  return (
    <div className="space-y-6">
      {part === 'main' && <>
      {/* Send bills */}
      <section className="card space-y-4">
        <div>
          <h2 className="display text-2xl">{tr('Send regninger')}</h2>
          <p className="mt-1 text-sm text-slate">{tr('Vælg et kontingent, og send en regning til alle medlemmer, der ikke har betalt det. Hver får en mail med et betalingslink og kan også betale på hjemmesiden og i appen. Pengene går direkte til klubbens konto.')}</p>
        </div>
        {!chargesEnabled ? (
          <p className="rounded-xl bg-mist p-3 text-sm">{tr('Fuldfør udbetalingsopsætningen under Betaling, før I sender regninger.')}</p>
        ) : openTypes.length === 0 ? (
          <p className="rounded-xl bg-mist p-3 text-sm">{tr('Opret først et kontingent for sæsonen nedenfor.')}</p>
        ) : (
          <form action={sendAction} className="space-y-3" onSubmit={() => setConfirm(false)}>
            <label className="label block">{tr('Kontingent')}
              <Select name="typeId" className="input" value={typeId} onChange={(e: any) => { setTypeId(e.target.value); setConfirm(false); }}>
                {openTypes.map((t) => <option key={t.id} value={t.id}>{`${t.name} · ${t.seasonName} · ${money(t.priceKr)}`}</option>)}
              </Select>
            </label>
            <p className="text-sm">
              {chosen && chosen.unbilled > 0
                ? tr('{p0} af klubbens {p1} medlemmer har ikke fået en regning for dette kontingent.', { p0: chosen.unbilled, p1: members })
                : tr('Alle medlemmer har allerede fået en regning for dette kontingent.')}
            </p>
            {chosen && chosen.unbilled > 0 && (confirm ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-court/30 bg-court-tint/40 p-3">
                <p className="flex-1 text-sm">{tr('{p0} medlemmer får en mail med en regning på {p1}. Fortsæt?', { p0: chosen.unbilled, p1: money(chosen.priceKr) })}</p>
                <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>{tr('Fortryd')}</button>
                <Pending className="btn-court">{tr('Ja, send {p0} regninger', { p0: chosen.unbilled })}</Pending>
              </div>
            ) : (
              <button type="button" className="btn-court" onClick={() => setConfirm(true)}>{tr('Send {p0} regninger', { p0: chosen.unbilled })}</button>
            ))}
            {sendState?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(sendState.error)}</p>}
            {sendState?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(sendState.ok)}</p>}
          </form>
        )}
      </section>

      {/* Bills overview */}
      {types.some((t) => t.bills.length) && shown && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="display text-2xl">{tr('Regninger')}</h2>
              <p className="mt-1 text-sm text-slate">{tr('{p0} betalt · {p1} mangler', { p0: paid.length, p1: unpaid.length })}{paid.length ? ` · ${money(paid.reduce((s, b) => s + b.amount, 0))} ${tr('indbetalt')}` : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select className="input min-w-56" value={view} onChange={(e: any) => setView(e.target.value)} aria-label={tr('Kontingent')}>
                {types.map((t) => <option key={t.id} value={t.id}>{`${t.name} · ${t.seasonName}`}</option>)}
              </Select>
              <Select className="input" value={filter} onChange={(e: any) => setFilter(e.target.value)} aria-label={tr('Vis')}>
                <option value="ALL">{tr('Alle')}</option>
                <option value="UNPAID">{tr('Mangler betaling')}</option>
                <option value="PAID">{tr('Betalt')}</option>
              </Select>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-xl bg-mist p-4 text-sm text-slate">{tr('Ingen regninger her.')}</p>
          ) : (
            <ul className="divide-y divide-slate/10 rounded-2xl border border-slate/15">
              {rows.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="truncate text-xs text-slate">{b.email}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{money(b.amount)}</p>
                    <p className="text-xs text-slate">
                      {b.status === 'PAID' && b.paidAt
                        ? `${tr('Betalt')} ${date(b.paidAt, { month: 'short', day: 'numeric' })}${b.paidMethod === 'MANUAL' ? ` · ${tr('manuelt')}` : ''}`
                        : b.dueDate ? `${tr('Forfald')} ${date(b.dueDate, { month: 'short', day: 'numeric' })}` : tr('Selvtilmeldt')}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TONE[b.status]}`}>{label(b.status)}</span>
                  {b.status !== 'PAID' && b.billed && (
                    <form action={billAction} className="flex gap-1">
                      <input type="hidden" name="membershipId" value={b.id} />
                      <Pending name="intent" value="resend" className="rounded-full px-3 py-1.5 text-xs font-semibold text-court hover:bg-court-tint">{tr('Send igen')}</Pending>
                    </form>
                  )}
                  {b.status !== 'PAID' && b.billed && (
                    <details className="relative">
                      <summary className="cursor-pointer list-none rounded-full px-2 py-1.5 text-slate hover:bg-mist" aria-label={tr('Flere handlinger')}>⋯</summary>
                      <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate/15 bg-chalk p-1 shadow-pop">
                        <form action={billAction}>
                          <input type="hidden" name="membershipId" value={b.id} />
                          <button name="intent" value="paid" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-mist">{tr('Markér som betalt (kontant, check, overførsel)')}</button>
                          <button name="intent" value="cancel" className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#a2401c] hover:bg-mist">{tr('Annullér regning')}</button>
                        </form>
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      </>}
      {/* Settings */}
      {part === 'settings' && <section className="card space-y-4">
        <div>
          <h2 className="display text-2xl">{tr('Indstillinger for regninger')}</h2>
          <p className="mt-1 text-sm text-slate">{tr('Gælder alle regninger, klubben sender fremover.')}</p>
        </div>
        <form action={settingsAction} className="grid gap-4 sm:grid-cols-2">
          <label className="label block">{tr('Dage til forfald')}
            <input className="input" name="dueDays" type="number" min={1} max={90} defaultValue={settings.dueDays} required />
          </label>
          <label className="label block">{tr('Svar på regninger går til')}
            <input className="input" name="replyTo" type="email" defaultValue={settings.replyTo} placeholder={settings.contactEmail || 'treasurer@yourclub.com'} />
          </label>
          <label className="label block sm:col-span-2">{tr('Note på regningen (valgfri)')}
            <textarea className="input min-h-24" name="note" maxLength={500} defaultValue={settings.note} placeholder={tr('Fx: Betaler du hellere med check, så læg den i postkassen ved klubhuset.')} />
          </label>
          <label className="flex items-start gap-3 sm:col-span-2">
            <input type="checkbox" name="reminders" defaultChecked={settings.reminders} className="mt-1" />
            <span className="text-sm"><span className="font-semibold">{tr('Send automatiske påmindelser')}</span><br /><span className="text-slate">{tr('Én påmindelse 3 dage før forfald og én 3 dage efter, kun til dem der ikke har betalt.')}</span></span>
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Pending className="btn-court">{tr('Gem indstillinger')}</Pending>
            {settingsState?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(settingsState.error)}</p>}
            {settingsState?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(settingsState.ok)}</p>}
          </div>
        </form>
      </section>}
    </div>
  );
}
