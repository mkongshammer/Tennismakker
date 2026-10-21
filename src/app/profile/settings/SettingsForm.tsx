"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { PlaceInput } from "../../../components/ui/PlaceInput";
import { Select } from "../../../components/ui/Select";
import { Icon } from "../../../components/ui";
import { saveProfileSettings, type SettingsState } from "./actions";

type Props = {
  user: { name: string; email: string; phone: string | null; smsOptIn?: boolean; area: string | null; level: number; sports: string[]; bio: string | null };
  levels: { value: number; label: string }[];
  sports: { value: string; label: string }[];
};

function Save() {
  const { pending } = useFormStatus();
  return <button className="btn-court" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>;
}

export function SettingsForm({ user, levels, sports }: Props) {
  const [state, action] = useFormState<SettingsState, FormData>(saveProfileSettings, null);
  const [bio, setBio] = useState(user.bio ?? "");
  const err = (f: string) => (state?.field === f ? <p className="field-error" role="alert">{state.error}</p> : null);

  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-5">
        <h2 className="display text-xl">About you</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" defaultValue={user.name} autoComplete="name" required maxLength={60} />
            {err("name")}
          </div>
          <div>
            <label className="label" htmlFor="area">City or area</label>
            <PlaceInput id="area" name="area" defaultValue={user.area ?? ""} />
            {err("area") ?? <p className="hint">Used to show you courts, coaches and players nearby.</p>}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bio">About me <span className="font-normal text-slate">(optional)</span></label>
          <textarea className="input min-h-[96px]" id="bio" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} placeholder="e.g. Weekday evenings, love long rallies, looking for doubles partners." />
          {err("bio") ?? <p className="hint">{bio.length}/300 · shown on your player card</p>}
        </div>
      </section>

      <section className="card space-y-5">
        <h2 className="display text-xl">Your game</h2>
        <div>
          <label className="label" htmlFor="level">Level</label>
          <Select id="level" name="level" defaultValue={String(user.level)}>
            {levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
          {err("level") ?? <p className="hint">Players see this when you post a game or message them.</p>}
        </div>
        <fieldset>
          <legend className="label">Sports you play</legend>
          <div className="flex flex-wrap gap-2">
            {sports.map((s) => (
              <label key={s.value} className="cursor-pointer">
                <input type="checkbox" name="sports" value={s.value} defaultChecked={user.sports.includes(s.value)} className="peer sr-only" />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate/25 bg-chalk px-4 py-2 text-sm font-semibold transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-court">
                  {s.label}
                </span>
              </label>
            ))}
          </div>
          {err("sports")}
        </fieldset>
      </section>

      <section className="card space-y-5">
        <h2 className="display text-xl">Contact</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input bg-mist text-slate" id="email" value={user.email} readOnly aria-describedby="email-hint" />
            <p className="hint" id="email-hint">This is your login. Need to change it? Write to support@racketbuddy.app.</p>
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone <span className="font-normal text-slate">(optional)</span></label>
            <input className="input" id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" placeholder="(555) 123-4567" />
            {err("phone") ?? <p className="hint">Only shared with a club or coach you book.</p>}
            <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" name="smsOptIn" defaultChecked={user.smsOptIn} className="mt-1" /><span><span className="font-semibold">Text me a reminder before court bookings</span><br /><span className="text-slate">About two hours before, from clubs that offer it. Message rates may apply. Reply STOP any time.</span></span></label>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Save />
        {state?.ok && <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success" role="status"><Icon name="check" size={16} strokeWidth={2.4} />{state.ok}</p>}
        {state?.error && !state.field && <p className="text-sm font-semibold text-danger" role="alert">{state.error}</p>}
      </div>
    </form>
  );
}
