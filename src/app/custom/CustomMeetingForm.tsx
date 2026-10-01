"use client";

import { useFormState } from "react-dom";
import { requestCustomMeeting } from "./actions";
import { phrase } from "../../lib/phrases";
import type { Locale } from "../../lib/sports";
import { SubmitButton } from "../../components/SubmitButton";

const SERVICES = [
  ["Booking system", "Booking system"],
  ["Hjemmeside", "Hjemmeside"],
  ["Lysstyring", "Lysstyring"],
  ["Adgangskontrol", "Adgangskontrol"],
  ["Kontingent og betaling", "Kontingent og betaling"],
  ["Integration til eksisterende system", "Integration til eksisterende system"],
  ["Andet", "Andet"],
];

export function CustomMeetingForm({ locale }: { locale: Locale }) {
  const tr = (value: string) => phrase(value, locale);
  const [state, action] = useFormState(requestCustomMeeting, null);

  if (state?.ok) {
    return (
      <div className="card border border-court/20 bg-court/5">
        <p className="display text-2xl">{tr("Mødet er på vej")}</p>
        <p className="mt-2 text-sm text-slate">{tr(state.ok)}</p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="clubName">{tr("Klub eller virksomhed")}</label>
          <input className="input" id="clubName" name="clubName" required />
        </div>
        <div>
          <label className="label" htmlFor="contactName">{tr("Dit navn")}</label>
          <input className="input" id="contactName" name="contactName" required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">{tr("E-mail")}</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">{tr("Telefon")}</label>
          <input className="input" id="phone" name="phone" type="tel" />
        </div>
      </div>

      <div>
        <span className="label">{tr("Hvad vil I gerne have bygget?")}</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SERVICES.map(([value, label]) => (
            <label key={value} className="flex items-center gap-3 rounded-xl border border-slate/10 px-3 py-3 text-sm">
              <input type="checkbox" name="services" value={value} />
              <span>{tr(label)}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="preferredTime">{tr("Hvornår passer et møde bedst?")}</label>
        <input
          className="input"
          id="preferredTime"
          name="preferredTime"
          placeholder={tr("Fx tirsdag efter kl. 16 eller fredag formiddag")}
        />
      </div>

      <div>
        <label className="label" htmlFor="message">{tr("Fortæl kort om jeres behov")}</label>
        <textarea
          className="input"
          id="message"
          name="message"
          rows={5}
          placeholder={tr("Fx 6 tennisbaner, eksisterende lysanlæg og ønske om booking, betaling og automatisk lysstyring i én løsning.")}
        />
      </div>

      {state?.error && <p className="text-sm font-semibold text-court-dark">{tr(state.error)}</p>}

      <SubmitButton className="btn-court w-full sm:w-auto" pendingText={tr("Sender forespørgsel…")}>{tr("Book et møde")}</SubmitButton>
      <p className="text-xs text-slate">{tr("Det er uforpligtende. Vi kontakter jer for at bekræfte tidspunktet.")}</p>
    </form>
  );
}
