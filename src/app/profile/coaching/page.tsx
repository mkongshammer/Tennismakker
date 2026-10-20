"use client";
import { PlaceInput } from "../../../components/ui/PlaceInput";
import { Select } from "../../../components/ui/Select";
import {UiText} from "../../../components/InternationalProvider";


import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { updateCoachProfile, startCoachPayoutSetup } from "./actions";
import { SubmitButton } from "../../../components/SubmitButton";
import { WeeklyCalendar } from "./WeeklyCalendar";
import { LESSON_LENGTHS, describeLength, lessonPriceKr } from "../../../lib/slots";
import {TIME_ZONES,formatMoney,usTimeZoneOptions} from "../../../lib/international";
import {useWebsiteInternational} from "../../../components/InternationalProvider";
import { DK_REGIONS, regionForArea } from "../../../lib/regions";
import { useSearchParams } from "next/navigation";
import { COACH_AGES, COACH_LEVELS } from "../../../lib/coach-facts";

// Enkel redigering af trænerprofil inkl. ugentlige ledige tider.
export default function TraenerProfilPage() {
  const {locale,tr}=useWebsiteInternational();
  const [state, action] = useFormState(updateCoachProfile, null);
  const [profile, setProfile] = useState<any>(null);
  // Længde og timepris styres af siden, så prisen pr. lektion og antallet af
  // lektioner i kalenderen kan opdatere sig, mens man skriver.
  const [lessonMinutes, setLessonMinutes] = useState(60);
  const [priceHour, setPriceHour] = useState(350);
  const searchParams = useSearchParams();

  useEffect(() => {
    async function load() {
      // Kommer træneren tilbage fra Stripe, genopfriskes status først, så
      // kortet nedenfor viser det rigtige med det samme.
      if (searchParams.get("stripe")) {
        await fetch("/api/me/coach/stripe-refresh", { method: "POST" }).catch(() => null);
      }
      const res = await fetch("/api/me/coach");
      const data = await res.json();
      setProfile(data);
      if (data?.lessonMinutes) setLessonMinutes(data.lessonMinutes);
      if (data?.priceHour) setPriceHour(data.priceHour);
    }
    load();
  }, [searchParams]);

  if (!profile) return <p className="text-slate"><UiText text="Henter…"/></p>;
  if (profile.error) return <p className="text-court font-semibold">{profile.error}</p>;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="display mb-6 text-3xl"><UiText text="Din trænerside"/></h1>

      <div className="card mb-4">
        <p className="font-bold"><UiText text="Udbetalinger"/></p>
        {profile.stripeChargesEnabled ? (
          <p className="mt-2 text-sm">
            <span className="font-bold text-court"><UiText text="Aktivt."/></span>{" "}<UiText text="Elever kan betale direkte til dig, minus vores andel."/></p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate"><UiText text="Du skal have en Stripe-konto, før elever kan booke og betale. Tager typisk 5-10 minutter."/></p>
            <form action={startCoachPayoutSetup} className="mt-3">
              <SubmitButton pendingText="Åbner Stripe…">
                {profile.stripeAccountId ? <UiText text="Fortsæt opsætning"/> : <UiText text="Sæt udbetalinger op"/>}
              </SubmitButton>
            </form>
          </>
        )}
      </div>

      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="headline"><UiText text="Overskrift"/></label>
          <input className="input" id="headline" name="headline" defaultValue={profile.headline} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="priceHour"><UiText text="Pris / time ("/>{profile.currency})</label>
            <input
              className="input"
              id="priceHour"
              name="priceHour"
              type="number"
              min={0}
              value={priceHour}
              onChange={(e) => setPriceHour(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="area">{profile.country==="US"?"City or area":<UiText text="Region"/>}</label>
            {profile.country==="DK"?<Select
              className="input"
              id="area"
              name="area"
              defaultValue={regionForArea(profile.area) ?? ""}
              required
            >
              <option value="" disabled><UiText text="Vælg region"/></option>
              {DK_REGIONS.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </Select>:<PlaceInput id="area" name="area" defaultValue={profile.area} required />}
          </div>
        </div>
        <label className="label block">{profile.country==="US"?"Time zone":tr("Lokal tidszone")}<Select className="input" name="timeZone" defaultValue={profile.timeZone}>{profile.country==="US"?usTimeZoneOptions(profile.timeZone).map(z=><option key={z.value} value={z.value}>{z.label}</option>):TIME_ZONES.map(z=><option key={z}>{z}</option>)}</Select></label>
        <div>
          <label className="label" htmlFor="lessonMinutes"><UiText text="Længden på én lektion"/></label>
          <Select
            className="input"
            id="lessonMinutes"
            name="lessonMinutes"
            value={lessonMinutes}
            onChange={(e) => setLessonMinutes(Number(e.target.value))}
          >
            {LESSON_LENGTHS.map((m) => (
              <option key={m} value={m}>{describeLength(m,locale)}</option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate"><UiText text="Eleven betaler"/>{" "}{formatMoney(lessonPriceKr(priceHour,lessonMinutes),profile.currency,locale)}{" "}<UiText text="for én lektion. Timeprisen er stadig den, du sammenlignes på i oversigten."/></p>
        </div>
        <div>
          <label className="label" htmlFor="specialties"><UiText text="Specialer (kommasepareret)"/></label>
          <input className="input" id="specialties" name="specialties" defaultValue={profile.specialties} placeholder={tr("Serv, Baghånd, Junior")} />
        </div>
        <fieldset className="space-y-4 rounded-2xl border border-slate/15 p-4">
          <legend className="px-1 text-sm font-bold">About your lessons</legend>
          <p className="-mt-1 text-xs text-slate">Shown on your public profile. Players can only message you after a paid lesson, so answer the usual questions here.</p>
          <div>
            <span className="label">Levels you teach</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {COACH_LEVELS.map((l) => (
                <label key={l.code} className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" name="levels" value={l.code} defaultChecked={String(profile.levels ?? "").split(",").includes(l.code)} />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Ages you teach</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {COACH_AGES.map((a) => (
                <label key={a.code} className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" name="ages" value={a.code} defaultChecked={String(profile.ages ?? "").split(",").includes(a.code)} />
                  {a.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="lessonPlace">Where lessons happen</label>
            <input className="input" id="lessonPlace" name="lessonPlace" maxLength={300} defaultValue={profile.lessonPlace ?? ""} placeholder="E.g. Public courts at Boston Common, or at your club" />
          </div>
          <div>
            <label className="label" htmlFor="whatToBring">What to bring</label>
            <input className="input" id="whatToBring" name="whatToBring" maxLength={300} defaultValue={profile.whatToBring ?? ""} placeholder="E.g. Racquet, water and court shoes. Balls provided." />
          </div>
        </fieldset>
        <div>
          <span className="label"><UiText text="Hvornår kan du tage elever?"/></span>
          <p className="mb-2 text-xs text-slate"><UiText text="Tiderne gentages hver uge. Eleverne kan kun booke de timer, du markerer her — og kun dem, der ikke allerede er booket."/></p>
          <p className="mb-3 text-sm">
            <a href="/profile/coaching/photo" className="font-semibold text-court underline"><UiText text="Sæt et billede på"/></a>
            <span className="text-slate"> · </span>
            <a href="/profile/coaching/packages" className="font-semibold text-court underline"><UiText text="Opret pakkeforløb"/></a>
          </p>
          <WeeklyCalendar
            name="weeklySlots"
            defaultValue={profile.weeklySlots}
            lessonMinutes={lessonMinutes}
          />
        </div>
        {state?.error && <p className="text-sm font-semibold text-court">{<UiText text={state.error}/>}</p>}
        <SubmitButton className="btn-court w-full" pendingText="Gemmer…"><UiText text="Gem profil"/></SubmitButton>
      </form>
    </div>
  );
}
