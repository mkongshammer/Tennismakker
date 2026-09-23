'use client';
import {useFormState} from 'react-dom';
import {setManualLight} from '../../lib/club-control-actions';
import {SubmitButton} from '../../components/SubmitButton';
export function ManualLights({channels}:{channels:{id:string;label:string|null}[]}) {
 const [state,action]=useFormState(setManualLight,null);
 return <section className="card space-y-3"><h2 className="display text-2xl">Tænd lys manuelt</h2><p className="text-sm">Lyset kan tændes i en afgrænset periode. Derefter følger det igen bookingerne. “Automatik” slukker ikke lyset under en aktiv booking.</p>{channels.length?<form action={action} className="flex flex-wrap gap-3"><select className="input" name="channelId" aria-label="Lys">{channels.map(c=><option key={c.id} value={c.id}>{c.label??'Lys'}</option>)}</select><select className="input" name="minutes" aria-label="Varighed" defaultValue="30">{[15,30,60,120].map(n=><option key={n} value={n}>{n} minutter</option>)}<option value="0">Automatik</option></select><SubmitButton pendingText="Sender…">Anvend</SubmitButton></form>:<p>Færdiggør lysopsætningen nedenfor først.</p>}{state?.error&&<p role="alert">{state.error}</p>}{state?.ok&&<p>{state.ok}</p>}</section>;
}
