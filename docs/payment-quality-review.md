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

110 server-/domænetests og 15 mobile tests består (125 i alt).
34 nye serverregressioner dækker validering, faktiske route handlers, faktiske
betalingsfunktioner med isolerede afhængigheder og Stripes rigtige lokale
signaturkontrol. Ingen rigtige konti, betalinger, mails eller relæer bruges.
Samtidighedstesten bruger en transaktionsmodel, ikke en belastningstest mod
produktionens PostgreSQL. Next-produktionsbuild og TypeScript-kontrol består.

## Stadig release-blokerende for fuldt afprøvede rigtige betalinger

1. Rigtig Stripe-testkonto og PostgreSQL-samtidighedstest mangler. De nye
   regressioner bruger isolerede afhængigheder og en model af Stripes
   idempotens, ikke en faktisk Stripe-transaktion.
2. Ved ukendt udfald (Stripe oprettede muligvis sessionen, men session-id blev
   aldrig gemt og alle genforsøg/webhooks udeblev) beholdes reservationen til
   manuel afstemning. Afsluttede, ubetalte asynkrone betalinger beholdes også,
   indtil succes eller manuel afstemning; async_payment_failed er ikke endnu
   automatiseret. Ingen blind genoprettelse eller automatisk refundering.
3. Fælles reservationstest mod samtidige brugere og faktiske eksterne
   klubbookingsystemer mangler. Bekræftelseslåsen gælder samme booking-id.
4. Faktisk Apple Pay/kortbetaling, webhook-konfiguration, udbetaling og åbning
   af en signeret native app skal afprøves med autoriseret testkonto og enhed.

Dette kvalitetspas ændrer ikke priser, provision, klubabonnementer eller
Stripe Connects udbetalingsmodel. Det er ikke en påstand om, at hele den
finansielle integration er end-to-end-testet eller klar til betalende kunder.

## Opfølgning: vedvarende checkout og fælles frist

- Nye checkout-forsøg gemmer hele oprettelsesanmodningen inden Stripe-kaldet.
  En betinget databaseopdatering vælger ét sæt parametre; samtidige kald og
  genforsøg bruger samme idempotensnøgle og gemte pris, gebyr, modtager og frist.
- Reservation og Checkout får præcis samme frist: 35 minutter fra klargøring.
  Stripe kræver mindst 30 minutter; fem minutter giver plads til oprettelse
  og hurtige genforsøg. Genåbning forlænger ikke fristen.
- Gemte sessioner hentes og genbruges. Afsluttede sessioner giver ikke nye
  betalingslinks. Gamle usikre forsøg genoprettes ikke efter udløb, hvor Stripes
  idempotensnøgle senere kan blive slettet.
- Oprydning frigiver administrerede reservationer først når Stripe viser
  udløbet session. Betalte sessioner afstemmes gennem samme bekræftelsesfunktion.
  En sen, verificeret betaling fra den gemte session kan bekræfte en stadig
  reserveret tid; en aflyst booking kan stadig ikke genoplives.
- Aflysning af et HOLD lukker først den åbne Stripe-session. Hvis betalingen
  vinder kapløbet, eller dens status er ukendt, afvises aflysningen. Database-
  sammenligningen beskytter også mod et nyt checkout mellem opslag og aflysning.
- Ændringen tilføjer to nullable felter; ingen data slettes. Tidligere oprettede
  Stripe-links uden de nye felter er ikke automatisk migreret eller lukket.
  Gennemgå eventuelle gamle åbne sessioner før betalt lancering.
- Den eksisterende fordeling af beløb ændres ikke. on_behalf_of må ikke bruges
  som dokumentation for, hvem der betaler Stripes egne behandlingsgebyrer.

Referencer: [Stripe-idempotens](https://docs.stripe.com/api/idempotent_requests),
[lukning af Checkout](https://docs.stripe.com/api/checkout/sessions/expire).
