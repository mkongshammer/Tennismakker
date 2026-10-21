'use client';
// Fobs and cards from the club's own door system: who holds which, the
// URL the controller asks on every tap, the rules, the log, and Kisi.
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { Select } from '../../components/ui/Select';
import { addCredentialAction, credentialAction, importCredentialsAction, kisiAction, rotateAccessKeyAction, saveAccessSettings, testAccessAction } from '../../lib/access-actions';

export type Credential = { id: string; label: string | null; kind: string; uidTail: string; active: boolean; validUntil: Date | null; lastUsedAt: Date | null; holder: string; holderKind: 'member' | 'staff' };
export type AccessEventView = { id: string; at: Date; uidTail: string; door: string | null; allowed: boolean; reason: string; source: string; who: string | null };
export type AccessProps = {
  settings: { beforeMinutes: number; afterMinutes: number; memberWithoutBooking: boolean; memberFromHour: number; memberUntilHour: number; kisiConnected: boolean; kisiLockId: string | null; kisiLockName: string | null; kisiPlaceName: string | null };
  apiKey: string; checkUrl: string; credentials: Credential[]; events: AccessEventView[]; staff: { id: string; name: string }[]; kisiLocks: { id: string; name: string; online?: boolean }[];
};
function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) { const { pending } = useFormStatus(); return <button {...rest} disabled={pending}>{children}</button>; }
const Msg = ({ state, tr }: { state: { ok?: string; error?: string } | null; tr: (s: string) => string }) => <>{state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}{state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}</>;
const REASONS: Record<string, string> = { unknown: 'Ukendt brik', inactive: 'Brik deaktiveret', expired: 'Brik udløbet', staff: 'Ansat', booking: 'Booking i gang', 'member-hours': 'Medlem i åbningstiden', 'no-booking': 'Ingen booking nu', 'outside-member-hours': 'Uden for medlemstid' };

