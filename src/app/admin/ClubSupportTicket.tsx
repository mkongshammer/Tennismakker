'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import type { Locale } from '../../lib/sports';
import { createClubSupportTicket } from '../../lib/club-support-ticket-actions';
import { SubmitButton } from '../../components/SubmitButton';

const COPY = {
  da: {
    title: 'Forslag & ændringer', intro: 'Send en ticket direkte til RacketBuddy.', type: 'Type', improvement: 'Forbedringsforslag', change: 'Ændringsønske', bug: 'Fejl / problem', integration: 'Ny integration', other: 'Andet', subject: 'Kort overskrift', subjectPlaceholder: 'Fx: Mulighed for flere prisregler', details: 'Beskriv hvad I ønsker', detailsPlaceholder: 'Fortæl hvad I gerne vil ændre, hvorfor det vil hjælpe klubben, og hvordan I forestiller jer det skal fungere.', priority: 'Prioritet', normal: 'Normal', high: 'Haster / blokerer driften', send: 'Send ticket', sending: 'Sender…', sent: 'Ticket sendt', reply: 'Vi vender tilbage på klubbens kontaktmail. Gem gerne ticketnummeret:', invalidType: 'Vælg en gyldig type.', subjectShort: 'Skriv en lidt længere overskrift.', detailsShort: 'Beskriv ønsket med mindst 10 tegn.', unauthorized: 'Kun klubadministratorer kan sende tickets.', clubMissing: 'Klubben kunne ikke findes.'
  },
  en: {
    title: 'Suggestions & changes', intro: 'Send a ticket directly to RacketBuddy.', type: 'Type', improvement: 'Improvement request', change: 'Change request', bug: 'Bug / problem', integration: 'New integration', other: 'Other', subject: 'Short subject', subjectPlaceholder: 'E.g. More flexible pricing rules', details: 'Describe what you need', detailsPlaceholder: 'Tell us what you would like changed, why it would help your club, and how you imagine it should work.', priority: 'Priority', normal: 'Normal', high: 'Urgent / blocking operations', send: 'Send ticket', sending: 'Sending…', sent: 'Ticket sent', reply: 'We will reply to the club contact email. Keep this ticket number:', invalidType: 'Choose a valid ticket type.', subjectShort: 'Please enter a slightly longer subject.', detailsShort: 'Please describe the request in at least 10 characters.', unauthorized: 'Only club administrators can send tickets.', clubMissing: 'The club could not be found.'
  },
  de: {
    title: 'Vorschläge & Änderungen', intro: 'Senden Sie ein Ticket direkt an RacketBuddy.', type: 'Typ', improvement: 'Verbesserungsvorschlag', change: 'Änderungswunsch', bug: 'Fehler / Problem', integration: 'Neue Integration', other: 'Sonstiges', subject: 'Kurzer Betreff', subjectPlaceholder: 'Z. B. flexiblere Preisregeln', details: 'Beschreiben Sie Ihren Wunsch', detailsPlaceholder: 'Beschreiben Sie, was geändert werden soll, warum es Ihrem Club hilft und wie es funktionieren sollte.', priority: 'Priorität', normal: 'Normal', high: 'Dringend / blockiert den Betrieb', send: 'Ticket senden', sending: 'Wird gesendet…', sent: 'Ticket gesendet', reply: 'Wir antworten an die Kontakt-E-Mail des Clubs. Ticketnummer:', invalidType: 'Wählen Sie einen gültigen Typ.', subjectShort: 'Bitte geben Sie einen etwas längeren Betreff ein.', detailsShort: 'Bitte beschreiben Sie den Wunsch mit mindestens 10 Zeichen.', unauthorized: 'Nur Clubadministratoren können Tickets senden.', clubMissing: 'Der Club wurde nicht gefunden.'
  },
  sv: {
    title: 'Förslag & ändringar', intro: 'Skicka ett ärende direkt till RacketBuddy.', type: 'Typ', improvement: 'Förbättringsförslag', change: 'Ändringsönskemål', bug: 'Fel / problem', integration: 'Ny integration', other: 'Annat', subject: 'Kort rubrik', subjectPlaceholder: 'T.ex. fler flexibla prisregler', details: 'Beskriv vad ni önskar', detailsPlaceholder: 'Beskriv vad ni vill ändra, varför det hjälper klubben och hur ni tänker att det ska fungera.', priority: 'Prioritet', normal: 'Normal', high: 'Brådskande / blockerar driften', send: 'Skicka ärende', sending: 'Skickar…', sent: 'Ärendet skickat', reply: 'Vi svarar till klubbens kontaktmejl. Spara gärna ärendenumret:', invalidType: 'Välj en giltig typ.', subjectShort: 'Skriv en något längre rubrik.', detailsShort: 'Beskriv önskemålet med minst 10 tecken.', unauthorized: 'Endast klubbadministratörer kan skicka ärenden.', clubMissing: 'Klubben kunde inte hittas.'
  },
  no: {
    title: 'Forslag & endringer', intro: 'Send en sak direkte til RacketBuddy.', type: 'Type', improvement: 'Forbedringsforslag', change: 'Endringsønske', bug: 'Feil / problem', integration: 'Ny integrasjon', other: 'Annet', subject: 'Kort overskrift', subjectPlaceholder: 'F.eks. mer fleksible prisregler', details: 'Beskriv hva dere ønsker', detailsPlaceholder: 'Fortell hva dere vil endre, hvorfor det vil hjelpe klubben og hvordan dere ser for dere at det skal fungere.', priority: 'Prioritet', normal: 'Normal', high: 'Haster / blokkerer driften', send: 'Send sak', sending: 'Sender…', sent: 'Saken er sendt', reply: 'Vi svarer til klubbens kontakt-e-post. Ta vare på saksnummeret:', invalidType: 'Velg en gyldig type.', subjectShort: 'Skriv en litt lengre overskrift.', detailsShort: 'Beskriv ønsket med minst 10 tegn.', unauthorized: 'Kun klubbadministratorer kan sende saker.', clubMissing: 'Klubben ble ikke funnet.'
  },
  fr: {
    title: 'Suggestions & modifications', intro: 'Envoyez un ticket directement à RacketBuddy.', type: 'Type', improvement: 'Suggestion d’amélioration', change: 'Demande de modification', bug: 'Bug / problème', integration: 'Nouvelle intégration', other: 'Autre', subject: 'Objet court', subjectPlaceholder: 'Ex. règles tarifaires plus flexibles', details: 'Décrivez votre demande', detailsPlaceholder: 'Expliquez ce que vous souhaitez modifier, pourquoi cela aiderait le club et comment cela devrait fonctionner.', priority: 'Priorité', normal: 'Normale', high: 'Urgent / bloque les opérations', send: 'Envoyer le ticket', sending: 'Envoi…', sent: 'Ticket envoyé', reply: 'Nous répondrons à l’adresse e-mail du club. Numéro du ticket :', invalidType: 'Choisissez un type valide.', subjectShort: 'Veuillez saisir un objet un peu plus long.', detailsShort: 'Décrivez la demande en au moins 10 caractères.', unauthorized: 'Seuls les administrateurs du club peuvent envoyer des tickets.', clubMissing: 'Le club est introuvable.'
  },
  es: {
    title: 'Sugerencias y cambios', intro: 'Envía un ticket directamente a RacketBuddy.', type: 'Tipo', improvement: 'Propuesta de mejora', change: 'Solicitud de cambio', bug: 'Error / problema', integration: 'Nueva integración', other: 'Otro', subject: 'Asunto breve', subjectPlaceholder: 'Ej. reglas de precios más flexibles', details: 'Describe lo que necesitas', detailsPlaceholder: 'Explica qué te gustaría cambiar, por qué ayudaría al club y cómo imaginas que debería funcionar.', priority: 'Prioridad', normal: 'Normal', high: 'Urgente / bloquea las operaciones', send: 'Enviar ticket', sending: 'Enviando…', sent: 'Ticket enviado', reply: 'Responderemos al correo de contacto del club. Guarda este número:', invalidType: 'Elige un tipo válido.', subjectShort: 'Escribe un asunto un poco más largo.', detailsShort: 'Describe la solicitud con al menos 10 caracteres.', unauthorized: 'Solo los administradores del club pueden enviar tickets.', clubMissing: 'No se pudo encontrar el club.'
  },
} as const;

