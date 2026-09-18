# Mobilapp: kvalitetspas, 18. september 2026

Gennemgået: login/oprettelse, klubber, banetider, trænere, træneranmodninger,
medspillere, opslag, nye opslag, samtaleliste, chat og profil med bookinger/adgang.

## Rettelser

- Trænerbooking håndterer REQUESTED uden at åbne en ikke-eksisterende betalingsside.
  Lektionslængde og faktisk lektionspris vises inden anmodningen.
- Reservationer, træneranmodninger, kontakt, svar på opslag, genbooking, betaling,
  døråbning og beskeder beskyttes mod gentagne tryk, mens kaldet kører.
- Nyt autentificeret checkout-endpoint kontrollerer ejerskab, bookingstatus og
  reservationsfrist. Betal nu bruger appens Bearer-token. Hvis første checkout
  fejler efter oprettelsen, fortæller API'et, at reservationen allerede findes.
- Netværkskald har timeout med en særskilt besked om usikkert resultat ved
  skrivninger. Der foretages ingen automatisk gentagelse af skrivninger.
- Hentede oplysninger bevares ved kortvarige fejl. Faner og detaljer opdateres
  ved fokus og tilbagevenden fra browser/baggrund; gamle filtersvar ignoreres.
- Chat opdateres hvert 8. sekund, mens skærmen er aktiv. Samtalelisten opdateres
  hvert 15. sekund. Sendte beskeder flettes med serverens svar uden dubletter.
  Fejl vises, kladden bevares ved sendefejl, og læsning af ældre beskeder afbrydes
  ikke af automatisk rulning.
- Profilen viser afventende træneranmodninger og bekræftede bookinger. En fejl
  i Spil igen skjuler ikke de kommende bookinger eller adgangsknapperne.
- Login har feltvalidering, tastaturhandlinger, autofyld, glemte adgangskoder og
  en begrænset formularbredde på store skærme. Nyt opslag bruger profilens
  region/niveau, når muligt. Chat og opslag tager højde for tastaturet.
- Fælles trykfeedback, tilgængelige labels, stabil knapstørrelse under hentning,
  en synlig lukknap på profilmodalen og fungerende dialoger i browserdemoen.
- Datogrupper følger den samme lokale kalenderdag som de viste klokkeslæt.
- CORS-preflight returnerer et tomt HTTP 204-svar frem for en ulovlig JSON-body.

## Udført validering

- 62 eksisterende server-/domænetests bestået.
- 13 nye mobile tests bestået: fejl/timeout, betalingslinks, beskedfletning,
  lokal kalenderdag, bevarelse ved netværksfejl, race mellem sportsfiltre,
  fokus/baggrund og træneranmodning med dobbelttryk.
- Next.js produktionsbuild med TypeScript-kontrol bestået.
- Expo-eksport til web, iOS og Android bestået. Expo Doctor: 18/18 kontroller.
- Lokal produktionsserver: fire OPTIONS-endpoints returnerer tomt 204 med
  de forventede CORS-headere. Checkout afviser uautentificeret POST med 401.

## Afgrænsning af dokumentationen

Komponenttests bruger isolerede data; de opretter ikke bookinger eller sender
beskeder/mail i produktion. Dette er ikke en attest på, at alle integrationer
er testet fra ende til ende. En signeret TestFlight/Play-build, fysisk telefon,
ægte betaling, klubadministration og Shelly-relæer er ikke testet her.

Mock-betaling åbner fortsat web-checkout, som kan kræve separat web-login.
Appens nye Bearer-endpoint understøtter den rigtige Stripe-checkout uden dette
cookiekrav. Browserdemoen er på `/app/index.html`; `/app` har et link til den.

Der er ikke udført samtidigheds-/belastningstest af flere brugeres reservation
af samme tid eller af forsinkede betalingswebhooks. Klientens tryklås er ikke
en garanti mod samtidige bookinger på tværs af brugere.
