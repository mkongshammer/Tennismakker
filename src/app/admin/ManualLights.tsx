'use client';import { useWebsiteInternational } from "../../components/InternationalProvider";
import { useFormState } from 'react-dom';
import { setManualLight } from '../../lib/club-control-actions';
import { SubmitButton } from '../../components/SubmitButton';
export function ManualLights({ channels }: {channels: {id: string;label: string | null;}[];}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(setManualLight, null);
  return <section className="card space-y-3"><h2 className="display text-2xl">{tr("T\xE6nd lys manuelt")}</h2><p className="text-sm">{tr("Lyset kan t\xE6ndes i en afgr\xE6nset periode. Derefter f\xF8lger det igen bookingerne. \u201CAutomatik\u201D slukker ikke lyset under en aktiv booking.")}</p>{channels.length ? <form action={action} className="flex flex-wrap gap-3"><select className="input" name="channelId" aria-label="Lys">{channels.map((c) => <option key={c.id} value={c.id}>{c.label ?? 'Lys'}</option>)}</select><select className="input" name="minutes" aria-label="Varighed" defaultValue="30">{[15, 30, 60, 120].map((n) => <option key={n} value={n}>{n}{" " + tr("minutter")}</option>)}<option value="0">{tr("Automatik")}</option></select><SubmitButton pendingText={tr("Sender\u2026")}>{tr("Anvend")}</SubmitButton></form> : <p>{tr("F\xE6rdigg\xF8r lysops\xE6tningen nedenfor f\xF8rst.")}</p>}{state?.error && <p role="alert">{state.error}</p>}{state?.ok && <p>{state.ok}</p>}</section>;
}
