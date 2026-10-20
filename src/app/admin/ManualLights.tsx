'use client';
import { useWebsiteInternational } from "../../components/InternationalProvider";
import { Select } from "../../components/ui/Select";
import { useFormState } from 'react-dom';
import { setManualLight } from '../../lib/club-control-actions';
import { requestClubHardwareIntegration } from '../../lib/club-hardware-request-actions';
import { SubmitButton } from '../../components/SubmitButton';

type HardwareRequestState = {
  ok?: 'SENT';
  error?: 'UNAUTHORIZED' | 'INVALID_CATEGORY' | 'DETAILS_SHORT' | 'CLUB_NOT_FOUND';
} | null;

type HardwareCopy = {
  title: string; intro: string; summary: string; category: string;
  lighting: string; access: string; heating: string; scoreboard: string; other: string;
  manufacturer: string; manufacturerPlaceholder: string; model: string; modelPlaceholder: string;
  details: string; detailsPlaceholder: string; sending: string; send: string;
  unauthorized: string; invalid: string; short: string; missing: string; sent: string;
};

const HARDWARE_COPY: Record<string, HardwareCopy> = {
  da: {
    title:'Har I en anden type lys eller udstyr?', intro:'Hvis klubbens lys, adgangssystem eller andet udstyr ikke findes i opsætningen endnu, kan I sende det til os her. Vi undersøger integrationen og vender tilbage.', summary:'Anmod om nyt udstyr / ny integration', category:'Hvad vil I have tilføjet?', lighting:'Anden type lys / lysstyring', access:'Adgang, dør eller lås', heating:'Varme, ventilation eller andet relæudstyr', scoreboard:'Scoreboard / display', other:'Andet udstyr', manufacturer:'Producent eller system', manufacturerPlaceholder:'Fx Philips, KNX, Plejd, Schneider…', model:'Model (hvis I kender den)', modelPlaceholder:'Modelnavn eller nummer', details:'Beskriv udstyret og hvad I vil kunne styre', detailsPlaceholder:'Fx: Vi har eksisterende LED-banelys styret af et KNX-system og vil have lyset til automatisk at følge bookingerne.', sending:'Sender anmodning…', send:'Send anmodning', unauthorized:'Kun klubadministratorer kan sende en anmodning.', invalid:'Vælg hvilken type udstyr det drejer sig om.', short:'Beskriv kort hvilket udstyr I har, og hvad I gerne vil kunne styre.', missing:'Klubben kunne ikke findes.', sent:'Tak — anmodningen er sendt. Vi gennemgår udstyret og vender tilbage til klubbens kontaktmail.'
  },
  en: {
    title:'Do you use another type of lighting or equipment?', intro:'If your club’s lighting, access system, or other equipment is not available in the setup yet, send us a request here. We will review the integration and get back to you.', summary:'Request new equipment / integration', category:'What would you like us to add?', lighting:'Other lighting / lighting control', access:'Access, door, or lock', heating:'Heating, ventilation, or other relay equipment', scoreboard:'Scoreboard / display', other:'Other equipment', manufacturer:'Manufacturer or system', manufacturerPlaceholder:'E.g. Philips, KNX, Plejd, Schneider…', model:'Model (if known)', modelPlaceholder:'Model name or number', details:'Describe the equipment and what you want to control', detailsPlaceholder:'E.g. We have existing LED court lighting controlled by a KNX system and want the lights to follow bookings automatically.', sending:'Sending request…', send:'Send request', unauthorized:'Only club administrators can send a request.', invalid:'Choose what type of equipment the request is about.', short:'Briefly describe the equipment you have and what you want to control.', missing:'The club could not be found.', sent:'Thanks — your request has been sent. We will review the equipment and reply to the club contact email.'
  },
  'en-US': {
    title:'Do you use another type of lighting or equipment?', intro:'If your club’s lighting, access system, or other equipment is not available in the setup yet, send us a request here. We will review the integration and get back to you.', summary:'Request new equipment / integration', category:'What would you like us to add?', lighting:'Other lighting / lighting control', access:'Access, door, or lock', heating:'Heating, ventilation, or other relay equipment', scoreboard:'Scoreboard / display', other:'Other equipment', manufacturer:'Manufacturer or system', manufacturerPlaceholder:'E.g. Philips, KNX, Plejd, Schneider…', model:'Model (if known)', modelPlaceholder:'Model name or number', details:'Describe the equipment and what you want to control', detailsPlaceholder:'E.g. We have existing LED court lighting controlled by a KNX system and want the lights to follow bookings automatically.', sending:'Sending request…', send:'Send request', unauthorized:'Only club administrators can send a request.', invalid:'Choose what type of equipment the request is about.', short:'Briefly describe the equipment you have and what you want to control.', missing:'The club could not be found.', sent:'Thanks — your request has been sent. We will review the equipment and reply to the club contact email.'
  },
  de: {
    title:'Verwendet Ihr Club eine andere Beleuchtung oder Ausstattung?', intro:'Wenn die Beleuchtung, das Zugangssystem oder andere Ausstattung Ihres Clubs noch nicht verfügbar ist, senden Sie uns hier eine Anfrage. Wir prüfen die Integration und melden uns.', summary:'Neue Ausstattung / Integration anfragen', category:'Was möchten Sie hinzufügen?', lighting:'Andere Beleuchtung / Lichtsteuerung', access:'Zugang, Tür oder Schloss', heating:'Heizung, Lüftung oder andere Relaistechnik', scoreboard:'Anzeigetafel / Display', other:'Andere Ausstattung', manufacturer:'Hersteller oder System', manufacturerPlaceholder:'Z. B. Philips, KNX, Plejd, Schneider…', model:'Modell (falls bekannt)', modelPlaceholder:'Modellname oder Nummer', details:'Beschreiben Sie die Ausstattung und was gesteuert werden soll', detailsPlaceholder:'Z. B. Wir haben LED-Platzbeleuchtung mit KNX und möchten, dass sie automatisch den Buchungen folgt.', sending:'Anfrage wird gesendet…', send:'Anfrage senden', unauthorized:'Nur Clubadministratoren können eine Anfrage senden.', invalid:'Wählen Sie aus, um welche Art von Ausstattung es geht.', short:'Beschreiben Sie kurz die vorhandene Ausstattung und was gesteuert werden soll.', missing:'Der Club wurde nicht gefunden.', sent:'Danke — Ihre Anfrage wurde gesendet. Wir prüfen die Ausstattung und antworten an die Kontakt-E-Mail des Clubs.'
  },
  sv: {
    title:'Har ni en annan typ av belysning eller utrustning?', intro:'Om klubbens belysning, passagesystem eller annan utrustning ännu inte finns i inställningarna kan ni skicka en förfrågan här. Vi granskar integrationen och återkommer.', summary:'Begär ny utrustning / integration', category:'Vad vill ni lägga till?', lighting:'Annan belysning / ljusstyrning', access:'Passage, dörr eller lås', heating:'Värme, ventilation eller annan reläutrustning', scoreboard:'Resultattavla / display', other:'Annan utrustning', manufacturer:'Tillverkare eller system', manufacturerPlaceholder:'T.ex. Philips, KNX, Plejd, Schneider…', model:'Modell (om ni känner till den)', modelPlaceholder:'Modellnamn eller nummer', details:'Beskriv utrustningen och vad ni vill kunna styra', detailsPlaceholder:'T.ex. Vi har LED-banbelysning som styrs med KNX och vill att den automatiskt följer bokningarna.', sending:'Skickar förfrågan…', send:'Skicka förfrågan', unauthorized:'Endast klubbadministratörer kan skicka en förfrågan.', invalid:'Välj vilken typ av utrustning förfrågan gäller.', short:'Beskriv kort vilken utrustning ni har och vad ni vill kunna styra.', missing:'Klubben kunde inte hittas.', sent:'Tack — förfrågan har skickats. Vi granskar utrustningen och svarar till klubbens kontaktmejl.'
  },
  no: {
    title:'Har dere en annen type lys eller utstyr?', intro:'Hvis klubbens lys, adgangssystem eller annet utstyr ikke finnes i oppsettet ennå, kan dere sende en forespørsel her. Vi vurderer integrasjonen og kommer tilbake til dere.', summary:'Be om nytt utstyr / ny integrasjon', category:'Hva ønsker dere å få lagt til?', lighting:'Annen type lys / lysstyring', access:'Adgang, dør eller lås', heating:'Varme, ventilasjon eller annet reléutstyr', scoreboard:'Resultattavle / display', other:'Annet utstyr', manufacturer:'Produsent eller system', manufacturerPlaceholder:'F.eks. Philips, KNX, Plejd, Schneider…', model:'Modell (hvis kjent)', modelPlaceholder:'Modellnavn eller nummer', details:'Beskriv utstyret og hva dere ønsker å styre', detailsPlaceholder:'F.eks. Vi har LED-banelamper styrt med KNX og ønsker at lyset automatisk skal følge bookingene.', sending:'Sender forespørsel…', send:'Send forespørsel', unauthorized:'Kun klubbadministratorer kan sende en forespørsel.', invalid:'Velg hvilken type utstyr forespørselen gjelder.', short:'Beskriv kort hvilket utstyr dere har og hva dere ønsker å styre.', missing:'Klubben kunne ikke finnes.', sent:'Takk — forespørselen er sendt. Vi vurderer utstyret og svarer til klubbens kontakt-e-post.'
  },
  fr: {
    title:'Utilisez-vous un autre type d’éclairage ou d’équipement ?', intro:'Si l’éclairage, le système d’accès ou un autre équipement de votre club n’est pas encore disponible dans la configuration, envoyez-nous une demande ici. Nous étudierons l’intégration et vous répondrons.', summary:'Demander un nouvel équipement / une intégration', category:'Que souhaitez-vous ajouter ?', lighting:'Autre éclairage / commande d’éclairage', access:'Accès, porte ou serrure', heating:'Chauffage, ventilation ou autre équipement à relais', scoreboard:'Tableau de score / écran', other:'Autre équipement', manufacturer:'Fabricant ou système', manufacturerPlaceholder:'Ex. Philips, KNX, Plejd, Schneider…', model:'Modèle (si connu)', modelPlaceholder:'Nom ou numéro du modèle', details:'Décrivez l’équipement et ce que vous souhaitez contrôler', detailsPlaceholder:'Ex. Nous avons un éclairage LED des courts contrôlé par KNX et souhaitons qu’il suive automatiquement les réservations.', sending:'Envoi de la demande…', send:'Envoyer la demande', unauthorized:'Seuls les administrateurs du club peuvent envoyer une demande.', invalid:'Choisissez le type d’équipement concerné.', short:'Décrivez brièvement votre équipement et ce que vous souhaitez contrôler.', missing:'Le club est introuvable.', sent:'Merci — votre demande a été envoyée. Nous examinerons l’équipement et répondrons à l’adresse e-mail du club.'
  },
  es: {
    title:'¿Utilizáis otro tipo de iluminación o equipamiento?', intro:'Si la iluminación, el sistema de acceso u otro equipo del club aún no aparece en la configuración, enviadnos una solicitud aquí. Revisaremos la integración y os responderemos.', summary:'Solicitar nuevo equipo / integración', category:'¿Qué queréis añadir?', lighting:'Otro tipo de iluminación / control de luces', access:'Acceso, puerta o cerradura', heating:'Calefacción, ventilación u otros relés', scoreboard:'Marcador / pantalla', other:'Otro equipo', manufacturer:'Fabricante o sistema', manufacturerPlaceholder:'Ej. Philips, KNX, Plejd, Schneider…', model:'Modelo (si lo conocéis)', modelPlaceholder:'Nombre o número del modelo', details:'Describe el equipo y qué queréis controlar', detailsPlaceholder:'Ej. Tenemos iluminación LED de pista controlada mediante KNX y queremos que siga automáticamente las reservas.', sending:'Enviando solicitud…', send:'Enviar solicitud', unauthorized:'Solo los administradores del club pueden enviar una solicitud.', invalid:'Elige el tipo de equipo al que se refiere la solicitud.', short:'Describe brevemente el equipo que tenéis y qué queréis controlar.', missing:'No se pudo encontrar el club.', sent:'Gracias — la solicitud se ha enviado. Revisaremos el equipo y responderemos al correo de contacto del club.'
  },
};

