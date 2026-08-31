"use client";

// Kontaktformular — klubben kan ikke længere oprette sig selv.
//
// En klub der bare kunne oprette sig selv med hvilke som helst oplysninger
// var netop det, den manuelle godkendelse skulle beskytte imod. Nu er
// oprettelsen slet ikke tilgængelig udefra: klubben sender en henvendelse,
// og platformens ejer opretter den fulde profil personligt fra /superadmin.
//
// DetectStep (systemgenkendelse) er bevaret — den er stadig nyttig at vise
// klubben, selvom det er os, der opretter profilen bagefter.
import { useFormState } from "react-dom";
import { submitClubLead } from "../../lib/actions";
import { DetectStep } from "./DetectStep";
import { SubmitButton } from "../../components/SubmitButton";

export default function OpretKlubPage() {
  const [state, action] = useFormState(submitClubLead, null);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="display text-3xl">Få jeres klub på RacketBuddy</h1>
      <p className="mt-2 text-slate/70">
        I beholder jeres eget bookingsystem. Vi sætter jeres profil op sammen
        med jer — I skal bare skrive lidt om klubben herunder, så ringer vi.
      </p>

      <div className="mt-6">
        <DetectStep />
      </div>

      {state?.ok ? (
        <div className="card mt-4">
          <p className="display text-xl">Tak — vi har den</p>
          <p className="mt-2 text-sm text-slate">{state.ok}</p>
        </div>
      ) : (
        <form action={action} className="card mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="clubName">Klubbens navn</label>
              <input className="input" id="clubName" name="clubName" required />
            </div>
            <div>
              <label className="label" htmlFor="city">By</label>
              <input className="input" id="city" name="city" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="contactName">Dit navn</label>
              <input className="input" id="contactName" name="contactName" required />
            </div>
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input className="input" id="email" name="email" type="email" required />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="phone">Telefon (valgfrit)</label>
            <input className="input" id="phone" name="phone" type="tel" />
          </div>

          <div>
            <label className="label" htmlFor="message">Fortæl lidt om klubben</label>
            <textarea
              className="input"
              id="message"
              name="message"
              rows={3}
              placeholder="Antal baner, hvilket bookingsystem I bruger i dag, hvad I håber at få ud af det."
            />
          </div>

          {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
          <SubmitButton className="btn-court w-full" pendingText="Sender…">Send henvendelse</SubmitButton>
          <p className="text-center text-xs text-slate/50">
            Ved henvendelse accepterer du vores{" "}
            <a href="/vilkaar" className="underline">handelsbetingelser</a> og{" "}
            <a href="/databehandleraftale" className="underline">databehandleraftale</a>.
          </p>
        </form>
      )}
    </div>
  );
}
