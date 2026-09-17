"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "../../components/SubmitButton";
import { setupProgress } from "../../lib/club-control-setup";
import { connectControlSetup, saveSetupChannel, confirmSetupChannel, activateControlSetup,
  pauseControlSetup, testControlChannel, removeControlDevice, runControlNow } from "../../lib/club-control-actions";

type Court = { id: string; name: string };
type Channel = {
  id: string; channel: number; kind: string; label: string | null; courtId: string | null;
  lastState: boolean | null; lastCommandAt: string | null; lastError: string | null;
  setupTestedAt: string | null; setupConfirmedAt: string | null;
};
type Device = {
  id: string; name: string; externalId: string; model: string | null;
  channelCount: number; online: boolean | null; lastSeenAt: string | null; channels: Channel[];
};
export type ControlView = {
  enabled: boolean; serverUrl: string; hasAuthKey: boolean;
  accessBeforeMinutes: number; accessAfterMinutes: number; doorPulseSeconds: number;
  lightsBeforeMinutes: number; lightsAfterMinutes: number;
  lastCheckedAt: string | null; lastOkAt: string | null; lastError: string | null; devices: Device[];
} | null;

function Result({ state }: { state: { ok?: string; error?: string } | null }) {
  return <div aria-live="polite">{state?.error
    ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
    : state?.ok ? <p className="rounded-lg bg-court/10 p-3 text-sm text-court-dark">{state.ok}</p> : null}</div>;
}

function RelayStep({ device, number, saved, courts }: { device: Device; number: number; saved?: Channel; courts: Court[] }) {
  const [mapping, mapAction] = useFormState(saveSetupChannel, null);
  const [test, testAction] = useFormState(testControlChannel, null);
  const [confirmation, confirmAction] = useFormState(confirmSetupChannel, null);
  const [editing, setEditing] = useState(!saved);
  useEffect(() => { if (mapping?.ok) setEditing(false); }, [mapping]);
  const value = saved?.kind === "COURT_LIGHT" ? `COURT_LIGHT:${saved.courtId}` : saved?.kind ?? "";
  return <div className="space-y-4 rounded-2xl border border-slate/15 p-4 sm:p-6">
    <div><p className="text-xs text-slate">{device.name} · ID {device.externalId}</p>
      <h4 className="mt-1 text-xl font-bold">Relæ {number + 1}: {saved?.label ?? "Hvad er tilsluttet?"}</h4>
      <p className="mt-1 text-sm text-slate">Relæ {number + 1} svarer til kanal {number} i Shelly. Brug den kendte ledningsfordeling — gæt ikke.</p></div>
    {(editing || !saved) ? <form action={mapAction} className="space-y-3">
      <input type="hidden" name="deviceId" value={device.id} /><input type="hidden" name="channel" value={number} />
      <label className="label" htmlFor="relay-assignment">Hvad styrer dette relæ?</label>
      <select id="relay-assignment" name="assignment" className="input" defaultValue={value} required>
        <option value="" disabled>Vælg lys eller dør…</option>
        {courts.map(c => <option key={c.id} value={`COURT_LIGHT:${c.id}`}>Lys på {c.name}</option>)}
        <option value="COMMON_LIGHT">Gang / fælleslys</option><option value="DOOR">Dør</option>
        <option value="UNUSED">Intet tilsluttet — spring over</option>
      </select>
      {!courts.length && <p className="text-sm text-slate">Opret klubbens baner i administrationen først, hvis du vil vælge banelys.</p>}
      <SubmitButton pendingText="Gemmer…">Gem og fortsæt</SubmitButton><Result state={mapping} />
    </form> : <>
      <button type="button" className="text-sm font-semibold underline" onClick={() => setEditing(true)}>Forkert funktion? Vælg en anden</button>
      {saved.kind === "UNUSED" ? <p className="text-sm">Ikke tilsluttet. Dette relæ bliver ikke styret.</p> : saved.setupConfirmedAt ?
        <p className="rounded-xl bg-court/10 p-3 font-semibold text-court-dark">✓ Testet og bekræftet af klubben</p> : <>
        <form action={testAction} className="space-y-3">
          <input type="hidden" name="channelId" value={saved.id} />
          <p className="text-sm">Stå ved {saved.label?.toLowerCase() ?? "installationen"}. Testen aktiverer relæet i 3 sekunder med automatisk sluk på controlleren.</p>
          <label className="flex gap-3 rounded-lg bg-amber-50 p-3 text-sm">
            <input name="safeToTest" type="checkbox" required className="mt-1" />
            <span>Installationen er klar, og det er sikkert at teste nu. Jeg er på stedet og kan se resultatet.</span>
          </label>
          <SubmitButton pendingText="Sender test…">{saved.kind === "DOOR" ? "Test døren i 3 sekunder" : "Test lyset i 3 sekunder"}</SubmitButton><Result state={test} />
        </form>
        {saved.setupTestedAt && !saved.lastError && <form action={confirmAction} className="space-y-3 border-t border-slate/15 pt-4">
          <input type="hidden" name="channelId" value={saved.id} /><input type="hidden" name="testedAt" value={saved.setupTestedAt} />
          <p className="font-bold">Var det den rigtige funktion?</p>
          <label className="flex gap-3 text-sm"><input type="checkbox" name="observed" required className="mt-1" />
            <span>Ja, {saved.label?.toLowerCase()} reagerede korrekt, og lyset slukkede igen / døren kunne låse igen efter testen.</span></label>
          <SubmitButton pendingText="Bekræfter…">Ja, det virker</SubmitButton><Result state={confirmation} />
          <button type="button" className="block text-sm underline" onClick={() => setEditing(true)}>Nej, det var forkert — ret funktionen</button>
        </form>}
        {saved.lastError && <p role="alert" className="text-sm text-red-800">{saved.lastError} Kontrollér enheden i Shelly, og test igen.</p>}
      </>}
    </>}
  </div>;
}

