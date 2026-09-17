"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "../../components/SubmitButton";
import {
  addControlDevice,
  refreshControlDevice,
  removeControlDevice,
  runControlNow,
  saveControlConnection,
  saveControlMappings,
  testControlChannel,
} from "../../lib/club-control-actions";

type Court = { id: string; name: string };
type Channel = {
  id: string;
  channel: number;
  kind: string;
  label: string | null;
  courtId: string | null;
  lastState: boolean | null;
  lastCommandAt: string | null;
  lastError: string | null;
};
type Device = {
  id: string;
  name: string;
  externalId: string;
  model: string | null;
  channelCount: number;
  online: boolean | null;
  lastSeenAt: string | null;
  channels: Channel[];
};
export type ControlView = {
  enabled: boolean;
  serverUrl: string;
  hasAuthKey: boolean;
  accessBeforeMinutes: number;
  accessAfterMinutes: number;
  doorPulseSeconds: number;
  lightsBeforeMinutes: number;
  lightsAfterMinutes: number;
  lastCheckedAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  devices: Device[];
} | null;

function Result({ state }: { state: { ok?: string; error?: string } | null }) {
  if (state?.error) {
    return <p className="text-sm font-semibold text-court-dark">{state.error}</p>;
  }
  if (state?.ok) return <p className="text-sm font-semibold text-court">{state.ok}</p>;
  return null;
}

function assignment(channel: Channel | undefined) {
  if (!channel) return "UNUSED";
  return channel.kind === "COURT_LIGHT" && channel.courtId
    ? `COURT_LIGHT:${channel.courtId}`
    : channel.kind;
}

