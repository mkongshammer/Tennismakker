'use client';
// Revenue by month and category, with the two exports the treasurer asks
// for: a full CSV and a QuickBooks import file.
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { Select } from '../../components/ui/Select';
import { accountingSettingsAction, postToQuickBooksNow } from '../../lib/accounting-actions';

type Month = { month: string; total: number; fees: number; count: number; byCategory: Record<string, number> };
type Line = { date: string; category: string; description: string; customer: string; amountKr: number; feeKr: number; method: string };
export type Accounting = { configured: boolean; notice: string | null; status: { companyName: string | null; connectedAt: Date; lastPostedDay: string | null; autoPost: boolean; lastError: string | null; expired: boolean; sandbox: boolean; postings: { day: string; status: string; grossCents: number; feeCents: number; lines: number; externalId: string | null; error: string | null }[] } | null };
function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { const { pending } = useFormStatus(); return <button {...rest} disabled={pending}>{children}</button>; }

function QuickBooks({ configured, notice, status }: Accounting) {
  const { tr, date } = useWebsiteInternational();
  const [state, action] = useFormState(postToQuickBooksNow, null);
  return (
    <section className="card space-y-4" id="quickbooks">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="display text-2xl">QuickBooks Online</h2><p className="mt-1 text-sm text-slate">{tr('Forbind klubbens QuickBooks én gang. Derefter bogføres hver dags omsætning automatisk som én afstemt postering: indtægt pr. kategori, gebyrer for sig, kontanter og kortterminal på egne konti.')}</p></div>
        {!status && configured && <a className="btn-ink" href="/api/quickbooks/connect">{tr('Forbind QuickBooks')}</a>}
      </div>
      {notice && <p role="status" className="rounded-xl bg-court-tint p-3 text-sm font-semibold text-court-dark">{tr(notice)}</p>}
      {!configured && <p className="text-sm text-slate">{tr('QuickBooks-koblingen er ikke slået til på denne server endnu. Skriv til support@racketbuddy.app, så sætter vi den op. Indtil da virker QuickBooks-filen ovenfor.')}</p>}
      {status && (
        <div className="space-y-3">
          <p className="text-sm"><span className="font-bold">{status.companyName ?? tr('Forbundet')}</span>{status.sandbox && <span className="ml-2 badge-warning">sandbox</span>}<span className="text-slate"> · {tr('forbundet')} {date(status.connectedAt, { month: 'short', day: 'numeric', year: 'numeric' })} · {status.lastPostedDay ? `${tr('bogført til og med')} ${status.lastPostedDay}` : tr('intet bogført endnu')}</span></p>
          {status.expired && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger-ink">{tr('Forbindelsen er udløbet. Forbind igen.')} <a className="underline" href="/api/quickbooks/connect">{tr('Forbind QuickBooks')}</a></p>}
          {status.lastError && !status.expired && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger-ink">{status.lastError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <form action={action}><Pending className="btn-court btn-sm">{tr('Bogfør nu')}</Pending></form>
            <form action={accountingSettingsAction} className="flex items-center gap-2 text-sm"><input type="hidden" name="intent" value="auto" /><label className="flex items-center gap-2"><input type="checkbox" name="autoPost" defaultChecked={status.autoPost} onChange={(e) => e.currentTarget.form?.requestSubmit()} />{tr('Bogfør automatisk hver nat')}</label></form>
            <form action={accountingSettingsAction} className="flex items-center gap-2 text-sm"><input type="hidden" name="intent" value="startFrom" /><label className="flex items-center gap-2 whitespace-nowrap">{tr('Bogfør fra')}<input className="input !min-h-9 !py-1" type="date" name="day" required /></label><Pending className="btn-ghost btn-sm">{tr('Sæt')}</Pending></form>
            <form action={accountingSettingsAction}><input type="hidden" name="intent" value="disconnect" /><Pending className="text-xs font-semibold text-slate hover:text-[#a2401c]">{tr('Afbryd forbindelsen')}</Pending></form>
          </div>
          {state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{state.error}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}
          {status.postings.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate"><th className="py-2 pr-3">{tr('Dag')}</th><th className="py-2 pr-3">{tr('Status')}</th><th className="py-2 pr-3 text-right">{tr('Omsætning')}</th><th className="py-2 pr-3 text-right">{tr('Gebyrer')}</th><th className="py-2">{tr('Postering')}</th></tr></thead>
              <tbody className="divide-y divide-slate/10">{status.postings.map((p) => <tr key={p.day}><td className="py-2 pr-3">{p.day}</td><td className="py-2 pr-3">{p.status === 'POSTED' ? <span className="badge-success">{tr('bogført')}</span> : p.status === 'SKIPPED' ? <span className="text-slate">{tr('ingen omsætning')}</span> : <span className="badge-danger" title={p.error ?? ''}>{tr('fejl')}</span>}</td><td className="py-2 pr-3 text-right">{(p.grossCents / 100).toFixed(2)}</td><td className="py-2 pr-3 text-right">{(p.feeCents / 100).toFixed(2)}</td><td className="py-2 text-xs text-slate">{p.externalId ? `#${p.externalId}` : p.error ?? ''}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

export function ReportsPanel({ months, recent, categories, from, to, accounting }: { months: Month[]; recent: Line[]; categories: string[]; from: string; to: string; accounting: Accounting }) {
  const { tr, money, date } = useWebsiteInternational();
  const [range, setRange] = useState({ from, to });
  const q = `from=${range.from}&to=${range.to}`;
  const total = months.reduce((s, m) => s + m.total, 0), fees = months.reduce((s, m) => s + m.fees, 0);
  const label = (ym: string) => { const [y, m] = ym.split('-').map(Number); return date(new Date(Date.UTC(y, m - 1, 15)), { month: 'long', year: 'numeric', timeZone: 'UTC' } as any); };
  const byCat = categories.map((c) => [c, months.reduce((s, m) => s + (m.byCategory[c] ?? 0), 0)] as const).filter(([, v]) => v > 0);
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-2xl">{tr('Indtægter')}</h2>
            <p className="mt-1 text-sm text-slate">{tr('Alt, der er betalt gennem RacketBuddy, plus salg og kontante betalinger I selv har registreret.')}</p>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className="label text-xs">{tr('Fra')}<input className="input" type="date" name="from" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
            <label className="label text-xs">{tr('Til')}<input className="input" type="date" name="to" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
            <button className="btn-ghost">{tr('Vis')}</button>
          </form>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-mist p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate">{tr('Omsætning')}</p><p className="display mt-1 text-2xl">{money(total)}</p></div>
          <div className="rounded-2xl bg-mist p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate">{tr('Gebyrer')}</p><p className="display mt-1 text-2xl">{money(fees)}</p><p className="text-xs text-slate">{tr('Kortgebyrer fra Stripe er ikke med.')}</p></div>
          <div className="rounded-2xl bg-ink p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-white/60">{tr('Til klubben')}</p><p className="display mt-1 text-2xl text-optic">{money(total - fees)}</p></div>
        </div>
        {byCat.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {byCat.map(([c, v]) => (
              <li key={c} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-slate">{tr(c)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-mist"><span className="block h-full rounded-full bg-court" style={{ width: `${Math.max(2, (v / total) * 100)}%` }} /></span>
                <span className="w-24 text-right font-semibold">{money(v)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 border-t border-slate/10 pt-4">
          <a className="btn-court" href={`/admin/rapporter/export?${q}`} download>{tr('Download CSV')}</a>
          <a className="btn-ghost" href={`/admin/rapporter/export?${q}&format=quickbooks`} download>{tr('QuickBooks-fil')}</a>
          <p className="self-center text-xs text-slate">{tr('CSV åbner i Excel og Google Sheets. QuickBooks-filen importeres under Transactions → Banking → Upload.')}</p>
        </div>
      </section>

      <QuickBooks {...accounting} />

      <section className="card space-y-3">
        <h2 className="display text-2xl">{tr('Pr. måned')}</h2>
        {months.length === 0 ? <p className="text-sm text-slate">{tr('Ingen betalinger i perioden.')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate"><th className="py-2 pr-3">{tr('Måned')}</th>{categories.map((c) => <th key={c} className="py-2 pr-3 text-right">{tr(c)}</th>)}<th className="py-2 text-right">{tr('I alt')}</th></tr></thead>
              <tbody className="divide-y divide-slate/10">
                {months.map((m) => <tr key={m.month}><td className="py-2 pr-3 font-semibold">{label(m.month)}</td>{categories.map((c) => <td key={c} className="py-2 pr-3 text-right text-slate">{m.byCategory[c] ? money(m.byCategory[c]) : '–'}</td>)}<td className="py-2 text-right font-bold">{money(m.total)}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="display text-2xl">{tr('Seneste betalinger')}</h2>
        {recent.length === 0 ? <p className="text-sm text-slate">{tr('Ingen betalinger endnu.')}</p> : (
          <ul className="divide-y divide-slate/10">
            {recent.map((l, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-slate">{date(new Date(l.date), { month: 'short', day: 'numeric' })}</span>
                <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{tr(l.category)}</span> · {l.description}{l.customer ? ` · ${l.customer}` : ''}</span>
                <span className="text-xs text-slate">{l.method}</span>
                <span className="w-20 text-right font-semibold">{money(l.amountKr)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
