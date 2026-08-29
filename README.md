# Tennis Makker

Dansk tennisplatform der samler tre ting i ét system:

- **Modul A — Makker-matching:** spillere slår op og finder modstandere på deres eget niveau i deres område.
- **Modul B — Trænerbooking:** trænere har profil, priser og kalender; elever booker og betaler i samme flow.
- **Modul C — Gæstebooking i klubber:** udefrakommende spillere finder ledige baner i klubber, der beholder deres eget bookingsystem.

Bygget som én Next.js-app (App Router) med Prisma og server actions.

## Produktmodellen: et lag ovenpå, ikke en erstatning

De fleste danske tennisklubber kører allerede et bookingsystem — typisk Halbooking fra Globus Data. Vi forsøger ikke at skifte det ud. Vi løser et andet problem: at en spiller uden medlemskab ikke kan se, om der er en ledig bane.

Klubben beholder sit system. Vi viser det, der er ledigt, til folk udefra, og sender pengene videre til klubben minus vores andel.

Det er også en anden salgsproces: klubben skal ikke skifte system, bare sige ja til at vise sine tomme tider. Til gengæld konkurrerer vi med Wannasport, som gør noget lignende på tværs af sportsgrene — vores kant er, at vi er tennis-specifikke og har makker-matchingen med.

---

## Kom i gang

```bash
npm install
cp .env.example .env        # ret AUTH_SECRET til noget tilfældigt
npm run setup               # opretter database + demo-data
npm run dev                 # http://localhost:3000
```

`npm run setup` kører `prisma db push` og seeder demo-data. Første kørsel henter Prisma's engine-binærer, så du skal have internetadgang.

### Demo-konti

Alle bruger adgangskoden `tennis123`.

| E-mail | Rolle |
|---|---|
| `mads@demo.dk` | Spiller (har et åbent makker-opslag) |
| `sofie@demo.dk` | Spiller |
| `traener@demo.dk` | Træner med ledige tider man/ons/lør |
| `admin@demo.dk` | Klub-admin, Søndermark (NATIVE — vi er systemet) |
| `nordhavn@demo.dk` | Klub-admin, Nordhavn (MANUAL — eget system + frigivne gæstetider) |

Klubsider: `/klub/soendermark-tennis` og `/klub/nordhavn-tennis`. Log ind som `nordhavn@demo.dk` og gå til `/admin` for at se integrationsopsætningen og frigive gæstetider.

---

## Sådan hænger koden sammen

```
prisma/schema.prisma      Datamodel (users, clubs, courts, bookings, coach_profiles, matches, payments)
prisma/seed.ts            Demo-data
src/lib/db.ts             Prisma-klient
src/lib/session.ts        Login-session i en signeret cookie (jose)
src/lib/actions.ts        Server actions: signup/login, opslag, bookinger, trænerprofil
src/lib/payments.ts       Betalingslag — mock i udvikling, Stripe Connect i produktion
src/lib/slots.ts          Generering af bookbare timeslots
src/lib/levels.ts         Niveauskala 1-7, banetyper, kamptyper
src/app/makkere/          Modul A
src/app/traenere/         Modul B
src/app/klub/[slug]/      Modul C — klubside + banebooking
src/app/admin/            Modul C — klub-administration
src/app/checkout/[id]/    Betalingsside (demo)
src/app/api/v1/           JSON-API som mobilappen bruger
mobile/                   iOS- og Android-app (React Native + Expo)
public/app/               web-bygget udgave af appen, ligger på /app
```

## Integration mod klubbens bookingsystem

Hele integrationen ligger bag ét interface i `src/lib/integrations`. Klubsiden, booking og betaling ved ikke, hvilken type klubben bruger — det gør det billigt at tilføje en ny.

| Type | Sådan virker den | Hvornår |
|---|---|---|
| `MANUAL` | Klubben frigiver selv præcis de tider, gæster må booke | Virker med ethvert system. Start her. |
| `ICAL` | Vi henter klubbens kalenderfeed og viser det, der ikke er optaget | Når klubbens system kan udstille en `.ics` |
| `NATIVE` | Tennis Makker *er* klubbens bookingsystem | Klubber uden eget system |
| `API` | Direkte opslag i klubbens system | Kræver partneraftale — ikke bygget |

**Halbooking har ingen offentlig API.** Globus Data har partnerintegrationer til adgangskontrol, betaling og bogføring, men intet tredjeparter kan læse ledighed fra. Så `API`-adapteren er bevidst kun en tom skal: kontrakten er på plads, implementeringen venter på en aftale med leverandøren. Indtil da er `MANUAL` den model, der faktisk kan sælges.

