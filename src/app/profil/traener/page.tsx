"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { updateCoachProfile } from "../../../lib/actions";

// Enkel redigering af trænerprofil inkl. ugentlige ledige tider.
export default function TraenerProfilPage() {
  const [state, action] = useFormState(updateCoachProfile, null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch("/api/me/coach").then((r) => r.json()).then(setProfile);
  }, []);

  if (!profile) return <p className="text-slate/60">Henter…</p>;
  if (profile.error) return <p className="text-court font-semibold">{profile.error}</p>;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display mb-6 text-3xl">Trænerprofil</h1>
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="headline">Overskrift</label>
          <input className="input" id="headline" name="headline" defaultValue={profile.headline} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="priceHour">Pris (kr/time)</label>
            <input className="input" id="priceHour" name="priceHour" type="number" min={0} defaultValue={profile.priceHour} required />
          </div>
          <div>
            <label className="label" htmlFor="area">Område</label>
            <input className="input" id="area" name="area" defaultValue={profile.area} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="specialties">Specialer (kommasepareret)</label>
          <input className="input" id="specialties" name="specialties" defaultValue={profile.specialties} placeholder="Serv, Baghånd, Junior" />
        </div>
        <div>
          <label className="label" htmlFor="weeklySlots">Ugentlige ledige tider (JSON)</label>
          <textarea className="input font-mono text-sm" id="weeklySlots" name="weeklySlots" rows={3} defaultValue={profile.weeklySlots} />
          <p className="mt-1 text-xs text-slate/50">
            {'Format: [{"day":2,"from":16,"to":20}] — day: 0=søndag … 6=lørdag. Her: tirsdage 16-20.'}
          </p>
        </div>
        {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
        <button className="btn-court w-full">Gem profil</button>
      </form>
    </div>
  );
}
