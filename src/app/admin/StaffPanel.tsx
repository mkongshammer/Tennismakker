'use client';
// Who works when. A week at a glance, shifts added one at a time or
// repeated weekly.
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { createStaffShift, deleteStaffShift } from '../../lib/shop-actions';
import { closePayrollAction, reopenPayrollAction, saveStaffMember, saveTimeEntry, staffAdminAction, timeEntryAction } from '../../lib/payroll-actions';
import { Select } from '../../components/ui/Select';

type Shift = { id: string; personName: string; role: string | null; note: string | null; startsAt: Date; endsAt: Date };
export type Staff = { id: string; name: string; email: string | null; role: string | null; hourlyRateCents: number; pin: string; overtimeAfterHours: number; active: boolean };
export type Entry = { id: string; staffId: string; name: string; clockIn: Date; clockOut: Date | null; breakMinutes: number; minutes: number; note: string | null; source: string; locked: boolean };
export type PayLineView = { staffId: string; name: string; regularMinutes: number; overtimeMinutes: number; rateCents: number; grossCents: number; entries: number };
export type RunView = { id: string; periodStart: Date; periodEnd: Date; totalCents: number; currency: string; people: number; createdAt: Date };
type PayrollProps = { staff: Staff[]; entries: Entry[]; onClock: number; clockUrl: string; period: { from: string; to: string }; preview: PayLineView[]; unpaidOpen: number; runs: RunView[]; currency: string; scheduledMinutes: Record<string, number> };
const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { const { pending } = useFormStatus(); return <button {...rest} disabled={pending}>{children}</button>; }

