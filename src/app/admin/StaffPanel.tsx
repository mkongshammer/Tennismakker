'use client';
// Who works when. A week at a glance, shifts added one at a time or
// repeated weekly.
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { createStaffShift, deleteStaffShift } from '../../lib/shop-actions';

type Shift = { id: string; personName: string; role: string | null; note: string | null; startsAt: Date; endsAt: Date };
function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { const { pending } = useFormStatus(); return <button {...rest} disabled={pending}>{children}</button>; }

export function StaffPanel({ days, weekStart, prevHref, nextHref, people }: { days: { key: string; date: Date; shifts: Shift[] }[]; weekStart: Date; prevHref: string; nextHref: string; people: string[] }) {
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
    </div>
  );
}
