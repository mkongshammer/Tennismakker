'use client';
import { useWebsiteInternational } from "../../components/InternationalProvider";
import { useFormState } from 'react-dom';
import { setManualLight } from '../../lib/club-control-actions';
import { requestClubHardwareIntegration } from '../../lib/club-hardware-request-actions';
import { SubmitButton } from '../../components/SubmitButton';

type HardwareRequestState = {
  ok?: 'SENT';
  error?: 'UNAUTHORIZED' | 'INVALID_CATEGORY' | 'DETAILS_SHORT' | 'CLUB_NOT_FOUND';
} | null;

const REQUEST_FEEDBACK = {
  da: {
    unauthorized: 'Kun klubadministratorer kan sende en anmodning.', invalid: 'Vælg hvilken type udstyr det drejer sig om.', short: 'Beskriv kort hvilket udstyr I har, og hvad I gerne vil kunne styre.', missing: 'Klubben kunne ikke findes.', sent: 'Tak — anmodningen er sendt. Vi gennemgår udstyret og vender tilbage til klubbens kontaktmail.'
  },
  en: {
    unauthorized: 'Only club administrators can send a request.', invalid: 'Choose what type of equipment the request is about.', short: 'Briefly describe the equipment you have and what you want to control.', missing: 'The club could not be found.', sent: 'Thanks — your request has been sent. We will review the equipment and reply to the club contact email.'
  },
  'en-US': {
    unauthorized: 'Only club administrators can send a request.', invalid: 'Choose what type of equipment the request is about.', short: 'Briefly describe the equipment you have and what you want to control.', missing: 'The club could not be found.', sent: 'Thanks — your request has been sent. We will review the equipment and reply to the club contact email.'
  },
  de: {
    unauthorized: 'Nur Clubadministratoren können eine Anfrage senden.', invalid: 'Wählen Sie aus, um welche Art von Ausstattung es geht.', short: 'Beschreiben Sie kurz die vorhandene Ausstattung und was gesteuert werden soll.', missing: 'Der Club wurde nicht gefunden.', sent: 'Danke — Ihre Anfrage wurde gesendet. Wir prüfen die Ausstattung und antworten an die Kontakt-E-Mail des Clubs.'
  },
  sv: {
    unauthorized: 'Endast klubbadministratörer kan skicka en förfrågan.', invalid: 'Välj vilken typ av utrustning förfrågan gäller.', short: 'Beskriv kort vilken utrustning ni har och vad ni vill kunna styra.', missing: 'Klubben kunde inte hittas.', sent: 'Tack — förfrågan har skickats. Vi granskar utrustningen och svarar till klubbens kontaktmejl.'
  },
  no: {
    unauthorized: 'Kun klubbadministratorer kan sende en forespørsel.', invalid: 'Velg hvilken type utstyr forespørselen gjelder.', short: 'Beskriv kort hvilket utstyr dere har og hva dere ønsker å styre.', missing: 'Klubben kunne ikke finnes.', sent: 'Takk — forespørselen er sendt. Vi vurderer utstyret og svarer til klubbens kontakt-e-post.'
  },
  fr: {
    unauthorized: 'Seuls les administrateurs du club peuvent envoyer une demande.', invalid: 'Choisissez le type d’équipement concerné.', short: 'Décrivez brièvement votre équipement et ce que vous souhaitez contrôler.', missing: 'Le club est introuvable.', sent: 'Merci — votre demande a été envoyée. Nous examinerons l’équipement et répondrons à l’adresse e-mail du club.'
  },
  es: {
    unauthorized: 'Solo los administradores del club pueden enviar una solicitud.', invalid: 'Elige el tipo de equipo al que se refiere la solicitud.', short: 'Describe brevemente el equipo que tenéis y qué queréis controlar.', missing: 'No se pudo encontrar el club.', sent: 'Gracias — la solicitud se ha enviado. Revisaremos el equipo y responderemos al correo de contacto del club.'
  },
} as const;