export function StaffPanel({ days, weekStart, prevHref, nextHref, people, payroll }: { days: { key: string; date: Date; shifts: Shift[] }[]; weekStart: Date; prevHref: string; nextHref: string; people: string[]; payroll: PayrollProps }) {
  const { tr, date } = useWebsiteInternational();
  const [state, action] = useFormState(createStaffShift, null);
  const t = (d: Date) => date(d, { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-2xl">{tr('Uge fra')} {date(weekStart, { month: 'short', day: 'numeric' })}</h2>
          <div className="flex gap-2"><a className="btn-ghost btn-sm" href={prevHref}>← {tr('Forrige')}</a><a className="btn-ghost btn-sm" href={nextHref}>{tr('Næste')} →</a></div>
        </div>
        <div className="grid gap-2 sm:grid-cols-7">
          {days.map((d) => (
            <div key={d.key} className="rounded-xl border border-slate/15 p-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate">{date(d.date, { weekday: 'short', day: 'numeric' })}</p>
              <ul className="mt-2 space-y-1.5">
                {d.shifts.map((s) => (
                  <li key={s.id} className="group rounded-lg bg-court-tint/50 p-2 text-xs">
                    <p className="font-bold">{s.personName}</p>
                    <p className="text-slate">{t(s.startsAt)}–{t(s.endsAt)}{s.role ? ` · ${s.role}` : ''}</p>
                    {s.note && <p className="text-slate">{s.note}</p>}
                    <form action={deleteStaffShift}><input type="hidden" name="shiftId" value={s.id} /><Pending className="mt-1 text-[11px] font-semibold text-slate hover:text-[#a2401c]">{tr('Slet')}</Pending></form>
                  </li>
                ))}
                {d.shifts.length === 0 && <li className="text-xs text-slate-light">–</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section className="card space-y-4">
        <h2 className="display text-2xl">{tr('Ny vagt')}</h2>
        <form action={action} className="grid gap-3 sm:grid-cols-3">
          <label className="label block">{tr('Navn')}<input className="input" name="personName" list="staff-people" required maxLength={80} /><datalist id="staff-people">{people.map((p) => <option key={p} value={p} />)}</datalist></label>
          <label className="label block">{tr('Rolle')}<input className="input" name="role" maxLength={60} placeholder={tr('fx Reception, Træner')} /></label>
          <label className="label block">{tr('Dag')}<input className="input" name="day" type="date" required /></label>
          <label className="label block">{tr('Fra')}<input className="input" name="start" type="time" required defaultValue="09:00" /></label>
          <label className="label block">{tr('Til')}<input className="input" name="end" type="time" required defaultValue="17:00" /></label>
          <label className="label block">{tr('Gentag i uger')}<input className="input" name="repeatWeeks" type="number" min={1} max={12} defaultValue={1} /></label>
          <label className="label block sm:col-span-3">{tr('Note')}<input className="input" name="note" maxLength={200} /></label>
          <div className="flex items-center gap-3 sm:col-span-3"><Pending className="btn-court">{tr('Tilføj vagt')}</Pending>{state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}</div>
        </form>
      </section>
      <TimeClock {...payroll} weekStart={weekStart} />
      <StaffList staff={payroll.staff} currency={payroll.currency} />
      <Payroll {...payroll} />
    </div>
  );
}

function TimeClock({ entries, staff, onClock, clockUrl, weekStart, scheduledMinutes }: PayrollProps & { weekStart: Date }) {
  const { tr, date } = useWebsiteInternational();
  const [state, action] = useFormState(saveTimeEntry, null);
  const t = (d: Date) => date(d, { hour: 'numeric', minute: '2-digit' });
  const byPerson = new Map<string, number>();
  for (const e of entries) byPerson.set(e.name, (byPerson.get(e.name) ?? 0) + e.minutes);
  return (
    <section id="tid" className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="display text-2xl">{tr('Timeregistrering')}</h2><p className="mt-1 text-sm text-slate">{tr('De ansatte stempler ind og ud med deres PIN-kode på stempeluret (åbn det på tabletten i receptionen). Du kan også registrere timer her.')}</p></div>
        <div className="flex items-center gap-2"><a className="btn-ink btn-sm" href={clockUrl} target="_blank" rel="noreferrer">{tr('Åbn stempeluret')}</a><span className="text-sm text-slate">{onClock} {tr('på arbejde nu')}</span></div>
      </div>
      {byPerson.size > 0 && (
        <ul className="grid gap-2 sm:grid-cols-3">{[...byPerson.entries()].map(([name, m]) => <li key={name} className="rounded-xl bg-mist p-3 text-sm"><p className="font-bold">{name}</p><p className="text-slate">{hhmm(m)} {tr('timer denne uge')}{scheduledMinutes[name] ? ` · ${tr('planlagt')} ${hhmm(scheduledMinutes[name])}` : ''}</p></li>)}</ul>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate"><th className="py-2 pr-3">{tr('Ansat')}</th><th className="py-2 pr-3">{tr('Dag')}</th><th className="py-2 pr-3">{tr('Ind')}</th><th className="py-2 pr-3">{tr('Ud')}</th><th className="py-2 pr-3">{tr('Pause')}</th><th className="py-2 pr-3 text-right">{tr('Timer')}</th><th className="py-2"></th></tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={7} className="py-3 text-slate">{tr('Ingen registreringer i denne uge.')}</td></tr>}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate/10">
                <td className="py-2 pr-3 font-semibold">{e.name}{e.source === 'MANUAL' && <span className="ml-1 text-xs font-normal text-slate">· {tr('manuelt')}</span>}</td>
                <td className="py-2 pr-3">{date(e.clockIn, { weekday: 'short', day: 'numeric' })}</td>
                <td className="py-2 pr-3">{t(e.clockIn)}</td>
                <td className="py-2 pr-3">{e.clockOut ? t(e.clockOut) : <span className="badge-success">{tr('på arbejde')}</span>}</td>
                <td className="py-2 pr-3">{e.breakMinutes ? `${e.breakMinutes} min` : '–'}</td>
                <td className="py-2 pr-3 text-right font-semibold">{hhmm(e.minutes)}</td>
                <td className="py-2 text-right">
                  {e.locked ? <span className="text-xs text-slate">{tr('lønnet')}</span> : (
                    <form action={timeEntryAction} className="inline-flex gap-2"><input type="hidden" name="entryId" value={e.id} />
                      {!e.clockOut && <Pending name="intent" value="clockOut" className="text-xs font-semibold text-court">{tr('Stempl ud')}</Pending>}
                      <Pending name="intent" value="delete" className="text-xs font-semibold text-slate hover:text-[#a2401c]">{tr('Slet')}</Pending>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={action} className="grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-6">
        <label className="label block sm:col-span-2">{tr('Ansat')}<Select className="input" name="staffId" defaultValue="" required><option value="" disabled>{tr('Vælg')}</option>{staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
        <label className="label block">{tr('Dag')}<input className="input" name="day" type="date" required defaultValue={weekStart.toISOString().slice(0, 10)} /></label>
        <label className="label block">{tr('Ind')}<input className="input" name="start" type="time" required defaultValue="09:00" /></label>
        <label className="label block">{tr('Ud')}<input className="input" name="end" type="time" required defaultValue="17:00" /></label>
        <label className="label block">{tr('Pause (min)')}<input className="input" name="breakMinutes" type="number" min={0} max={480} defaultValue={30} /></label>
        <label className="label block sm:col-span-4">{tr('Note')}<input className="input" name="note" maxLength={200} /></label>
        <div className="flex items-end gap-3 sm:col-span-2"><Pending className="btn-court">{tr('Registrér timer')}</Pending></div>
        {state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c] sm:col-span-6">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success sm:col-span-6">{tr(state.ok)}</p>}
      </form>
    </section>
  );
}

function StaffList({ staff, currency }: { staff: Staff[]; currency: string }) {
  const { tr } = useWebsiteInternational();
  const [state, action] = useFormState(saveStaffMember, null);
  return (
    <section id="ansatte" className="card space-y-4">
      <div><h2 className="display text-2xl">{tr('Ansatte')}</h2><p className="mt-1 text-sm text-slate">{tr('Timeløn og PIN-kode til stempeluret. Overtid betales med 1,5× over grænsen pr. uge.')}</p></div>
      {staff.length > 0 && (
        <ul className="divide-y divide-slate/10 text-sm">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><span className="font-semibold">{s.name}</span>{s.role ? <span className="text-slate"> · {s.role}</span> : null}{!s.active && <span className="ml-1 text-xs text-slate">· {tr('inaktiv')}</span>}</span>
              <span className="flex items-center gap-3 text-slate"><span>{(s.hourlyRateCents / 100).toFixed(2)} {currency}/t</span><span>PIN {s.pin}</span><span>{tr('overtid efter')} {s.overtimeAfterHours}t</span>
                <form action={staffAdminAction}><input type="hidden" name="staffId" value={s.id} /><Pending name="intent" value={s.active ? 'deactivate' : 'activate'} className="text-xs font-semibold text-court">{s.active ? tr('Deaktivér') : tr('Aktivér')}</Pending></form></span>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-6">
        <label className="label block sm:col-span-2">{tr('Navn')}<input className="input" name="name" required maxLength={80} /></label>
        <label className="label block">{tr('Rolle')}<input className="input" name="role" maxLength={60} placeholder={tr('fx Reception, Træner')} /></label>
        <label className="label block">{tr('Timeløn')}<input className="input" name="hourlyRate" type="number" step="0.01" min={0} max={1000} required placeholder="18.00" /></label>
        <label className="label block">{tr('PIN-kode')}<input className="input" name="pin" inputMode="numeric" pattern="[0-9]{4,6}" required maxLength={6} placeholder="1234" /></label>
        <label className="label block">{tr('Overtid efter (t/uge)')}<input className="input" name="overtimeAfterHours" type="number" min={0} max={80} defaultValue={40} /></label>
        <label className="label block sm:col-span-3">{tr('E-mail (valgfri)')}<input className="input" name="email" type="email" maxLength={120} /></label>
        <div className="flex items-end gap-3 sm:col-span-3"><Pending className="btn-court">{tr('Tilføj ansat')}</Pending>{state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}</div>
      </form>
    </section>
  );
}

function Payroll({ period, preview, unpaidOpen, runs, currency }: PayrollProps) {
  const { tr, date } = useWebsiteInternational();
  const [state, action] = useFormState(closePayrollAction, null);
  const total = preview.reduce((s, l) => s + l.grossCents, 0);
  const money = (c: number) => `${(c / 100).toFixed(2)} ${currency}`;
  return (
    <section id="loen" className="card space-y-4">
      <div><h2 className="display text-2xl">{tr('Lønkørsel')}</h2><p className="mt-1 text-sm text-slate">{tr('Vælg lønperioden, tjek timerne og luk kørslen. Så låses registreringerne, og du får en CSV-fil, som Gusto, QuickBooks Payroll og ADP kan importere.')}</p></div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="label block">{tr('Fra')}<input className="input" type="date" name="fra" defaultValue={period.from} /></label>
        <label className="label block">{tr('Til')}<input className="input" type="date" name="til" defaultValue={period.to} /></label>
        <button className="btn-ghost">{tr('Vis')}</button>
        <a className="btn-ghost" href={`/admin/vagtplan/export?from=${period.from}&to=${period.to}&format=timesheet`}>{tr('Timeseddel (CSV)')}</a>
      </form>
      {unpaidOpen > 0 && <p className="rounded-xl bg-warning-soft p-3 text-sm font-semibold text-warning-ink">{tr('Åbne registreringer i perioden')}: {unpaidOpen}. {tr('Stempl dem ud, før kørslen lukkes.')}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate"><th className="py-2 pr-3">{tr('Ansat')}</th><th className="py-2 pr-3 text-right">{tr('Normaltimer')}</th><th className="py-2 pr-3 text-right">{tr('Overtimer')}</th><th className="py-2 pr-3 text-right">{tr('Timeløn')}</th><th className="py-2 text-right">{tr('Bruttoløn')}</th></tr></thead>
          <tbody>
            {preview.length === 0 && <tr><td colSpan={5} className="py-3 text-slate">{tr('Ingen ubetalte timer i perioden.')}</td></tr>}
            {preview.map((l) => <tr key={l.staffId} className="border-t border-slate/10"><td className="py-2 pr-3 font-semibold">{l.name}</td><td className="py-2 pr-3 text-right">{hhmm(l.regularMinutes)}</td><td className="py-2 pr-3 text-right">{l.overtimeMinutes ? hhmm(l.overtimeMinutes) : '–'}</td><td className="py-2 pr-3 text-right">{money(l.rateCents)}</td><td className="py-2 text-right font-bold">{money(l.grossCents)}</td></tr>)}
            {preview.length > 0 && <tr className="border-t border-slate/20"><td className="py-2 pr-3 font-bold" colSpan={4}>{tr('I alt')}</td><td className="py-2 text-right font-bold">{money(total)}</td></tr>}
          </tbody>
        </table>
      </div>
      {preview.length > 0 && (
        <form action={action} className="flex flex-wrap items-center gap-3"><input type="hidden" name="from" value={period.from} /><input type="hidden" name="to" value={period.to} />
          <Pending className="btn-ink">{tr('Luk lønkørslen')}</Pending><a className="btn-ghost" href={`/admin/vagtplan/export?from=${period.from}&to=${period.to}`}>{tr('Forhåndsvisning (CSV)')}</a>
          {state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}
        </form>
      )}
      {runs.length > 0 && (
        <div><h3 className="font-bold">{tr('Lukkede lønkørsler')}</h3>
          <ul className="mt-2 divide-y divide-slate/10 text-sm">{runs.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{date(r.periodStart, { month: 'short', day: 'numeric' })} – {date(new Date(r.periodEnd.getTime() - 1), { month: 'short', day: 'numeric', year: 'numeric' })} · {r.people} {tr('ansatte')} · <span className="font-semibold">{(r.totalCents / 100).toFixed(2)} {r.currency}</span></span><span className="flex gap-3"><a className="font-semibold text-court" href={`/admin/vagtplan/export?run=${r.id}`}>{tr('Hent CSV')}</a><form action={reopenPayrollAction}><input type="hidden" name="runId" value={r.id} /><Pending className="text-xs font-semibold text-slate hover:text-[#a2401c]">{tr('Genåbn')}</Pending></form></span></li>)}</ul>
        </div>
      )}
    </section>
  );
}
