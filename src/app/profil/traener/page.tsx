"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { updateCoachProfile, startCoachPayoutSetup } from "../../../lib/actions";
import { SubmitButton } from "../../../components/SubmitButton";
import { WeeklyCalendar } from "./WeeklyCalendar";
import { useSearchParams } from "next/navigation";

// Enkel redigering af trænerprofil inkl. ugentlige ledige tider.
export default function TraenerProfilPage() {
  const [state, action] = useFormState(updateCoachProfile, null);
  const [profile, setProfile] = useState<any>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    async function load() {
      // Kommer træneren tilbage fra Stripe, genopfriskes status først, så
      // kortet nedenfor viser det rigtige med det samme.
      if (searchParams.get("stripe")) {
        await fetch("/api/me/coach/stripe-refresh", { method: "POST" }).catch(() => null);
      }
      const res = await fetch("/api/me/coach");
      setProfile(await res.json());
    }
    load();
  }, [searchParams]);

  if (!profile) return <p className="text-slate/60">Henter…</p>;
  if (profile.error) return <p className="text-court font-semibold">{profile.error}</p>;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display mb-6 text-3xl">Trænerprofil</h1>

      <div className="card mb-4">
        <p className="font-bold">Udbetalinger</p>
        {profile.stripeChargesEnabled ? (
          <p className="mt-2 text-sm">
            <span className="font-bold text-court">Aktivt.</span> Elever kan betale
            direkte til dig, minus vores andel.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate">
              Du skal have en Stripe-konto, før elever kan booke og betale.
              Tager typisk 5-10 minutter.
            </p>
            <form action={startCoachPayoutSetup} className="mt-3">
              <SubmitButton pendingText="Åbner Stripe…">
                {profile.stripeAccountId ? "Fortsæt opsætning" : "Sæt udbetalinger op"}
              </SubmitButton>
            </form>
          </>
        )}
      </div>

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
          <span className="label">Hvornår kan du tage elever?</span>
          <p className="mb-2 text-xs text-slate">
            Tiderne gentages hver uge. Eleverne kan kun booke de timer, du
            markerer her — og kun dem, der ikke allerede er booket.
          </p>
          <WeeklyCalendar name="weeklySlots" defaultValue={profile.weeklySlots} />
        </div>
        {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
        <SubmitButton className="btn-court w-full" pendingText="Gemmer…">Gem profil</SubmitButton>
      </form>
    </div>
  );
}