export function ManualLights({ channels }: {channels: {id: string;label: string | null;}[];}) {
  const { tr, locale } = useWebsiteInternational();
  const [state, action] = useFormState(setManualLight, null);
  const [requestState, requestAction] = useFormState(requestClubHardwareIntegration, null as HardwareRequestState);
  const feedback = REQUEST_FEEDBACK[locale] ?? REQUEST_FEEDBACK.en;

  const requestError = requestState?.error === 'UNAUTHORIZED'
    ? feedback.unauthorized
    : requestState?.error === 'INVALID_CATEGORY'
      ? feedback.invalid
      : requestState?.error === 'DETAILS_SHORT'
        ? feedback.short
        : requestState?.error === 'CLUB_NOT_FOUND'
          ? feedback.missing
          : null;

  return <div className="space-y-4">
    <section className="card space-y-3">
      <h2 className="display text-2xl">{tr("Tænd lys manuelt")}</h2>
      <p className="text-sm">{tr("Lyset kan tændes i en afgrænset periode. Derefter følger det igen bookingerne. “Automatik” slukker ikke lyset under en aktiv booking.")}</p>
      {channels.length ? <form action={action} className="flex flex-wrap gap-3">
        <select className="input" name="channelId" aria-label={tr("Lys")}>{channels.map((c) => <option key={c.id} value={c.id}>{c.label ?? tr("Lys")}</option>)}</select>
        <select className="input" name="minutes" aria-label={tr("Varighed")} defaultValue="30">{[15, 30, 60, 120].map((n) => <option key={n} value={n}>{n}{" " + tr("minutter")}</option>)}<option value="0">{tr("Automatik")}</option></select>
        <SubmitButton pendingText={tr("Sender…")}>{tr("Anvend")}</SubmitButton>
      </form> : <p>{tr("Færdiggør lysopsætningen nedenfor først.")}</p>}
      {state?.error && <p role="alert" className="text-sm text-red-800">{tr(state.error)}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court-dark">{tr(state.ok)}</p>}
    </section>

    <section className="card space-y-4">
      <div>
        <h2 className="display text-2xl">{tr("Har I en anden type lys eller udstyr?")}</h2>
        <p className="mt-1 text-sm text-slate">{tr("Hvis klubbens lys, adgangssystem eller andet udstyr ikke findes i opsætningen endnu, kan I sende det til os her. Vi undersøger integrationen og vender tilbage.")}</p>
      </div>
      <details className="rounded-xl border border-slate/15 p-4" open={Boolean(requestState?.error)}>
        <summary className="cursor-pointer font-semibold">{tr("Anmod om nyt udstyr / ny integration")}</summary>
        <form action={requestAction} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="hardware-category">{tr("Hvad vil I have tilføjet?")}</label>
            <select id="hardware-category" className="input" name="category" defaultValue="LIGHTING" required>
              <option value="LIGHTING">{tr("Anden type lys / lysstyring")}</option>
              <option value="ACCESS">{tr("Adgang, dør eller lås")}</option>
              <option value="HEATING">{tr("Varme, ventilation eller andet relæudstyr")}</option>
              <option value="SCOREBOARD">{tr("Scoreboard / display")}</option>
              <option value="OTHER">{tr("Andet udstyr")}</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="hardware-manufacturer">{tr("Producent eller system")}</label>
              <input id="hardware-manufacturer" className="input" name="manufacturer" maxLength={120} placeholder={tr("Fx Philips, KNX, Plejd, Schneider…")} />
            </div>
            <div>
              <label className="label" htmlFor="hardware-model">{tr("Model (hvis I kender den)")}</label>
              <input id="hardware-model" className="input" name="model" maxLength={120} placeholder={tr("Modelnavn eller nummer")} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="hardware-details">{tr("Beskriv udstyret og hvad I vil kunne styre")}</label>
            <textarea id="hardware-details" className="input" name="details" rows={4} minLength={10} maxLength={2000} required placeholder={tr("Fx: Vi har eksisterende LED-banelys styret af et KNX-system og vil have lyset til automatisk at følge bookingerne.")} />
          </div>
          <SubmitButton pendingText={tr("Sender anmodning…")}>{tr("Send anmodning")}</SubmitButton>
        </form>
        {requestError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{requestError}</p>}
        {requestState?.ok === 'SENT' && <p className="mt-3 rounded-lg bg-court/10 p-3 text-sm font-semibold text-court-dark">{feedback.sent}</p>}
      </details>
    </section>
  </div>;
}