export function ClubControlPanel({ control, courts }: { control: ControlView; courts: Court[] }) {
  const devices = control?.devices ?? [];
  const progress = setupProgress(devices);
  const connected = Boolean(control?.hasAuthKey && devices.length);
  const [step, setStep] = useState(connected ? progress.ready ? 3 : 2 : 1);
  const [selected, setSelected] = useState<string | null>(null);
  const [connection, connectAction] = useFormState(connectControlSetup, null);
  const [activation, activateAction] = useFormState(activateControlSetup, null);
  const [pause, pauseAction] = useFormState(pauseControlSetup, null);
  const [run, runAction] = useFormState(runControlNow, null);
  useEffect(() => { if (connection?.ok) setStep(2); }, [connection]);
  useEffect(() => { if (pause?.ok) setStep(progress.ready ? 3 : 2); }, [pause, progress.ready]);
  useEffect(() => { if (!connected) setStep(1); }, [connected]);
  const relays = devices.flatMap(device => Array.from({ length: device.channelCount }, (_, number) => ({
    key: `${device.id}-${number}`, device, number, saved: device.channels.find(c => c.channel === number),
  })));
  const current = relays.find(r => r.key === selected) ?? relays.find(r => !r.saved?.setupConfirmedAt) ?? relays[0];
  return <div id="lys-og-adgang" className="space-y-5">
    <div className="rounded-2xl bg-mist p-5">
      <p className="text-xl font-bold">{control?.enabled ? "Lys og adgang er aktiveret" : "Gør klubben klar — ét trin ad gangen"}</p>
      <p className="mt-2 text-sm text-slate">{control?.enabled ? "Lys følger bookingerne. Spillere kan åbne døren i klubbens adgangsvindue."
        : "Forbind controllerne, test hvad de styrer, og aktivér. Du kan lukke siden og fortsætte senere — gemte trin huskes."}</p>
    </div>
    {control?.enabled ? <div className="space-y-4 rounded-2xl border border-court/25 p-5">
      <p className="font-semibold">✓ {devices.length} controller(e) · {progress.active} tilsluttede relæer</p>
      <p className="text-sm">Lys: {control.lightsBeforeMinutes} min. før → {control.lightsAfterMinutes} min. efter. Dør: {control.accessBeforeMinutes} min. før → {control.accessAfterMinutes} min. efter.</p>
      <p className="text-sm text-slate">Seneste kontrol: {control.lastCheckedAt ? new Date(control.lastCheckedAt).toLocaleString("da-DK") : "Afventer minutjobbet"}</p>
      {control.lastError && <p role="alert" className="text-red-800">{control.lastError}</p>}
      <form action={runAction}><SubmitButton pendingText="Kontrollerer…">Kontrollér forbindelsen nu</SubmitButton><Result state={run} /></form>
      <form action={pauseAction} className="space-y-2 border-t border-slate/15 pt-4">
        <p className="text-sm text-slate">Pause stopper automatikken og appens dørknap, men slukker ikke lys, der allerede er tændt.</p>
        <SubmitButton className="btn-ghost" pendingText="Sætter på pause…">Pause / ret opsætning</SubmitButton>
      </form><Result state={activation} />
    </div> : <>
      <nav aria-label="Opsætningstrin" className="grid grid-cols-3 gap-2">
        {["Forbind", "Test relæer", "Aktivér"].map((label, index) => <button type="button" key={label}
          aria-current={step === index + 1 ? "step" : undefined} disabled={index === 1 ? !connected : index === 2 ? !progress.ready : false}
          onClick={() => setStep(index + 1)} className={`rounded-xl p-3 text-sm font-bold disabled:opacity-40 ${step === index + 1 ? "bg-court text-white" : "bg-mist"}`}>
          {index + 1}. {label}</button>)}
      </nav><Result state={pause} />
      {step === 1 && <form action={connectAction} className="space-y-5 rounded-2xl border border-slate/15 p-5">
        <div><h3 className="text-xl font-bold">1. Forbind til Shelly</h3>
          <p className="mt-2 text-sm text-slate">Controllerne skal være monteret og vise Online i Shelly Smart Control. Her kopierer du kun oplysninger — intet lys tændes.</p>
          <a href="https://control.shelly.cloud" target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold underline">Åbn Shelly i en ny fane ↗</a></div>
        <div className="rounded-xl bg-mist p-4 text-sm"><p className="font-bold">Find de to første felter samme sted</p>
          <p className="mt-1">Shelly → User settings (brugerindstillinger) → Authorization cloud key. Kopiér Server URI og Authorization Cloud Key nedenfor.</p></div>
        <div><label className="label" htmlFor="setup-server">Serveradresse (Server URI)</label>
          <input id="setup-server" name="serverUrl" className="input" defaultValue={control?.serverUrl ?? ""} placeholder="https://shelly-xx-eu.shelly.cloud" autoCapitalize="none" autoCorrect="off" required /></div>
        <div><label className="label" htmlFor="setup-key">Adgangsnøgle (Authorization Cloud Key)</label>
          <input id="setup-key" name="authKey" className="input" type="password" autoComplete="off" required={!control?.hasAuthKey}
            placeholder={control?.hasAuthKey ? "Gemt sikkert — lad feltet stå tomt" : "Indsæt hele nøglen fra Shelly"} />
          <p className="mt-1 text-xs text-slate">Nøglen kan styre enhederne på din Shelly-konto. Den gemmes krypteret på serveren, aldrig i spillerappen. Send den ikke i e-mail.</p></div>
        <div><label className="label" htmlFor="setup-ids">Hvilke controllere skal klubben bruge?</label>
          <p id="ids-help" className="mb-2 text-sm text-slate">Åbn hver controller i Shelly → Settings → Device Information → Device Id. Indsæt ét ID pr. linje. Vi henter selv relæerne.</p>
          <textarea id="setup-ids" name="deviceIds" aria-describedby="ids-help" className="input" rows={3} required autoCapitalize="none" autoCorrect="off"
            defaultValue={devices.map(d => d.externalId).join("\n")} placeholder={"ID for første controller\nID for anden controller"} /></div>
        <Result state={connection} /><SubmitButton pendingText="Kontakter Shelly og finder relæer…">Forbind og hent relæer</SubmitButton>
        {connected && <button type="button" className="ml-3 text-sm underline" onClick={() => setStep(2)}>Fortsæt med gemt forbindelse</button>}
      </form>}
      {step === 2 && <div className="space-y-4">
        <div><h3 className="text-xl font-bold">2. Hvad styrer relæerne?</h3><p className="mt-1 text-sm text-slate">{progress.completed} af {progress.total} gennemgået. Test kun, når du er fysisk på stedet.</p>
          <progress aria-label="Gennemgåede relæer" className="mt-3 h-2 w-full accent-green-700" max={progress.total || 1} value={progress.completed} /></div>
        <div className="flex flex-wrap gap-2">{relays.map(r => <button key={r.key} type="button" onClick={() => setSelected(r.key)}
          aria-pressed={current?.key === r.key} className={`rounded-lg border px-3 py-2 text-sm ${current?.key === r.key ? "border-court bg-court/10" : "border-slate/15"}`}>
          {r.saved?.setupConfirmedAt ? "✓ " : ""}{r.device.name} · {r.number + 1}</button>)}</div>
        {current && <RelayStep key={current.key} device={current.device} number={current.number} saved={current.saved} courts={courts} />}
        {current?.saved?.setupConfirmedAt && !progress.ready && <button type="button" className="btn-court" onClick={() => setSelected(null)}>Fortsæt til næste relæ</button>}
        {progress.ready && <button type="button" onClick={() => setStep(3)} className="btn-court">Alle relæer klar — fortsæt</button>}
        {progress.completed === progress.total && !progress.active && <p role="alert" className="text-sm">Alle relæer er sprunget over. Vælg mindst ét lys eller én dør for at aktivere.</p>}
      </div>}
      {step === 3 && <form action={activateAction} className="space-y-5 rounded-2xl border border-slate/15 p-5">
        <div><h3 className="text-xl font-bold">3. Klar til at aktivere</h3><p className="mt-2 text-sm text-slate">Kontrollér oversigten én sidste gang. Alle tilsluttede relæer skal være testet og bekræftet af klubben.</p></div>
        <ul className="space-y-2 text-sm">{relays.map(r => <li key={r.key}>{r.saved?.setupConfirmedAt ? "✓" : "Afventer"} {r.device.name}, relæ {r.number + 1} → {r.saved?.label ?? "Vælg funktion"}</li>)}</ul>
        <div className="rounded-xl bg-mist p-4 text-sm"><p className="font-bold">Udgangspunkt for tider</p>
          <p className="mt-1">Lys tænder {control?.lightsBeforeMinutes ?? 10} min. før og slukker {control?.lightsAfterMinutes ?? 5} min. efter bookingen.</p>
          <p>Døren kan åbnes {control?.accessBeforeMinutes ?? 15} min. før og indtil {control?.accessAfterMinutes ?? 15} min. efter.</p>
          <p className="mt-2 text-xs">Tiderne kan ændres nedenfor. Lys kontrolleres hvert minut. Døråbning kræver spillerens egen bekræftede banebooking.</p></div>
        <details><summary className="cursor-pointer text-sm font-semibold underline">Tilpas tider (valgfrit)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">{([
            ["lightsBeforeMinutes", "Lys før (min.)", 10, 0, 120], ["lightsAfterMinutes", "Lys efter (min.)", 5, 0, 120],
            ["accessBeforeMinutes", "Dør før (min.)", 15, 0, 120], ["accessAfterMinutes", "Dør efter (min.)", 15, 0, 120],
            ["doorPulseSeconds", "Dørpuls (sek.)", 5, 1, 30],
          ] as const).map(([name, label, fallback, min, max]) => <div key={name}><label className="label" htmlFor={name}>{label}</label>
            <input id={name} name={name} className="input" type="number" min={min} max={max} required defaultValue={control?.[name] ?? fallback} /></div>)}</div>
        </details>
        <label className="flex gap-3 text-sm"><input type="checkbox" name="ready" required className="mt-1" />
          <span>Fordelingen er korrekt. Jeg har kontrolleret installationen og har en manuel adgangsmulighed, hvis internet eller strøm svigter.</span></label>
        <Result state={activation} /><SubmitButton pendingText="Kontrollerer forbindelsen og aktiverer…">Aktivér lys og adgang</SubmitButton>
      </form>}
      {devices.length > 0 && <details className="rounded-xl border border-slate/15 p-4"><summary className="cursor-pointer text-sm font-semibold">Controlleroversigt / fjern en controller</summary>
        <p className="my-3 text-xs text-slate">Fjern kun en controller, klubben ikke længere skal bruge. Dens relæopsætning slettes.</p>
        {devices.map(d => <form key={d.id} action={removeControlDevice} className="my-3 flex flex-wrap items-center justify-between gap-2" onSubmit={e => { if (!window.confirm(`Fjern ${d.name} og dens relæopsætning?`)) e.preventDefault(); }}>
          <input type="hidden" name="deviceId" value={d.id} /><span className="text-sm">{d.name} · {d.externalId} · {d.channelCount} relæer</span>
          <SubmitButton className="btn-ghost text-sm" pendingText="Fjerner…">Fjern controller</SubmitButton></form>)}
      </details>}
    </>}
    <p className="text-xs text-slate">Guiden konfigurerer softwaren. Den kontrollerer ikke ledningsføringen eller installationens elektriske sikkerhed.</p>
  </div>;
}
