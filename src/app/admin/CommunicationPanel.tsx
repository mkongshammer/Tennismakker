'use client';
// Member e-mails: write once, reach everyone. The history underneath is
// the club's own record of what was said and when.
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { Select } from '../../components/ui/Select';
import { saveSmsSetting, sendBroadcastAction } from '../../lib/communication-actions';

type Past = { id: string; subject: string; body: string; audience: string; sentCount: number; createdAt: Date };

function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return <button {...rest} disabled={pending} aria-busy={pending}>{children}</button>;
}

export function CommunicationPanel({ counts, history, smsReminders, smsReady }: { counts: { all: number; paid: number }; history: Past[]; smsReminders: boolean; smsReady: boolean }) {
  const { tr, date } = useWebsiteInternational();
  const [state, action] = useFormState(sendBroadcastAction, null);
  const [smsState, smsAction] = useFormState(saveSmsSetting, null);
  const [audience, setAudience] = useState<'ALL' | 'PAID'>('ALL');
  const n = audience === 'PAID' ? counts.paid : counts.all;
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="display text-2xl">{tr('Send en mail til medlemmerne')}</h2>
          <p className="mt-1 text-sm text-slate">{tr('Nyt om baner, hold, arrangementer eller lukkedage. Mailen sendes fra RacketBuddy med klubbens navn, og svar går til klubbens egen adresse.')}</p>
        </div>
        <form action={action} className="space-y-3">
          <label className="label block">{tr('Modtagere')}
            <Select name="audience" className="input" value={audience} onChange={(e: any) => setAudience(e.target.value)}>
              <option value="ALL">{tr('Alle medlemmer ({p0})', { p0: counts.all })}</option>
              <option value="PAID">{tr('Kun medlemmer med betalt kontingent ({p0})', { p0: counts.paid })}</option>
            </Select>
          </label>
          <label className="label block">{tr('Emne')}<input className="input" name="subject" maxLength={120} required placeholder={tr('fx Banerne er lukket lørdag')} /></label>
          <label className="label block">{tr('Besked')}<textarea className="input min-h-40" name="body" maxLength={5000} required placeholder={tr('Skriv som du ville skrive til ét medlem. Ingen formatering – bare tekst.')} /></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" className="mt-1" /><span>{tr('Send til {p0} medlemmer nu. Det kan ikke fortrydes.', { p0: n })}</span></label>
          <div className="flex items-center gap-3">
            <Pending className="btn-court">{tr('Send mail')}</Pending>
            {state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}
            {state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}
          </div>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="display text-2xl">{tr('Sms-påmindelser')}</h2>
        <p className="text-sm text-slate">{tr('Medlemmer, der har sagt ja til sms på deres profil, får en sms cirka to timer før en banebooking. Færre udeblivelser, ingen ekstra arbejde.')}</p>
        {!smsReady && <p className="rounded-xl bg-mist p-3 text-sm">{tr('Sms er ikke aktiveret på platformen endnu. Indstillingen gemmes, og påmindelserne starter, når det er.')}</p>}
        <form action={smsAction} className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="smsReminders" defaultChecked={smsReminders} />{tr('Send sms-påmindelser til klubbens medlemmer')}</label>
          <Pending className="btn-ghost">{tr('Gem')}</Pending>
          {smsState?.ok && <span className="text-sm font-semibold text-success">{tr(smsState.ok)}</span>}
          {smsState?.error && <span className="text-sm font-semibold text-[#a2401c]">{tr(smsState.error)}</span>}
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="display text-2xl">{tr('Sendte mails')}</h2>
        {history.length === 0 ? <p className="text-sm text-slate">{tr('Ingen mails sendt endnu.')}</p> : (
          <ul className="divide-y divide-slate/10">
            {history.map((h) => (
              <li key={h.id} className="py-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{h.subject}</span>
                    <span className="text-xs text-slate">{date(h.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })} · {tr('{p0} modtagere', { p0: h.sentCount })} · {h.audience === 'PAID' ? tr('betalende') : tr('alle')}</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate">{h.body}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
