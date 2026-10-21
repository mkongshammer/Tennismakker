'use client';
// Revenue by month and category, with the two exports the treasurer asks
// for: a full CSV and a QuickBooks import file.
import { useState } from 'react';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { Select } from '../../components/ui/Select';

type Month = { month: string; total: number; fees: number; count: number; byCategory: Record<string, number> };
type Line = { date: string; category: string; description: string; customer: string; amountKr: number; feeKr: number; method: string };

export function ReportsPanel({ months, recent, categories, from, to }: { months: Month[]; recent: Line[]; categories: string[]; from: string; to: string }) {
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
