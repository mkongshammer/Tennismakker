# Betalingskvalitet: sikkerheds- og stabilitetspas

Dato: 18. september 2026.

## Rettet

- Stripe-betaling skal matche booking-id, DKK-beløb, betalingsstatus og en gyldig
  betalingsreference. En anden bookings session kan ikke bruges som bevis.
- Ugyldig webhook-signatur afvises uden Stripe-opslag, også hvis payloaden har
  et kendt event-id eller et id med `evt_test_`. Både snapshot- og understøttede
  thin-events verificeres af Stripes SDK før deres indhold behandles/hentes.
- `checkout.session.completed` med ubetalt status giver ikke en booking eller
  et pakkekøb. `checkout.session.async_payment_succeeded` understøttes i koden.
  Eventtypen skal også være valgt på Stripes event destination, hvis forsinkede
  betalingsmetoder anvendes. Denne kontoindstilling er ikke ændret her.
- Bekræftelse er en betinget statusændring i samme databasetransaktion som
  betalingsregistreringen. Samtidige webhook/retur-kald for samme betaling
  udløser kun én ændring og én notifikationskørsel.
- En aflyst, udløbet eller endnu ikke godkendt booking genoplives ikke af en
  betaling. En anden betaling til en allerede betalt booking bliver afvist til
  afstemning, ikke registreret som endnu en vellykket booking.
- Demo-knappen kontrollerer aktuel bruger, ejerskab og betalingsindstilling
  igen ved udførelse. En tidligere åbnet demoside kan ikke omgå Stripe-tilstand.
- Checkout-start kontrollerer status og frist, også i mock-tilstand.
- En fejl ved kvitteringsmail ændrer ikke en gennemført booking til et fejlsvar.
  Fejlen logges; der er ikke indført en mail-outbox med automatiske genforsøg.
- Betalt-beskeden kontrollerer den specifikke booking og dens ejer, ikke om
  brugeren tilfældigvis har en anden nylig bekræftet booking.
- Profilen kontrollerer login før brugeroplysninger tilgås.
- Browseren viser en neutral retur-til-app-side uden browser-login efter native
  checkout. Siden påstår ikke, at der er betalt; appens profil viser status.
  Bekræftelse uden browser-cookie afhænger fortsat af den signerede webhook.

## Test

96 server-/domænetests og 13 mobile tests består (109 i alt).
34 nye serverregressioner dækker validering, faktiske route handlers, faktiske
betalingsfunktioner med isolerede afhængigheder og Stripes rigtige lokale
signaturkontrol. Ingen rigtige konti, betalinger, mails eller relæer bruges.
Samtidighedstesten bruger en transaktionsmodel, ikke en belastningstest mod
produktionens PostgreSQL. Next-produktionsbuild og TypeScript-kontrol består.

## Stadig release-blokerende for fuldt afprøvede rigtige betalinger

1. Den lokale banereservation varer 10 minutter; Stripe-sessionen kan være åben
   i 30 minutter. Denne runde forhindrer usikker genbekræftelse, men synkroniserer
   ikke fristerne. En betaling modtaget efter lokal udløb/aflysning må afstemmes
   manuelt, herunder eventuel refundering. Der udføres ingen automatisk refundering
   eller ny reservation. En permanent afstemningsfejl giver webhook-fejl og log.
2. Genåbnet checkout kan fortsat oprette flere Stripe-sessioner. Der mangler
   vedvarende sessionsgenbrug/Stripe-idempotens ved oprettelsen. Databasens
   bekræftelseslås forhindrer ikke kunden i at betale to forskellige sessioner.
3. Fælles reservationstest mod samtidige brugere og faktiske eksterne
   klubbookingsystemer mangler. Bekræftelseslåsen gælder samme booking-id.
4. Faktisk Apple Pay/kortbetaling, webhook-konfiguration, udbetaling og åbning
   af en signeret native app skal afprøves med autoriseret testkonto og enhed.

Dette kvalitetspas ændrer ikke priser, provision, klubabonnementer eller
Stripe Connects udbetalingsmodel. Det er ikke en påstand om, at hele den
finansielle integration er end-to-end-testet eller klar til betalende kunder.
