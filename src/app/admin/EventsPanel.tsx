'use client';
// Events and the ladder, from the club's side: create, see who's in, close.
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { Select } from '../../components/ui/Select';
import { createEvent, createLadder, eventAdminAction, ladderAdminAction } from '../../lib/event-actions';

type Signup = { id: string; name: string; email: string; status: string; paidAt: Date | null };
type Ev = { id: string; name: string; kind: string; sport: string; startsAt: Date; endsAt: Date; priceKr: number; capacity: number; active: boolean; signups: Signup[] };
type Lad = { id: string; name: string; sport: string; active: boolean; players: number; top: { name: string; rank: number; wins: number; losses: number }[] };

function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { const { pending } = useFormStatus(); return <button {...rest} disabled={pending}>{children}</button>; }
const KINDS: [string, string][] = [['TOURNAMENT', 'Turnering'], ['LEAGUE', 'Liga'], ['SOCIAL', 'Socialt arrangement'], ['CLINIC', 'Clinic']];

export function EventsPanel({ events, ladders, sports, sportLabels, slug }: { events: Ev[]; ladders: Lad[]; sports: string[]; sportLabels: Record<string, string>; slug: string }) {
  const { tr, money, date } = useWebsiteInternational();
  const [state, action] = useFormState(createEvent, null);
  const [lstate, laction] = useFormState(createLadder, null);
  const kindLabel = (k: string) => tr(KINDS.find(([id]) => id === k)?.[1] ?? k);
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div><h2 className="display text-2xl">{tr('Opret arrangement')}</h2><p className="mt-1 text-sm text-slate">{tr('Turneringer, ligaer, sociale aftener og clinics. Medlemmer tilmelder sig og betaler på klubbens side; pengene går til klubbens konto.')}</p></div>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <label className="label block sm:col-span-2">{tr('Navn')}<input className="input" name="name" required maxLength={120} placeholder={tr('fx Fredagsdoubler · Oktober')} /></label>
          <label className="label block">{tr('Type')}<Select className="input" name="kind" defaultValue="SOCIAL">{KINDS.map(([id, l]) => <option key={id} value={id}>{tr(l)}</option>)}</Select></label>
          <label className="label block">{tr('Sportsgren')}<Select className="input" name="sport" defaultValue={sports[0]}>{sports.map((s) => <option key={s} value={s}>{sportLabels[s] ?? s}</option>)}</Select></label>
          <label className="label block">{tr('Start')}<input className="input" name="startsAt" type="datetime-local" required /></label>
          <label className="label block">{tr('Slut')}<input className="input" name="endsAt" type="datetime-local" required /></label>
          <label className="label block">{tr('Pris pr. deltager')}<input className="input" name="priceKr" type="number" min={0} max={5000} defaultValue={0} /><span className="hint">{tr('0 = gratis.')}</span></label>
          <label className="label block">{tr('Pladser')}<input className="input" name="capacity" type="number" min={0} max={500} defaultValue={0} /><span className="hint">{tr('0 = intet loft. Er det fuldt, kan man skrive sig på venteliste.')}</span></label>
          <label className="label block">{tr('Tilmelding lukker (valgfri)')}<input className="input" name="signupClosesAt" type="datetime-local" /></label>
          <label className="label block sm:col-span-2">{tr('Beskrivelse')}<textarea className="input min-h-24" name="description" maxLength={2000} placeholder={tr('Format, niveau, hvad der er inkluderet, hvad man skal medbringe.')} /></label>
          <div className="flex items-center gap-3 sm:col-span-2"><Pending className="btn-court">{tr('Opret arrangement')}</Pending>{state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}</div>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="display text-2xl">{tr('Arrangementer')}</h2>
        {events.length === 0 ? <p className="text-sm text-slate">{tr('Ingen arrangementer endnu.')}</p> : (
          <ul className="space-y-3">
            {events.map((e) => {
              const paid = e.signups.filter((s) => s.status === 'PAID');
              return (
                <li key={e.id} className="rounded-2xl border border-slate/15 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{e.name} <span className="ml-1 rounded-full bg-mist px-2 py-0.5 text-xs font-semibold text-slate">{kindLabel(e.kind)}</span>{!e.active && <span className="ml-1 text-xs text-slate">· {tr('lukket')}</span>}</p>
                      <p className="text-sm text-slate">{date(e.startsAt, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {e.priceKr > 0 ? money(e.priceKr) : tr('gratis')} · {paid.length}{e.capacity ? ` / ${e.capacity}` : ''} {tr('tilmeldt')}</p>
                    </div>
                    <div className="flex gap-2">
                      <a className="btn-ghost btn-sm" href={`/clubs/${slug}/events/${e.id}`} target="_blank" rel="noreferrer">{tr('Se siden')}</a>
                      <form action={eventAdminAction}><input type="hidden" name="eventId" value={e.id} /><Pending name="intent" value={e.active ? 'close' : 'open'} className="btn-ghost btn-sm">{e.active ? tr('Luk tilmelding') : tr('Åbn igen')}</Pending></form>
                    </div>
                  </div>
                  {paid.length > 0 && (
                    <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-court">{tr('Deltagere')} ({paid.length})</summary>
                      <ul className="mt-2 divide-y divide-slate/10 text-sm">
                        {paid.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 py-2"><span>{s.name} <span className="text-xs text-slate">{s.email}</span></span><form action={eventAdminAction}><input type="hidden" name="signupId" value={s.id} /><Pending name="intent" value="removeSignup" className="text-xs font-semibold text-slate hover:text-[#a2401c]">{tr('Fjern')}</Pending></form></li>)}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card space-y-4">
        <div><h2 className="display text-2xl">{tr('Rangliste')}</h2><p className="mt-1 text-sm text-slate">{tr('Medlemmer melder sig til, udfordrer hinanden og indberetter resultatet selv. Vinder man over én højere oppe, tager man pladsen.')}</p></div>
        {ladders.length > 0 && (
          <ul className="space-y-3">
            {ladders.map((l) => (
              <li key={l.id} className="rounded-2xl border border-slate/15 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold">{l.name} <span className="text-sm font-normal text-slate">· {sportLabels[l.sport] ?? l.sport} · {l.players} {tr('spillere')}</span>{!l.active && <span className="ml-1 text-xs text-slate">· {tr('lukket')}</span>}</p>
                  <div className="flex gap-2"><a className="btn-ghost btn-sm" href={`/clubs/${slug}/ladder`} target="_blank" rel="noreferrer">{tr('Se siden')}</a><form action={ladderAdminAction}><input type="hidden" name="ladderId" value={l.id} /><Pending name="intent" value={l.active ? 'close' : 'open'} className="btn-ghost btn-sm">{l.active ? tr('Luk') : tr('Åbn igen')}</Pending></form></div>
                </div>
                {l.top.length > 0 && <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{l.top.map((p) => <li key={p.rank} className="flex gap-2"><span className="w-6 font-bold text-court">{p.rank}</span><span className="flex-1">{p.name}</span><span className="text-slate">{p.wins}–{p.losses}</span></li>)}</ol>}
              </li>
            ))}
          </ul>
        )}
        <form action={laction} className="flex flex-wrap items-end gap-3 rounded-xl bg-mist p-4">
          <label className="label block flex-1">{tr('Ny rangliste')}<input className="input" name="name" required maxLength={80} placeholder={tr('fx Singles ladder 2026')} /></label>
          <label className="label block">{tr('Sportsgren')}<Select className="input" name="sport" defaultValue={sports[0]}>{sports.map((s) => <option key={s} value={s}>{sportLabels[s] ?? s}</option>)}</Select></label>
          <Pending className="btn-court">{tr('Opret')}</Pending>
          {lstate?.error && <p role="alert" className="w-full text-sm font-semibold text-[#a2401c]">{tr(lstate.error)}</p>}{lstate?.ok && <p role="status" className="w-full text-sm font-semibold text-success">{tr(lstate.ok)}</p>}
        </form>
      </section>
    </div>
  );
}
