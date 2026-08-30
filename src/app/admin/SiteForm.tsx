"use client";

import { useFormState } from "react-dom";
import { updateClubSite, createPost } from "../../lib/actions";

export function SiteForm({ club }: { club: any }) {
  const [state, action] = useFormState(updateClubSite, null);

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

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
      <button className="btn-court">Gem siden</button>
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