export function AccessPanel({ settings, apiKey, checkUrl, credentials, events, staff, kisiLocks }: AccessProps) {
  const { tr, date } = useWebsiteInternational();
  const [sstate, saction] = useFormState(saveAccessSettings, null);
  const [cstate, caction] = useFormState(addCredentialAction, null);
  const [istate, iaction] = useFormState(importCredentialsAction, null);
  const [tstate, taction] = useFormState(testAccessAction, null);
  const [kstate, kaction] = useFormState(kisiAction, null);
  const [who, setWho] = useState('member');
  const [showKey, setShowKey] = useState(false);
  const when = (d: Date) => date(d, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="mt-10 space-y-6" id="brikker">
      <div><h2 className="display text-2xl">{tr('Brikker og kort fra jeres eget dørsystem')}</h2><p className="mt-1 text-sm text-slate">{tr('Har klubben allerede en kortlæser ved døren, bliver den ved med at virke: controlleren spørger RacketBuddy ved hvert tryk, og vi svarer ja eller nej ud fra bookinger, medlemskab og vagter. Brikkerne registreres her; vi gemmer kun et fingeraftryk af UID\'et.')}</p></div>

      <section className="card space-y-4">
        <h3 className="text-xl font-bold">{tr('Controllerens opslag')}</h3>
        <p className="text-sm text-slate">{tr('Sæt controlleren (eller integratorens middleware) til at kalde denne adresse med brikkens UID ved hvert tryk. Svaret er JSON med "allow": true eller false. Virker med alt, der kan kalde en URL: Wiegand-til-IP-moduler, Raspberry Pi, Paxton/Salto via middleware.')}</p>
        <div className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:items-center">
          <span className="font-semibold">URL</span><code className="select-all break-all rounded-lg bg-mist px-3 py-2">{checkUrl}</code>
          <span className="font-semibold">{tr('API-nøgle')}</span>
          <span className="flex flex-wrap items-center gap-2"><code className="select-all break-all rounded-lg bg-mist px-3 py-2">{showKey ? apiKey : apiKey.slice(0, 9) + '••••••••••••••••'}</code><button type="button" className="btn-ghost btn-sm" onClick={() => setShowKey((v) => !v)}>{showKey ? tr('Skjul') : tr('Vis')}</button><form action={rotateAccessKeyAction}><Pending className="text-xs font-semibold text-slate hover:text-[#a2401c]" onClick={(e) => { if (!confirm(tr('Den gamle nøgle holder op med at virke med det samme. Fortsæt?'))) e.preventDefault(); }}>{tr('Ny nøgle')}</Pending></form></span>
        </div>
        <details className="text-sm"><summary className="cursor-pointer font-semibold text-court">{tr('Eksempel')}</summary>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-ink p-3 text-xs text-chalk">{`POST ${checkUrl}\nAuthorization: Bearer ${showKey ? apiKey : 'rbak_…'}\nContent-Type: application/json\n\n{"credential":"04:A1:B2:C3","door":"Main entrance"}\n\n→ {"allow":true,"reason":"Booking in progress","name":"Ana Lopez","until":"2026-11-03T16:25:00.000Z"}\n\nGET ${checkUrl}?key=rbak_…&credential=04A1B2C3   (for controllers that can only GET)`}</pre>
        </details>
        <form action={taction} className="flex flex-wrap items-end gap-3 rounded-xl bg-mist p-4">
          <label className="label block flex-1">{tr('Prøv et UID')}<input className="input" name="uid" placeholder="04:A1:B2:C3" required /></label>
          <Pending className="btn-ghost">{tr('Test opslag')}</Pending>
          {tstate?.result && <p role="status" className={`w-full text-sm font-semibold ${tstate.result.allow ? 'text-success' : 'text-[#a2401c]'}`}>{tstate.result.allow ? tr('Adgang') : tr('Afvist')} · {tr(REASONS[tstate.result.code] ?? tstate.result.code)}{tstate.result.name ? ` · ${tstate.result.name}` : ''}</p>}
          {tstate?.error && <p role="alert" className="w-full text-sm font-semibold text-[#a2401c]">{tr(tstate.error)}</p>}
        </form>
      </section>

      <section className="card space-y-4">
        <h3 className="text-xl font-bold">{tr('Regler')}</h3>
        <form action={saction} className="grid gap-3 sm:grid-cols-4">
          <label className="label block">{tr('Minutter før booking')}<input className="input" name="beforeMinutes" type="number" min={0} max={120} defaultValue={settings.beforeMinutes} /></label>
          <label className="label block">{tr('Minutter efter booking')}<input className="input" name="afterMinutes" type="number" min={0} max={120} defaultValue={settings.afterMinutes} /></label>
          <label className="label block">{tr('Medlemmer fra kl.')}<input className="input" name="memberFromHour" type="number" min={0} max={23} defaultValue={settings.memberFromHour} /></label>
          <label className="label block">{tr('Medlemmer til kl.')}<input className="input" name="memberUntilHour" type="number" min={1} max={24} defaultValue={settings.memberUntilHour} /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" name="memberWithoutBooking" defaultChecked={settings.memberWithoutBooking} />{tr('Betalende medlemmer må komme ind uden booking i medlemstiden (fx til fitness, lounge eller walk-in)')}</label>
          <div className="flex items-center gap-3 sm:col-span-4"><Pending className="btn-court">{tr('Gem regler')}</Pending><Msg state={sstate} tr={tr} /></div>
        </form>
        <p className="text-xs text-slate">{tr('Ansattes brikker virker altid. Medlemmer lukkes ind i vinduet omkring deres egen bekræftede booking, og i medlemstiden hvis det er slået til.')}</p>
      </section>

      <section className="card space-y-4">
        <h3 className="text-xl font-bold">{tr('Brikker')} <span className="text-sm font-normal text-slate">({credentials.length})</span></h3>
        {credentials.length > 0 && (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate"><th className="py-2 pr-3">{tr('Indehaver')}</th><th className="py-2 pr-3">{tr('Brik')}</th><th className="py-2 pr-3">{tr('Sidst brugt')}</th><th className="py-2 pr-3">{tr('Gyldig til')}</th><th className="py-2"></th></tr></thead>
            <tbody className="divide-y divide-slate/10">{credentials.map((c) => (
              <tr key={c.id} className={c.active ? '' : 'text-slate'}>
                <td className="py-2 pr-3 font-semibold">{c.holder}<span className="ml-1 text-xs font-normal text-slate">· {c.holderKind === 'staff' ? tr('ansat') : tr('medlem')}</span></td>
                <td className="py-2 pr-3">{c.label ? `${c.label} · ` : ''}<span className="font-mono text-xs">{c.uidTail}</span>{!c.active && <span className="ml-1 text-xs">· {tr('deaktiveret')}</span>}</td>
                <td className="py-2 pr-3 text-slate">{c.lastUsedAt ? when(c.lastUsedAt) : '–'}</td>
                <td className="py-2 pr-3 text-slate">{c.validUntil ? date(c.validUntil, { month: 'short', day: 'numeric', year: 'numeric' }) : '–'}</td>
                <td className="py-2 text-right"><form action={credentialAction} className="inline-flex gap-3"><input type="hidden" name="credentialId" value={c.id} /><Pending name="intent" value={c.active ? 'deactivate' : 'activate'} className="text-xs font-semibold text-court">{c.active ? tr('Deaktivér') : tr('Aktivér')}</Pending><Pending name="intent" value="delete" className="text-xs font-semibold text-slate hover:text-[#a2401c]">{tr('Slet')}</Pending></form></td>
              </tr>))}</tbody>
          </table></div>
        )}
        <form action={caction} className="grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-6">
          <label className="label block sm:col-span-2">{tr('Hvem')}<Select className="input" name="who" value={who} onChange={(e: any) => setWho(e.target.value)}><option value="member">{tr('Medlem (via e-mail)')}</option>{staff.map((s) => <option key={s.id} value={`staff:${s.id}`}>{tr('Ansat')}: {s.name}</option>)}</Select></label>
          {who === 'member' && <label className="label block sm:col-span-2">{tr('Medlemmets e-mail')}<input className="input" name="email" type="email" required placeholder="member@example.com" /></label>}
          <label className="label block">{tr('UID')}<input className="input font-mono" name="uid" required placeholder="04:A1:B2:C3" /></label>
          <label className="label block">{tr('Type')}<Select className="input" name="kind" defaultValue="FOB"><option value="FOB">{tr('Brik')}</option><option value="CARD">{tr('Kort')}</option><option value="CODE">{tr('Kode')}</option><option value="PLATE">{tr('Nummerplade')}</option></Select></label>
          <label className="label block sm:col-span-2">{tr('Mærkat (valgfri)')}<input className="input" name="label" maxLength={60} placeholder={tr('fx Blå brik')} /></label>
          <label className="label block sm:col-span-2">{tr('Gyldig til (valgfri)')}<input className="input" name="validUntil" type="date" /></label>
          <div className="flex items-end gap-3 sm:col-span-2"><Pending className="btn-court">{tr('Registrér brik')}</Pending></div>
          <div className="sm:col-span-6"><Msg state={cstate} tr={tr} /></div>
        </form>
        <details><summary className="cursor-pointer text-sm font-semibold text-court">{tr('Importér fra jeres gamle system (CSV)')}</summary>
          <form action={iaction} className="mt-3 space-y-3">
            <p className="text-sm text-slate">{tr('Én linje pr. brik: e-mail, UID, mærkat. Eksportér listen fra jeres nuværende adgangssystem og indsæt den her. Medlemmer matches på e-mail.')}</p>
            <textarea className="input min-h-32 font-mono text-xs" name="csv" placeholder={'email,uid,label\nana@example.com,04:A1:B2:C3,Blue fob'} required />
            <div className="flex items-center gap-3"><Pending className="btn-ghost">{tr('Importér')}</Pending><Msg state={istate} tr={tr} /></div>
          </form>
        </details>
      </section>

      <section className="card space-y-4" id="kisi">
        <div><h3 className="text-xl font-bold">Kisi</h3><p className="mt-1 text-sm text-slate">{tr('Kører døren på Kisi, forbindes den her: spillere med en booking åbner døren fra appen i deres tidsvindue, og Kisi låser selv igen. Opret en API-nøgle i Kisi under Organization → API.')}</p></div>
        {settings.kisiConnected ? (
          <div className="space-y-3 text-sm">
            <p><span className="badge-success">{tr('forbundet')}</span>{settings.kisiPlaceName ? <span className="ml-2 text-slate">{settings.kisiPlaceName}</span> : null}{settings.kisiLockName ? <span className="ml-2">· {tr('Dør')}: <span className="font-semibold">{settings.kisiLockName}</span></span> : <span className="ml-2 text-[#a2401c]">· {tr('Vælg døren nedenfor')}</span>}</p>
            {kisiLocks.length > 0 && (
              <form action={kaction} className="flex flex-wrap items-end gap-3"><input type="hidden" name="intent" value="lock" />
                <label className="label block flex-1">{tr('Dør')}<Select className="input" name="lock" defaultValue={settings.kisiLockId ? `${settings.kisiLockId}|${settings.kisiLockName ?? ''}` : ''}><option value="" disabled>{tr('Vælg')}</option>{kisiLocks.map((l) => <option key={l.id} value={`${l.id}|${l.name}`}>{l.name}{l.online === false ? ' (offline)' : ''}</option>)}</Select></label>
                <Pending className="btn-court">{tr('Brug denne dør')}</Pending>
              </form>
            )}
            <form action={kaction}><input type="hidden" name="intent" value="disconnect" /><Pending className="text-xs font-semibold text-slate hover:text-[#a2401c]">{tr('Kobl Kisi fra')}</Pending></form>
          </div>
        ) : (
          <form action={kaction} className="flex flex-wrap items-end gap-3"><input type="hidden" name="intent" value="connect" />
            <label className="label block flex-1">{tr('Kisi API-nøgle')}<input className="input" name="apiKey" type="password" autoComplete="off" required /></label>
            <Pending className="btn-court">{tr('Forbind Kisi')}</Pending>
          </form>
        )}
        <Msg state={kstate} tr={tr} />
      </section>

      <section className="card space-y-3">
        <h3 className="text-xl font-bold">{tr('Seneste tryk ved døren')}</h3>
        {events.length === 0 ? <p className="text-sm text-slate">{tr('Ingen endnu.')}</p> : (
          <ul className="divide-y divide-slate/10 text-sm">{events.map((e) => <li key={e.id} className="flex flex-wrap items-center gap-3 py-2"><span className="w-32 shrink-0 text-slate">{when(e.at)}</span><span className={e.allowed ? 'badge-success' : 'badge-danger'}>{e.allowed ? tr('Adgang') : tr('Afvist')}</span><span className="min-w-0 flex-1 truncate">{e.who ?? <span className="font-mono text-xs">{e.uidTail}</span>} · {tr(REASONS[e.reason] ?? e.reason)}{e.door ? ` · ${e.door}` : ''}</span><span className="text-xs text-slate">{e.source}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
