'use client';import { useWebsiteInternational } from "../../components/InternationalProvider";
import { useFormState } from 'react-dom';
import { setManualLight } from '../../lib/club-control-actions';
import { requestClubHardwareIntegration } from '../../lib/club-hardware-request-actions';
import { SubmitButton } from '../../components/SubmitButton';

export function ManualLights({ channels }: {channels: {id: string;label: string | null;}[];}) {
  const { tr } = useWebsiteInternational();
  const [state, action] = useFormState(setManualLight, null);
  const [requestState, requestAction] = useFormState(requestClubHardwareIntegration, null);

  return <div className="space-y-4">
    <section className="card space-y-3">
      <h2 className="display text-2xl">{tr("Tænd lys manuelt")}</h2>
      <p className="text-sm">{tr("Lyset kan tændes i en afgrænset periode. Derefter følger det igen bookingerne. “Automatik” slukker ikke lyset under en aktiv booking.")}</p>
      {channels.length ? <form action={action} className="flex flex-wrap gap-3">
        <select className="input" name="channelId" aria-label={tr("Lys")}>{channels.map((c) => <option key={c.id} value={c.id}>{c.label ?? tr("Lys")}</option>)}</select>
        <select className="input" name="minutes" aria-label={tr("Varighed")} defaultValue="30">{[15, 30, 60, 120].map((n) => <option key={n} value={n}>{n}{" " + tr("minutter")}</option>)}<option value="0">{tr("Automatik")}</option></select>
        <SubmitButton pendingText={tr("Sender…")}>{tr("Anvend")}</SubmitButton>
      </form> : <p>{tr("Færdiggør lysopsætningen nedenfor først.")}</p>}
      {state?.error && <p role="alert" className="text-sm text-red-800">{tr(state.error)}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court-dark">{tr(state.ok)}</p>}
    </section>

    <section className="card space-y-4">
      <div>
        <h2 className="display text-2xl">{tr("Har I en anden type lys eller udstyr?")}</h2>
        <p className="mt-1 text-sm text-slate">{tr("Hvis klubbens lys, adgangssystem eller andet udstyr ikke findes i opsætningen endnu, kan I sende det til os her. Vi undersøger integrationen og vender tilbage.")}</p>
      </div>
      <details className="rounded-xl border border-slate/15 p-4" open={Boolean(requestState?.error)}>
        <summary className="cursor-pointer font-semibold">{tr("Anmod om nyt udstyr / ny integration")}</summary>
        <form action={requestAction} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="hardware-category">{tr("Hvad vil I have tilføjet?")}</label>
            <select id="hardware-category" className="input" name="category" defaultValue="LIGHTING" required>
              <option value="LIGHTING">{tr("Anden type lys / lysstyring")}</option>
              <option value="ACCESS">{tr("Adgang, dør eller lås")}</option>
              <option value="HEATING">{tr("Varme, ventilation eller andet relæudstyr")}</option>
              <option value="SCOREBOARD">{tr("Scoreboard / display")}</option>
              <option value="OTHER">{tr("Andet udstyr")}</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="hardware-manufacturer">{tr("Producent eller system")}</label>
              <input id="hardware-manufacturer" className="input" name="manufacturer" maxLength={120} placeholder={tr("Fx Philips, KNX, Plejd, Schneider…")} />
            </div>
            <div>
              <label className="label" htmlFor="hardware-model">{tr("Model (hvis I kender den)")}</label>
              <input id="hardware-model" className="input" name="model" maxLength={120} placeholder={tr("Modelnavn eller nummer")} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="hardware-details">{tr("Beskriv udstyret og hvad I vil kunne styre")}</label>
            <textarea id="hardware-details" className="input" name="details" rows={4} minLength={10} maxLength={2000} required placeholder={tr("Fx: Vi har eksisterende LED-banelys styret af et KNX-system og vil have lyset til automatisk at følge bookingerne.")} />
          </div>
          <SubmitButton pendingText={tr("Sender anmodning…")}>{tr("Send anmodning")}</SubmitButton>
        </form>
        {requestState?.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{tr(requestState.error)}</p>}
        {requestState?.ok && <p className="mt-3 rounded-lg bg-court/10 p-3 text-sm font-semibold text-court-dark">{tr(requestState.ok)}</p>}
      </details>
    </section>
  </div>;
}
