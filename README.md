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

## Beskeder

Når nogen slår til på et makker-opslag, åbnes en samtale mellem de to. Kontaktoplysninger deles ikke længere automatisk — det er bedre for privatlivet, og samtalen bliver et sted, folk kommer tilbage til.

Adgangskontrollen ligger samlet i `src/lib/messages.ts`: kun opslagets ejer og den, der slog til, kan læse eller skrive i tråden. Både websitet og API'et bruger den samme funktion, så reglen kun findes ét sted.

Beskeder hentes ved sideindlæsning. Der er ingen realtidsopdatering endnu — man skal hente siden igen for at se nye beskeder. Push-beskeder er heller ikke bygget, så modtageren får kun besked pr. e-mail, når samtalen starter.

## Swipe-matching

`/spillere` viser én spiller ad gangen inden for ±1 niveau og samme område. Siger begge ja, oprettes automatisk en samtale, og begge sendes derind.

Hvorfor swipe frem for opslagstavlen: en tavle kræver, at nogen gider skrive et opslag, og at andre gider læse det. Swipe fungerer også, når folk er passive — man skal bare sige ja eller nej til én ad gangen. Det virker ved langt færre brugere, end en tavle gør. Opslagstavlen findes stadig på `/makkere` for dem, der vil beskrive noget specifikt.

Et nej er privat: den anden får aldrig at vide, at man sprang over.

## Anmeldelser

Kun personer med en gennemført booking kan anmelde, og kun én gang pr. booking. Det er hele grunden til, at anmeldelserne er værd at stole på — de kan ikke skrives af nogen, der aldrig har været der. Logikken ligger i `src/lib/reviews.ts`, og både web og API bruger den samme funktion.

Efter en overstået booking dukker anmeldelsen op øverst på `/profil`. Gennemsnit vises på klub- og trænerlisterne.

**Ikke bygget:** der er ingen moderation af anmeldelsestekster og ingen mulighed for at en klub eller træner kan svare. Begge dele bør på plads, før der er rigtige brugere — en enkelt urimelig anmeldelse uden svarmulighed kan koste dig en klub.

## Hvorfor der ikke er et socialt feed

Instagram-delen er fravalgt bevidst. Et feed med få brugere er tomt, og tomme feeds får folk til at holde op med at åbne appen. Brugeruploadede billeder udløser desuden moderationspligt, lagringsomkostninger og ansvar for indhold, platformen ikke kontrollerer.

Profilbilleder vises som initialer. Vil I have rigtige billeder senere, kræver det en lagringsudbyder og en plan for moderation — ikke bare et upload-felt.

## Kort over klubber

`/klubber` er en delt visning: listen til venstre, kortet hængende til højre. På telefon vises listen med en "Vis kort"-knap, der bliver siddende nederst.

Tre designvalg der bærer siden:

**Prisbobler frem for nåle.** En nål fortæller kun "her ligger noget". En boble med prisen svarer på det spørgsmål, folk faktisk har, før de klikker. Boblen er mørkegrøn som vindskærmen og bliver lergrus-rød, når klubben er valgt.

**Dæmpede kortfliser** (CARTO Positron). Standardfliserne fra OpenStreetMap er fulde af farve og tekst, og så forsvinder boblerne i støjen.

**Banemotiv i stedet for foto.** Klubberne har ingen billeder, og et gråt pladsholderfelt ser forladt ud. I stedet tegnes en tennisbane i klubbens egen farve — det gør listen genkendelig og undgår hele billedhåndteringen.

Liste og kort peger på hinanden: peger man på et kort i listen, vokser boblen på kortet, og klikker man på en boble, ruller det tilhørende kort frem.

Kortet bruger Leaflet og kræver hverken API-nøgle eller betalingskort — der er ingen risiko for en uventet regning og ingen nøgle at lække. Adresser slås op med OpenStreetMaps Nominatim, når en klub oprettes (`src/lib/geocode.ts`). Kan adressen ikke findes, oprettes klubben alligevel og mangler bare på kortet.

**Ikke bygget:** klubber kan ikke rette deres adresse i admin bagefter, og der er ingen søgning på afstand ("klubber inden for 10 km"). Kortet i mobilappen mangler også — appen viser stadig kun en liste.

## Mobil

Websitet er bygget til at fungere på en telefon, ikke bare skaleret ned. De væsentlige valg:

**Menuen** foldes til en skuffe under 768 px. Otte punkter i en række brød før over tre linjer og skubbede indholdet ned. Skuffen lukker af sig selv ved navigation og låser baggrunden, mens den er åben.

**Banebooking vendes om.** På bred skærm er et gitter med baner som kolonner rigtigt — man overskuer hele dagen. På telefon krævede det samme gitter vandret scroll for at nå den sidste bane. Derfor står tiderne under hinanden på telefon, og hver tid folder ud og viser hvilke baner der er ledige. Det passer også bedre til, hvordan man vælger: man ved hvornår man kan spille, og er mindre optaget af hvilken bane det bliver.

**Felter er mindst 16 px.** iOS zoomer ind på et inputfelt med mindre skrift, og så sidder man og zoomer ud igen efter hvert felt.

**Trykflader er mindst 44 px høje** under 640 px. Knapperne var omkring 36 px, hvilket er under Apples anbefaling og mærkbart i praksis.

**Sikkerhedszoner respekteres.** Sidefoden, kort-knappen på klublisten og beskedfeltet i chatten bruger `env(safe-area-inset-bottom)`, så de ikke havner under hjemmeindikatoren.

Todelte formularer stakker under 640 px, dagsvælgeren ruller vandret med snap i stedet for at brydes, og lange klubnavne brydes frem for at skubbe siden bredere end skærmen.