Vi skriver aldrig i klubbens system. Når en gæst booker hos os, markeres bookingen `needsClubEntry`, og klubben ser den øverst i admin, indtil de har ført den ind hos sig selv. Det er den svage del af modellen — se begrænsninger nedenfor.

### iCal-parseren

`src/lib/ical.ts` er skrevet i hånden og bevidst begrænset: `DTSTART`, `DTEND`, `SUMMARY`, `LOCATION` og simple ugentlige `RRULE`'er. Et event knyttes til den bane, hvis navn står i eventets tekst (fx "Bane 2"). Nævner eventet ingen bane, tolkes det som optaget på **alle** baner — vi skjuler hellere en ledig tid end sælger en optaget.

## Betaling

Betalingslaget er bygget som en marketplace-abstraktion fra dag ét, fordi penge skal splittes tre veje: til klubben (banebooking), til træneren (trænertimer) og til platformen (kommission). Det er dyrt at eftermontere, så det ligger i arkitekturen fra start.

Satserne står i `src/lib/payments.ts`: 3 % af banebookinger og 12 % af trænertimer.

I udvikling kører `PAYMENT_PROVIDER=mock`, hvor `/checkout/[id]` simulerer betalingen. Hele flowet er ellers identisk med produktion:

1. Bruger vælger et tidspunkt → bookingen oprettes med status `HOLD` og reserveres i 10 minutter.
2. Bruger sendes til checkout.
3. Ved bekræftet betaling låses bookingen (`CONFIRMED`), og der oprettes en `Payment` med platformens andel.
4. Udløbne reservationer frigives automatisk, næste gang en kalender vises.

**For at gå live med rigtige penge** skal du i `src/lib/payments.ts` implementere `startCheckout()` mod Stripe og kalde `confirmBookingPayment()` fra en webhook. Skitsen står i kommentarerne øverst i filen. Klubber og trænere oprettes som Stripe Connect-konti, og MobilePay slås til som betalingsmetode i Stripe Dashboard. Alternativt kan en dansk PSP (Reepay, QuickPay, Nets Easy) sættes ind samme sted — resten af koden skal ikke røres.

## Fra SQLite til PostgreSQL

Udvikling bruger SQLite, så du kan komme i gang uden en databaseserver. Til produktion:

1. Skift `provider` til `"postgresql"` i `prisma/schema.prisma`.
2. Sæt `DATABASE_URL` til din Postgres-connection string (fx Supabase eller Neon).
3. Kør `npx prisma migrate dev --name init`.

Enum-værdier (rolle, status, banetype) er gemt som tekst af hensyn til SQLite. Når du er på Postgres, kan de med fordel konverteres til rigtige Prisma-enums.

## Multi-tenant

Hver klub er en tenant med sin egen `slug` og sin egen farve på klubsiden. Alle klub-data hænger på `clubId`, så modellen er klar til flere klubber fra start. Vil du give klubberne deres eget subdomæne (`klubnavn.tennismakker.dk`), kan du tilføje en `middleware.ts`, der læser subdomænet og rewriter til `/klub/[slug]` — datamodellen skal ikke ændres.

## Før produktion

Nogle ting er bevidst holdt simple i denne version og bør på plads, før rigtige brugere og penge er involveret:

- **Betaling:** mock-provideren skal skiftes ud med Stripe eller en dansk PSP.
- **E-mail:** der sendes ingen kvitteringer eller bekræftelser endnu.
- **GDPR:** databehandleraftale, samtykke og sletteflow mangler. Vær særligt opmærksom på juniorspillere — mange klubber har medlemmer under 18, hvilket stiller skærpede krav til samtykke og dataminimering.
- **Rate limiting** på login og oprettelse af opslag.
- **Kontaktudveksling:** matchede spillere ser i dag hinandens e-mail og telefonnummer direkte. En intern chat ville være både bedre privatliv og bedre produkt.
- **Tests:** der er ingen endnu. Booking-flowet og betalingssplittet er de første steder, jeg ville sætte ind.

## Kendte begrænsninger

