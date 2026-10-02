"use client";import { useWebsiteInternational } from "../../components/InternationalProvider";

import { useState } from "react";
import { useFormState } from "react-dom";
import { updateClubSite, createPost } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

export function SiteForm({ club }: {club: any;}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(updateClubSite, null);
  const [locked, setLocked] = useState(Boolean(club.hasLock));

  return (
    <form action={action} className="card space-y-5">
      <div>
        <label className="label" htmlFor="tagline">{tr("\xC9n linje om klubben")}</label>
        <input
          className="input"
          id="tagline"
          name="tagline"
          defaultValue={club.tagline ?? ""}
          placeholder={tr("fx Spil, f\xE6llesskab og tr\xE6ning t\xE6t p\xE5 stationen.")}
          maxLength={140} />

      </div>

      <div>
        <label className="label" htmlFor="about">{tr("Om klubben")}</label>
        <textarea
          className="input"
          id="about"
          name="about"
          rows={4}
          defaultValue={club.about ?? ""}
          placeholder={tr("Historie, hold, tr\xE6ningstider, stemning.")} />

      </div>

      <div>
        <label className="label" htmlFor="membershipInfo">{tr("Kontingent og indmeldelse")}</label>
        <textarea
          className="input"
          id="membershipInfo"
          name="membershipInfo"
          rows={4}
          maxLength={2000}
          defaultValue={club.membershipInfo ?? ""}
          placeholder={tr("Beskriv jeres medlemstyper, priser i klubbens valuta og tilmelding.")} />

        <p className="mt-1 text-xs text-slate">{tr("Vises under \"Bliv medlem\".")}</p>
      </div>

      <div>
        <label className="label" htmlFor="address">{tr("Adresse")}</label>
        <input
          className="input"
          id="address"
          name="address"
          defaultValue={club.address ?? ""}
          placeholder={tr("Stadionvej 12, 4000 Roskilde")} />

      </div>

      <div>
        <label className="label" htmlFor="practicalInfo">{tr("Praktisk")}</label>
        <textarea
          className="input"
          id="practicalInfo"
          name="practicalInfo"
          rows={4}
          defaultValue={club.practicalInfo ?? ""}
          placeholder={tr("Hvordan kommer man ind? Er der omkl\xE6dning? Hvor parkerer man?")} />

        <p className="mt-1 text-xs text-slate">{tr("Det vigtigste for en g\xE6st: hvordan kommer jeg ind p\xE5 anl\xE6gget.")}

        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="contactEmail">{tr("Kontakt-e-mail")}</label>
          <input className="input" id="contactEmail" name="contactEmail" type="email" defaultValue={club.contactEmail ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="contactPhone">{tr("Telefon")}</label>
          <input className="input" id="contactPhone" name="contactPhone" defaultValue={club.contactPhone ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="priceHour">{tr("G\xE6stepris pr. time")}</label>
          <input className="input" id="priceHour" name="priceHour" type="number" min={0} defaultValue={club.priceHour} required />
        </div>
        <div>
          <label className="label" htmlFor="memberPriceHour">{tr("Medlemspris pr. time")}</label>
          <input
            className="input"
            id="memberPriceHour"
            name="memberPriceHour"
            type="number"
            min={0}
            defaultValue={club.memberPriceHour ?? ""}
            placeholder={tr("Tom = samme som g\xE6stepris")} />

        </div>

      <div className="rounded-xl bg-mist p-4">
        <p className="font-bold">{tr("Medlemmernes vilk\xE5r")}</p>
        <p className="mt-1 text-sm text-slate">{tr("S\xE6t medlemsprisen til 0, hvis kontingentet d\xE6kker banetid. S\xE5 booker medlemmer uden at igennem en betaling \u2014 kun g\xE6ster betaler.")}


          </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="memberWindowDays">{tr("Medlemmer booker (dage frem)")}

              </label>
            <input
                className="input"
                id="memberWindowDays"
                name="memberWindowDays"
                type="number"
                min={1}
                max={365}
                defaultValue={club.memberWindowDays} />

          </div>
          <div>
            <label className="label" htmlFor="memberMaxActive">{tr("Aktive bookinger pr. medlem")}

              </label>
            <input
                className="input"
                id="memberMaxActive"
                name="memberMaxActive"
                type="number"
                min={0}
                max={50}
                defaultValue={club.memberMaxActive} />

            <p className="mt-1 text-xs text-slate">{tr("0 = intet loft.")}</p>
          </div>
          <div>
            <label className="label" htmlFor="guestWindowDays">{tr("G\xE6ster booker (dage frem)")}

              </label>
            <input
                className="input"
                id="guestWindowDays"
                name="guestWindowDays"
                type="number"
                min={1}
                max={365}
                defaultValue={club.guestWindowDays} />

          </div>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="openHour">{tr("\xC5bner kl.")}</label>
          <input className="input" id="openHour" name="openHour" type="number" min={0} max={23} defaultValue={club.openHour} />
        </div>
        <div>
          <label className="label" htmlFor="closeHour">{tr("Lukker kl.")}</label>
          <input className="input" id="closeHour" name="closeHour" type="number" min={1} max={24} defaultValue={club.closeHour} />
        </div>
        <div>
          <label className="label" htmlFor="color">{tr("Klubfarve")}</label>
          <input className="input h-12 p-1" id="color" name="color" type="color" defaultValue={club.color} />
        </div>
      </div>

      <div className="border-t border-slate/10 pt-5">
        <label className="flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            name="hasLock"
            className="h-4 w-4"
            defaultChecked={club.hasLock}
            onChange={(e) => setLocked(e.target.checked)} />{tr("Anl\xE6gget er afl\xE5st")}


        </label>
        <p className="mt-1 text-sm text-slate">{tr("Vises kun til g\xE6ster med en bekr\xE6ftet booking \u2014 i kvitteringsmailen og p\xE5 deres profil. Aldrig p\xE5 den offentlige klubside.")}


        </p>

        {locked &&
        <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="accessCode">{tr("Kode")}</label>
              <input
              className="input data"
              id="accessCode"
              name="accessCode"
              defaultValue={club.accessCode ?? ""}
              placeholder={tr("fx 4821")} />

            </div>
            <div>
              <label className="label" htmlFor="accessInstructions">{tr("Vejledning")}</label>
              <textarea
              className="input"
              id="accessInstructions"
              name="accessInstructions"
              rows={2}
              defaultValue={club.accessInstructions ?? ""}
              placeholder={tr("fx Koden virker fra 15 minutter f\xF8r din tid. Indgang er bag hallen.")} />

            </div>
          </div>
        }
      </div>

      {state?.error && <p className="text-sm font-semibold text-court">{tr(state.error)}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{tr(state.ok)}</p>}
      <SubmitButton pendingText={tr("Gemmer\u2026")}>{tr("Gem siden")}</SubmitButton>
    </form>);

}

export function PostForm() {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(createPost, null);

  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="title">{tr("Overskrift")}</label>
        <input className="input" id="title" name="title" placeholder={tr("fx Banerne er lukket l\xF8rdag")} required />
      </div>
      <div>
        <label className="label" htmlFor="body">{tr("Tekst")}</label>
        <textarea className="input" id="body" name="body" rows={3} required />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="pinned" className="h-4 w-4" />{tr("Vis \xF8verst")}

      </label>
      {state?.error && <p className="text-sm font-semibold text-court">{tr(state.error)}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{tr(state.ok)}</p>}
      <button className="btn-ghost">{tr("Sl\xE5 op")}</button>
    </form>);

}
