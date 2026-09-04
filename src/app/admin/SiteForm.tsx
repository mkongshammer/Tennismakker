"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { updateClubSite, createPost } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

export function SiteForm({ club }: { club: any }) {
  const [state, action] = useFormState(updateClubSite, null);
  const [locked, setLocked] = useState(Boolean(club.hasLock));

  return (
    <form action={action} className="card space-y-5">
      <div>
        <label className="label" htmlFor="tagline">Én linje om klubben</label>
        <input
          className="input"
          id="tagline"
          name="tagline"
          defaultValue={club.tagline ?? ""}
          placeholder="fx Fire grusbaner tæt på stationen. Alle er velkomne."
          maxLength={140}
        />
      </div>

      <div>
        <label className="label" htmlFor="about">Om klubben</label>
        <textarea
          className="input"
          id="about"
          name="about"
          rows={4}
          defaultValue={club.about ?? ""}
          placeholder="Historie, hold, træningstider, stemning."
        />
      </div>

      <div>
        <label className="label" htmlFor="membershipInfo">Kontingent og indmeldelse</label>
        <textarea
          className="input"
          id="membershipInfo"
          name="membershipInfo"
          rows={4}
          maxLength={2000}
          defaultValue={club.membershipInfo ?? ""}
          placeholder="fx Voksne 1.200 kr/år, juniorer 600 kr, familie 2.400 kr. Indmeldelse ved at skrive til kassereren."
        />
        <p className="mt-1 text-xs text-slate">Vises under &quot;Bliv medlem&quot;.</p>
      </div>

      <div>
        <label className="label" htmlFor="address">Adresse</label>
        <input
          className="input"
          id="address"
          name="address"
          defaultValue={club.address ?? ""}
          placeholder="Stadionvej 12, 4000 Roskilde"
        />
      </div>

      <div>
        <label className="label" htmlFor="practicalInfo">Praktisk</label>
        <textarea
          className="input"
          id="practicalInfo"
          name="practicalInfo"
          rows={4}
          defaultValue={club.practicalInfo ?? ""}
          placeholder="Hvordan kommer man ind? Er der omklædning? Hvor parkerer man?"
        />
        <p className="mt-1 text-xs text-slate">
          Det vigtigste for en gæst: hvordan kommer jeg ind på anlægget.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="contactEmail">Kontakt-e-mail</label>
          <input className="input" id="contactEmail" name="contactEmail" type="email" defaultValue={club.contactEmail ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="contactPhone">Telefon</label>
          <input className="input" id="contactPhone" name="contactPhone" defaultValue={club.contactPhone ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="priceHour">Gæstepris pr. time</label>
          <input className="input" id="priceHour" name="priceHour" type="number" min={0} defaultValue={club.priceHour} required />
        </div>
        <div>
          <label className="label" htmlFor="memberPriceHour">Medlemspris pr. time</label>
          <input
            className="input"
            id="memberPriceHour"
            name="memberPriceHour"
            type="number"
            min={0}
            defaultValue={club.memberPriceHour ?? ""}
            placeholder="Tom = samme som gæstepris"
          />
        </div>

      <div className="rounded-xl bg-mist p-4">
        <p className="font-bold">Medlemmernes vilkår</p>
        <p className="mt-1 text-sm text-slate">
          Sæt medlemsprisen til 0, hvis kontingentet dækker banetid. Så booker
          medlemmer uden at igennem en betaling — kun gæster betaler.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="memberWindowDays">
              Medlemmer booker (dage frem)
            </label>
            <input
              className="input"
              id="memberWindowDays"
              name="memberWindowDays"
              type="number"
              min={1}
              max={365}
              defaultValue={club.memberWindowDays}
            />
          </div>
          <div>
            <label className="label" htmlFor="memberMaxActive">
              Aktive bookinger pr. medlem
            </label>
            <input
              className="input"
              id="memberMaxActive"
              name="memberMaxActive"
              type="number"
              min={0}
              max={50}
              defaultValue={club.memberMaxActive}
            />
            <p className="mt-1 text-xs text-slate">0 = intet loft.</p>
          </div>
          <div>
            <label className="label" htmlFor="guestWindowDays">
              Gæster booker (dage frem)
            </label>
            <input
              className="input"
              id="guestWindowDays"
              name="guestWindowDays"
              type="number"
              min={1}
              max={365}
              defaultValue={club.guestWindowDays}
            />
          </div>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="openHour">Åbner kl.</label>
          <input className="input" id="openHour" name="openHour" type="number" min={0} max={23} defaultValue={club.openHour} />
        </div>
        <div>
          <label className="label" htmlFor="closeHour">Lukker kl.</label>
          <input className="input" id="closeHour" name="closeHour" type="number" min={1} max={24} defaultValue={club.closeHour} />
        </div>
        <div>
          <label className="label" htmlFor="color">Klubfarve</label>
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
            onChange={(e) => setLocked(e.target.checked)}
          />
          Anlægget er aflåst
        </label>
        <p className="mt-1 text-sm text-slate">
          Vises kun til gæster med en bekræftet booking — i kvitteringsmailen
          og på deres profil. Aldrig på den offentlige klubside.
        </p>

        {locked && (
          <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="accessCode">Kode</label>
              <input
                className="input data"
                id="accessCode"
                name="accessCode"
                defaultValue={club.accessCode ?? ""}
                placeholder="fx 4821"
              />
            </div>
            <div>
              <label className="label" htmlFor="accessInstructions">Vejledning</label>
              <textarea
                className="input"
                id="accessInstructions"
                name="accessInstructions"
                rows={2}
                defaultValue={club.accessInstructions ?? ""}
                placeholder="fx Koden virker fra 15 minutter før din tid. Indgang er bag hallen."
              />
            </div>
          </div>
        )}
      </div>

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
      <SubmitButton pendingText="Gemmer…">Gem siden</SubmitButton>
    </form>
  );
}

export function PostForm() {
  const [state, action] = useFormState(createPost, null);

  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="title">Overskrift</label>
        <input className="input" id="title" name="title" placeholder="fx Banerne er lukket lørdag" required />
      </div>
      <div>
        <label className="label" htmlFor="body">Tekst</label>
        <textarea className="input" id="body" name="body" rows={3} required />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="pinned" className="h-4 w-4" />
        Vis øverst
      </label>
      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
      <button className="btn-ghost">Slå op</button>
    </form>
  );
}