- **Dobbeltbooking er ikke teknisk umulig.** Ved `MANUAL` og `ICAL` ejer klubben stadig sandheden. Frigiver klubben en tid hos os og sælger den samtidig i sit eget system, opdager vi det ikke. `MANUAL` er mindst risikabelt, fordi klubben bevidst tager tiden ud af eget system først. Ved `ICAL` afhænger sikkerheden af, hvor tit der synkroniseres.
- Synkronisering af kalenderfeeds sker kun, når klubben trykker "Synkronisér nu". Et cron-job, der kører fx hvert 15. minut, er næste skridt — `syncClubCalendar()` er allerede skrevet til at kunne kaldes udefra.
- Bookinger er altid på hele timer.
- Trænernes ledige tider redigeres som JSON i trænerprofilen. Det virker, men en kalender-UI er næste skridt.
- Klubber og baner oprettes via seed-scriptet; der er endnu ingen selvbetjening til at oprette en ny klub.
- Aflysning giver ikke automatisk pengene retur — refunderingen skal håndteres, når rigtig betaling sættes på.

---

## API til mobilappen

Websitet bruger server actions og har ikke selv brug for et API. `/api/v1` findes udelukkende, så mobilappen (og på sigt andre klienter) kan tale med platformen.

Appen ligger i `mobile/` i dette repo — se `mobile/README.md`.

Auth sker med et Bearer-token i stedet for cookien, men det er samme JWT og samme `AUTH_SECRET`.

| Endpoint | Metode | Kræver login |
|---|---|---|
| `/api/v1/auth/signup` | POST | nej |
| `/api/v1/auth/login` | POST | nej |
| `/api/v1/me` | GET | ja |
| `/api/v1/clubs` | GET | nej |
| `/api/v1/clubs/[slug]?dage=7` | GET | nej |
| `/api/v1/coaches?omraade=` | GET | nej |
| `/api/v1/coaches/[id]` | GET | nej |
| `/api/v1/matches?omraade=&niveau=` | GET | valgfrit |
| `/api/v1/matches` | POST | ja |
| `/api/v1/matches/[id]/accept` | POST | ja |
| `/api/v1/bookings` | GET, POST | ja |

Ledige tider hentes gennem samme adapter-lag som websitet, så appen automatisk viser det rigtige, uanset om klubben kører manuel frigivelse, kalenderfeed eller native.

`POST /api/v1/bookings` opretter en reservation og returnerer en `checkoutUrl`. Appen åbner den i browseren, så den aldrig rører kortdata.

**Bemærk:** CORS står på `*`, hvilket er fint for en mobilapp, men skal strammes, hvis der senere kommer en webklient på et andet domæne.

---

## Miljøvariabler

| Variabel | Kræves | Hvad den gør |
|---|---|---|
| `DATABASE_URL` | ja | Forbindelse til Postgres |
| `AUTH_SECRET` | ja | Signerer login-sessioner og API-tokens |
| `PAYMENT_PROVIDER` | ja | `mock` eller `stripe` |
| `EMAIL_API_KEY` | nej | Resend-nøgle. Mangler den, logges e-mails i stedet for at blive sendt |
| `EMAIL_FROM` | nej | Afsenderadresse |
| `APP_URL` | nej | Bruges i links i e-mails |
| `CRON_SECRET` | nej | Beskytter `/api/cron/sync`. Uden den er baggrundsjobbet slået fra |

## Baggrundsjob

`GET /api/cron/sync` synkroniserer alle klubber med kalenderfeed og rydder udløbne reservationer. Den kræver `Authorization: Bearer $CRON_SECRET`.

På Render sættes den op som et Cron Job med kommandoen:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" https://tennis-makker.onrender.com/api/cron/sync
```

Hvert 15. minut (`*/15 * * * *`) er et fornuftigt udgangspunkt.

## Juridiske dokumenter

Ligger på `/vilkaar`, `/privatliv` og `/databehandleraftale`.

**De er udkast.** Alle tre viser en tydelig advarsel øverst, og felter der mangler rigtige oplysninger er markeret med firkantede parenteser. De skal gennemgås af en advokat, og advarslen fjernes ved at sætte `draft={false}` i den enkelte side.

## Aflysning og refundering

Aflyser en spiller senest 24 timer før spilletidspunktet, refunderes hele beløbet, og betalingen markeres `REFUNDED`. Senere aflysninger refunderes ikke. Fristen står i `REFUND_WINDOW_HOURS` i `src/lib/payments.ts` og skal stemme overens med teksten i handelsbetingelserne.

Når Stripe sættes på, skal `cancelAndRefund()` også kalde Stripes refunderings-API — stedet er markeret med en kommentar.