export function ManualLights({ channels }: {channels: {id: string;label: string | null;}[];}) {
  const { tr, locale } = useWebsiteInternational();
  const [state, action] = useFormState(setManualLight, null);
  const [requestState, requestAction] = useFormState(requestClubHardwareIntegration, null as HardwareRequestState);
  const h = HARDWARE_COPY[locale] ?? HARDWARE_COPY.en;
  const requestError = requestState?.error === 'UNAUTHORIZED' ? h.unauthorized
    : requestState?.error === 'INVALID_CATEGORY' ? h.invalid
    : requestState?.error === 'DETAILS_SHORT' ? h.short
    : requestState?.error === 'CLUB_NOT_FOUND' ? h.missing : null;

  return <div className="space-y-4">
    <section className="card space-y-3">
      <h2 className="display text-2xl">{tr("Tænd lys manuelt")}</h2>
      <p className="text-sm">{tr("Lyset kan tændes i en afgrænset periode. Derefter følger det igen bookingerne. “Automatik” slukker ikke lyset under en aktiv booking.")}</p>
      {channels.length ? <form action={action} className="flex flex-wrap gap-3">
        <Select className="input" name="channelId" aria-label={tr("Lys")}>{channels.map((c) => <option key={c.id} value={c.id}>{c.label ?? tr("Lys")}</option>)}</Select>
        <Select className="input" name="minutes" aria-label={tr("Varighed")} defaultValue="30">{[15, 30, 60, 120].map((n) => <option key={n} value={n}>{n}{" " + tr("minutter")}</option>)}<option value="0">{tr("Automatik")}</option></Select>
        <SubmitButton pendingText={tr("Sender…")}>{tr("Anvend")}</SubmitButton>
      </form> : <p>{tr("Færdiggør lysopsætningen nedenfor først.")}</p>}
      {state?.error && <p role="alert" className="text-sm text-red-800">{tr(state.error)}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court-dark">{tr(state.ok)}</p>}
    </section>

    <section className="card space-y-4">
      <div><h2 className="display text-2xl">{h.title}</h2><p className="mt-1 text-sm text-slate">{h.intro}</p></div>
      <details className="rounded-xl border border-slate/15 p-4" open={Boolean(requestState?.error)}>
        <summary className="cursor-pointer font-semibold">{h.summary}</summary>
        <form action={requestAction} className="mt-4 space-y-4">
          <div><label className="label" htmlFor="hardware-category">{h.category}</label><Select id="hardware-category" className="input" name="category" defaultValue="LIGHTING" required><option value="LIGHTING">{h.lighting}</option><option value="ACCESS">{h.access}</option><option value="HEATING">{h.heating}</option><option value="SCOREBOARD">{h.scoreboard}</option><option value="OTHER">{h.other}</option></Select></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="hardware-manufacturer">{h.manufacturer}</label><input id="hardware-manufacturer" className="input" name="manufacturer" maxLength={120} placeholder={h.manufacturerPlaceholder} /></div><div><label className="label" htmlFor="hardware-model">{h.model}</label><input id="hardware-model" className="input" name="model" maxLength={120} placeholder={h.modelPlaceholder} /></div></div>
          <div><label className="label" htmlFor="hardware-details">{h.details}</label><textarea id="hardware-details" className="input" name="details" rows={4} minLength={10} maxLength={2000} required placeholder={h.detailsPlaceholder} /></div>
          <SubmitButton pendingText={h.sending}>{h.send}</SubmitButton>
        </form>
        {requestError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{requestError}</p>}
        {requestState?.ok === 'SENT' && <p className="mt-3 rounded-lg bg-court/10 p-3 text-sm font-semibold text-court-dark">{h.sent}</p>}
      </details>
    </section>
  </div>;
}