function when(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function DeviceCard({ device, courts }: { device: Device; courts: Court[] }) {
  const [mappingState, mappingAction] = useFormState(saveControlMappings, null);
  const [testState, testAction] = useFormState(testControlChannel, null);

  return (
    <div className="rounded-xl border border-slate/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">{device.name}</p>
          <p className="text-xs text-slate">
            {device.model ?? "Shelly"} · {device.externalId} · {device.channelCount} kanaler
          </p>
          <p className={`mt-1 text-xs font-semibold ${device.online ? "text-court" : "text-court-dark"}`}>
            {device.online === null
              ? "Ikke testet"
              : device.online
                ? `Online${device.lastSeenAt ? ` · set ${when(device.lastSeenAt)}` : ""}`
                : "Offline"}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={refreshControlDevice}>
            <input type="hidden" name="deviceId" value={device.id} />
            <SubmitButton className="btn-ghost px-3 py-2 text-sm" pendingText="Tester…">
              Test forbindelse
            </SubmitButton>
          </form>
          <form action={removeControlDevice}>
            <input type="hidden" name="deviceId" value={device.id} />
            <SubmitButton className="btn-ghost px-3 py-2 text-sm" pendingText="Fjerner…">
              Fjern
            </SubmitButton>
          </form>
        </div>
      </div>

      <form action={mappingAction} className="mt-4 space-y-3">
        <input type="hidden" name="deviceId" value={device.id} />
        {Array.from({ length: device.channelCount }, (_, index) => {
          const saved = device.channels.find((channel) => channel.channel === index);
          return (
            <div
              key={index}
              className="grid gap-2 rounded-lg bg-mist p-3 sm:grid-cols-[6rem_1fr_1fr] sm:items-end"
            >
              <p className="pb-2 text-sm font-bold">Relæ {index + 1}</p>
              <div>
                <label className="label" htmlFor={`${device.id}-assignment-${index}`}>
                  Funktion
                </label>
                <select
                  className="input"
                  id={`${device.id}-assignment-${index}`}
                  name={`assignment_${index}`}
                  defaultValue={assignment(saved)}
                >
                  <option value="UNUSED">Ikke i brug</option>
                  {courts.map((court) => (
                    <option key={court.id} value={`COURT_LIGHT:${court.id}`}>
                      Lys · {court.name}
                    </option>
                  ))}
                  <option value="COMMON_LIGHT">Fælles-/ganglys</option>
                  <option value="DOOR">Dørlås</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`${device.id}-label-${index}`}>
                  Navn (valgfrit)
                </label>
                <input
                  className="input"
                  id={`${device.id}-label-${index}`}
                  name={`label_${index}`}
                  defaultValue={saved?.label ?? ""}
                  placeholder="fx Hoveddør eller Bane 1"
                />
              </div>
            </div>
          );
        })}
        <Result state={mappingState} />
        <SubmitButton pendingText="Gemmer kanaler…">Gem kanalfordeling</SubmitButton>
      </form>

      {device.channels.length > 0 && (
        <div className="mt-4 border-t border-slate/15 pt-4">
          <p className="text-sm font-bold">Fysisk test</p>
          <p className="mb-3 text-xs text-slate">
            Sørg for, at installationen er sikker. Testen aktiverer det valgte relæ i 3 sekunder.
          </p>
          <div className="flex flex-wrap gap-2">
            {device.channels.map((channel) => (
              <form action={testAction} key={channel.id}>
                <input type="hidden" name="channelId" value={channel.id} />
                <SubmitButton className="btn-ghost px-3 py-2 text-sm" pendingText="Tester…">
                  Test {channel.label ?? `relæ ${channel.channel + 1}`}
                </SubmitButton>
              </form>
            ))}
          </div>
          <Result state={testState} />
          {device.channels.some((channel) => channel.lastError) && (
            <ul className="mt-3 space-y-1 text-xs text-court-dark">
              {device.channels
                .filter((channel) => channel.lastError)
                .map((channel) => (
                  <li key={channel.id}>
                    {channel.label ?? `Relæ ${channel.channel + 1}`}: {channel.lastError}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
export function ClubControlPanel({
  control,
  courts,
}: {
  control: ControlView;
  courts: Court[];
}) {
  const [connectionState, connectionAction] = useFormState(saveControlConnection, null);
  const [deviceState, deviceAction] = useFormState(addControlDevice, null);
  const [runState, runAction] = useFormState(runControlNow, null);

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-mist p-4 text-sm">
        <p className="font-bold">Sådan sættes det op</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate">
          <li>Tilføj de to Shelly Pro 3-enheder i Shelly Smart Control.</li>
          <li>Hent Server URI og Authorization Cloud Key under brugerindstillinger.</li>
          <li>Tilføj begge Device ID&apos;er her og fordel de seks relæer.</li>
          <li>Test relæerne, og aktivér først derefter automatisk styring.</li>
        </ol>
        <p className="mt-2 text-xs text-slate-light">
          Cloud-nøglen krypteres og bliver kun på serveren. Mobilappen får aldrig adgang til den.
        </p>
      </div>

      <form action={connectionAction} className="space-y-4 rounded-xl border border-slate/15 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="shellyServerUrl">Shelly Server URI</label>
            <input
              className="input"
              id="shellyServerUrl"
              name="serverUrl"
              defaultValue={control?.serverUrl ?? ""}
              placeholder="https://shelly-xx-eu.shelly.cloud"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="shellyAuthKey">Authorization Cloud Key</label>
            <input
              className="input"
              id="shellyAuthKey"
              name="authKey"
              type="password"
              autoComplete="off"
              placeholder={control?.hasAuthKey ? "Lad stå tom for at beholde den gemte nøgle" : "Indsæt nøglen"}
              required={!control?.hasAuthKey}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          <div>
            <label className="label" htmlFor="lightsBeforeMinutes">Lys før (min.)</label>
            <input className="input" id="lightsBeforeMinutes" name="lightsBeforeMinutes" type="number" min="0" max="120" defaultValue={control?.lightsBeforeMinutes ?? 10} />
          </div>
          <div>
            <label className="label" htmlFor="lightsAfterMinutes">Lys efter (min.)</label>
            <input className="input" id="lightsAfterMinutes" name="lightsAfterMinutes" type="number" min="0" max="120" defaultValue={control?.lightsAfterMinutes ?? 5} />
          </div>
          <div>
            <label className="label" htmlFor="accessBeforeMinutes">Dør før (min.)</label>
            <input className="input" id="accessBeforeMinutes" name="accessBeforeMinutes" type="number" min="0" max="120" defaultValue={control?.accessBeforeMinutes ?? 15} />
          </div>
          <div>
            <label className="label" htmlFor="accessAfterMinutes">Dør efter (min.)</label>
            <input className="input" id="accessAfterMinutes" name="accessAfterMinutes" type="number" min="0" max="120" defaultValue={control?.accessAfterMinutes ?? 15} />
          </div>
          <div>
            <label className="label" htmlFor="doorPulseSeconds">Dørpuls (sek.)</label>
            <input className="input" id="doorPulseSeconds" name="doorPulseSeconds" type="number" min="1" max="30" defaultValue={control?.doorPulseSeconds ?? 5} />
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-court/25 bg-court/5 p-3 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={control?.enabled ?? false} className="mt-1" />
          <span>
            <span className="block font-bold">Aktivér automatisk lys og døråbning</span>
            <span className="text-slate">Aktivér først, når controllerne er monteret, fordelt og testet.</span>
          </span>
        </label>

        <Result state={connectionState} />
        <SubmitButton pendingText="Tester og gemmer…">Gem Shelly-forbindelse</SubmitButton>
      </form>

      {control && (
        <>
          <div className="rounded-xl border border-slate/15 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">
                  Status: {control.enabled ? "aktiv" : "ikke aktiveret"}
                </p>
                <p className="text-xs text-slate">
                  {control.lastCheckedAt
                    ? `Kontrolleret ${when(control.lastCheckedAt)}`
                    : "Automatikken er ikke kørt endnu."}
                  {control.lastOkAt ? ` · sidst OK ${when(control.lastOkAt)}` : ""}
                </p>
                {control.lastError && (
                  <p className="mt-1 text-sm font-semibold text-court-dark">{control.lastError}</p>
                )}
              </div>
              <form action={runAction}>
                <SubmitButton className="btn-ink" pendingText="Kontrollerer…">
                  Kør kontrol nu
                </SubmitButton>
              </form>
            </div>
            <Result state={runState} />
          </div>

          <div className="space-y-4">
            {control.devices.map((device) => (
              <DeviceCard key={device.id} device={device} courts={courts} />
            ))}
          </div>

          <form action={deviceAction} className="space-y-4 rounded-xl border border-slate/15 p-4">
            <p className="font-bold">Tilføj Shelly-controller</p>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
              <div>
                <label className="label" htmlFor="controlName">Navn</label>
                <input className="input" id="controlName" name="name" placeholder="fx Controller A" required />
              </div>
              <div>
                <label className="label" htmlFor="controlDeviceId">Device ID</label>
                <input className="input" id="controlDeviceId" name="externalId" autoCapitalize="none" autoCorrect="off" placeholder="fra Device Information" required />
              </div>
              <div>
                <label className="label" htmlFor="controlChannels">Relæer</label>
                <input className="input" id="controlChannels" name="channelCount" type="number" min="1" max="8" defaultValue="3" />
              </div>
              <SubmitButton pendingText="Tester…">Tilføj</SubmitButton>
            </div>
            <Result state={deviceState} />
          </form>
        </>
      )}
    </div>
  );
}