type Copy = Record<keyof typeof COPY.en, string>;
type TicketState = { ok?: 'SENT'; ticketNumber?: string; error?: string } | null;

function copyFor(locale: Locale): Copy {
  if (locale === 'en-US') return COPY.en;
  return (COPY as unknown as Record<string, Copy>)[locale] ?? COPY.en;
}

export function ClubSupportTicket({ locale, page }: { locale: Locale; page: string }) {
  const c = copyFor(locale);
  const [state, action] = useFormState(createClubSupportTicket as any, null as TicketState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok === 'SENT') formRef.current?.reset(); }, [state]);

  const error = state?.error === 'INVALID_TYPE' ? c.invalidType
    : state?.error === 'SUBJECT_SHORT' ? c.subjectShort
    : state?.error === 'DETAILS_SHORT' ? c.detailsShort
    : state?.error === 'UNAUTHORIZED' ? c.unauthorized
    : state?.error === 'CLUB_NOT_FOUND' ? c.clubMissing
    : state?.error ? c.detailsShort : null;

  return <details className="group mt-4 border-t border-slate/10 pt-4" open={Boolean(state)}>
    <summary className="cursor-pointer list-none rounded-xl bg-court/5 px-3 py-3 transition-colors hover:bg-court/10">
      <span className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-bold text-ink">{c.title}</span>
          <span className="mt-0.5 block text-xs font-normal text-slate">{c.intro}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" fill="none"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
    </summary>

    <form ref={formRef} action={action} className="mt-4 space-y-3 px-1">
      <input type="hidden" name="page" value={page} />
      <label className="block text-xs font-semibold text-slate">{c.type}
        <select name="type" className="input mt-1 w-full" defaultValue="IMPROVEMENT" required>
          <option value="IMPROVEMENT">{c.improvement}</option>
          <option value="CHANGE">{c.change}</option>
          <option value="BUG">{c.bug}</option>
          <option value="INTEGRATION">{c.integration}</option>
          <option value="OTHER">{c.other}</option>
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate">{c.subject}
        <input name="subject" className="input mt-1 w-full" minLength={5} maxLength={140} required placeholder={c.subjectPlaceholder} />
      </label>
      <label className="block text-xs font-semibold text-slate">{c.details}
        <textarea name="details" className="input mt-1 w-full resize-y" rows={4} minLength={10} maxLength={3000} required placeholder={c.detailsPlaceholder} />
      </label>
      <label className="block text-xs font-semibold text-slate">{c.priority}
        <select name="priority" className="input mt-1 w-full" defaultValue="NORMAL">
          <option value="NORMAL">{c.normal}</option>
          <option value="HIGH">{c.high}</option>
        </select>
      </label>
      <SubmitButton className="w-full" pendingText={c.sending}>{c.send}</SubmitButton>
    </form>

    {error && <p role="alert" className="mx-1 mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    {state?.ok === 'SENT' && <div className="mx-1 mt-3 rounded-xl bg-court/10 p-3 text-xs text-court-dark">
      <p className="font-bold">{c.sent}</p>
      <p className="mt-1">{c.reply} <span className="font-mono font-bold">{state.ticketNumber}</span></p>
    </div>}
  </details>;
}
