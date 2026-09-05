# RacketBuddy

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
| `NATIVE` | RacketBuddy *er* klubbens bookingsystem | Klubber uden eget system |
| `API` | Direkte opslag i klubbens system | Kræver partneraftale — ikke bygget |

**Halbooking har ingen offentlig API.** Globus Data har partnerintegrationer til adgangskontrol, betaling og bogføring, men intet tredjeparter kan læse ledighed fra. Så `API`-adapteren er bevidst kun en tom skal: kontrakten er på plads, implementeringen venter på en aftale med leverandøren. Indtil da er `MANUAL` den model, der faktisk kan sælges.

Vi skriver aldrig i klubbens system. Når en gæst booker hos os, markeres bookingen `needsClubEntry`, og klubben ser den øverst i admin, indtil de har ført den ind hos sig selv. Det er den svage del af modellen — se begrænsninger nedenfor.

### iCal-parseren

`src/lib/ical.ts` er skrevet i hånden og bevidst begrænset: `DTSTART`, `DTEND`, `SUMMARY`, `LOCATION` og simple ugentlige `RRULE`'er. Et event knyttes til den bane, hvis navn står i eventets tekst (fx "Bane 2"). Nævner eventet ingen bane, tolkes det som optaget på **alle** baner — vi skjuler hellere en ledig tid end sælger en optaget.

## Betaling

Betalingslaget er bygget som en marketplace-abstraktion fra dag ét, fordi penge skal splittes tre veje: til klubben (banebooking), til træneren (trænertimer) og til platformen (kommission). Det er dyrt at eftermontere, så det ligger i arkitekturen fra start.

Satserne står i `src/lib/payments.ts`: **10% af hver booking**, både baner og trænertimer.

En sats er lettere at forklare i et klubmøde end to, og den holder over Stripes gebyr. En indenlandsk betaling koster 1,5% + 1,80 kr, så en banetime til 100 kr giver 10,00 − 3,30 = 6,70 kr tilbage. Ved 3% ville den samme booking koste os 30 øre — det faste gebyr æder alt, når beløbet er lille.

**Klubber kan vælge abonnement i stedet.** `Club.billingModel` er enten `COMMISSION` (10% pr. booking) eller `SUBSCRIPTION` (fast beløb pr. måned, klubben beholder resten af hver booking). `platformFeeForBooking()` returnerer 0 for abonnementsklubbers banebookinger. Trænertimer er altid på provision — træneren er selvstændig og har ikke et abonnement.

**Hvem betaler Stripes eget gebyr ved abonnement?** Det gjorde først platformen — en fejl der blev fanget og rettet. I en destination charge er platformen som standard ansvarlig for Stripes gebyr, uanset hvad `application_fee_amount` er sat til. Med 0 kr i vores egen andel ville hver eneste abonnementsklubs booking altså have kostet os Stripes gebyr uden noget at dække det med — platformen ville tabe penge på hver transaktion.

Rettet ved at sætte `on_behalf_of: account.id` på betalingen, når klubben er på abonnement. Det flytter ansvaret for Stripes gebyr over på klubbens egen konto. Klubben betaler derved et fast beløb om måneden i stedet for provision, og betaler så Stripes transaktionsgebyr, som enhver anden erhvervsdrivende, der tager kortbetaling ville gøre. Provisionsklubber er upåvirkede — der dækker vores 10% fortsat gebyret, som beskrevet ovenfor.

Opkrævningen af selve abonnementet er ikke bygget. `subscriptionKr` er indtil videre kun et tal, der vises i admin.

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
- **Banebookinger** ligger på hele timer. Trænertimer gør ikke længere, men baner deles med klubbens eget system, hvor timen er normen — det ville skulle løses hos klubben først.
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

Kortet bruger Leaflet med almindelige OpenStreetMap-fliser — ingen API-nøgle, intet betalingskort. Fliserne dæmpes med et CSS-filter (`.leaflet-tile-pane` i `globals.css`) i stedet for at bruge en fortonet flisetjeneste, fordi CARTO i slutningen af august 2026 begyndte at kræve en API-nøgle til netop den slags fliser. Filteret giver et lignende, roligt udtryk uden afhængighed af endnu en udbyder og endnu en nøgle at holde styr på.

Adresser slås op med OpenStreetMaps Nominatim, når en klub oprettes (`src/lib/geocode.ts`). Kan adressen ikke findes, oprettes klubben alligevel og mangler bare på kortet.

**Ikke bygget:** klubber kan ikke rette deres adresse i admin bagefter, og der er ingen søgning på afstand ("klubber inden for 10 km"). Kortet i mobilappen mangler også — appen viser stadig kun en liste.

## Mobil

Websitet er bygget til at fungere på en telefon, ikke bare skaleret ned. De væsentlige valg:

**Menuen** foldes til en skuffe under 768 px. Otte punkter i en række brød før over tre linjer og skubbede indholdet ned. Skuffen lukker af sig selv ved navigation og låser baggrunden, mens den er åben.

**Banebooking vendes om.** På bred skærm er et gitter med baner som kolonner rigtigt — man overskuer hele dagen. På telefon krævede det samme gitter vandret scroll for at nå den sidste bane. Derfor står tiderne under hinanden på telefon, og hver tid folder ud og viser hvilke baner der er ledige. Det passer også bedre til, hvordan man vælger: man ved hvornår man kan spille, og er mindre optaget af hvilken bane det bliver.

**Felter er mindst 16 px.** iOS zoomer ind på et inputfelt med mindre skrift, og så sidder man og zoomer ud igen efter hvert felt.

**Trykflader er mindst 44 px høje** under 640 px. Knapperne var omkring 36 px, hvilket er under Apples anbefaling og mærkbart i praksis.

**Sikkerhedszoner respekteres.** Sidefoden, kort-knappen på klublisten og beskedfeltet i chatten bruger `env(safe-area-inset-bottom)`, så de ikke havner under hjemmeindikatoren.

Todelte formularer stakker under 640 px, dagsvælgeren ruller vandret med snap i stedet for at brydes, og lange klubnavne brydes frem for at skubbe siden bredere end skærmen.

## Dobbeltbooking på tværs af kanaler

En klub kan sælge de samme baner tre steder: eget system til medlemmer, Wannasport til gæster, og os. Ingen af systemerne kan se hinandens bookinger, og vi kan ikke skrive tilbage til Halbooking. **Der findes derfor ingen teknisk garanti mod dobbeltbooking.**

Det, koden gør:

- **Ledighed valideres på ny, når nogen booker** — ikke kun når siden vises. Er tiden forsvundet i mellemtiden, afvises bookingen.
- **`refreshBeforeBooking()`** henter ICAL-klubbers kalender igen, hvis spejlet er over et minut gammelt. Det skærer vinduet ned fra 15 minutter (cron-intervallet) til under et minut.
- **Reservationen holdes i 10 minutter** under betaling, så to af vores egne brugere ikke kan tage den samme tid.
- **`needsClubEntry`** markerer bookinger, klubben skal føre ind i eget system, og de vises øverst i admin, indtil det er gjort.

Det lukker hullet mod klubbens eget system. Det lukker det ikke mod en anden platform, der ikke skriver tilbage til klubbens system — den er usynlig for os, uanset hvor tit vi synkroniserer.

**Den eneste robuste løsning er organisatorisk:** klubben afsætter forskellige tider — eller en hel bane — til hver kanal. Så kan den samme time ikke sælges to gange, uanset hvad systemerne ved om hinanden. Det står som en note i klub-admin ved frigivelse af tider.

Før der er rigtige penge i systemet, bør der desuden ligge en aftale med klubben om, hvem der honorerer bookingen, og hvem der refunderer, hvis det alligevel sker. Det er et forretningsspørgsmål, ikke et teknisk.


---

## RacketBuddy: sportsgrene, lande og sprog

Platformen dækker ketsjersport bredt — tennis, padel, badminton, squash, bordtennis og pickleball — men **tennis er hovedsporet**. Det er der, banerne og efterspørgslen er, og det er tennis der afgør, om produktet holder. De øvrige grene skal fungere, men får ikke lov at trække opsætningen skæv.

Sportsgrenen vælges øverst på "Book bane" og "Find træner" og gemmes i en cookie, så den følger med rundt. Land og sprog gemmes på profilen for indloggede og i en cookie for gæster (`src/lib/preferences.ts`).

Oversættelser ligger i `src/lib/i18n.ts` som en almindelig ordbog med dansk og engelsk. Det er bevidst ikke et i18n-bibliotek: der er to sprog og et par hundrede strenge, og en manglende nøgle skal fejle synligt. Kommer der flere sprog eller oversættere udefra, er det tid til et rigtigt bibliotek.

**Delvist oversat.** Navigationen og overskrifterne på hovedsiderne bruger ordbogen. Mange sider har stadig dansk tekst direkte i koden. Det skal ryddes op, før engelsk kan markedsføres som understøttet.

## De fire indgange

| Sti | Hvad |
|---|---|
| `/book` | Book bane — godkendte klubber i dit land, filtreret på sportsgren |
| `/traenere` | Find træner — profil, timepris og pakkeforløb |
| `/spillere` | Find medspiller — swipe, gensidigt ja åbner en samtale |
| `/profil` | Min profil — bookinger, opslag, indstillinger |

## Klubgodkendelse

Klubber opretter sig selv på `/opret-klub`, men oprettes med status `PENDING` og er **ikke synlige** for spillere. En RacketBuddy-administrator (rolle `SUPERADMIN`) godkender dem på `/superadmin`.

Det er bevidst manuelt. En klub der påstår at have baner, den ikke har, koster tilliden hos alle andre — og hos den gæst der står foran en låst låge. Godkenderen ser adresse, antal baner, sportsgren, prismodel og kontaktperson, og bør ringe klubben op, før der trykkes godkend.

Ved godkendelse sendes en mail til klubbens administrator. Ved afvisning gemmes en intern note, som klubben ikke ser.

## Trænerpakker

Ud over en enkelt time kan trænere sælge forløb — fx et 10-turskort eller et begynderkursus over seks uger (`CoachPackage`). Pakker vises på trænerens profil med pris pr. time udregnet, så man kan sammenligne med enkelttimen.

**Pakker kan ikke købes online endnu.** De vises og aftales direkte med træneren. Onlinekøb af pakker kræver et klippekortsystem — hvor mange timer er brugt, hvornår udløber de, hvad sker der ved aflysning — og det bør bygges sammen med den rigtige betaling, ikke før.

---

## Pakkeforløb

Et klippekort hos én træner: ti timer betalt på én gang. Det var indtil nu kun tekst på profilen — "aftales direkte med træneren" — så den største enkeltbetaling en træner sælger, foregik helt uden om platformen, og uden provision.

**Modellen er den enkleste, der holder.** Købet er én betaling, og hver booking hos den træner trækker et klip i stedet for en betaling. Ingen udløbsdato, ingen delvis refusion, ingen overførsel mellem trænere. Alt det kan tilføjes, når nogen har spurgt om det.

**Provisionen tages af hele pakken ved købet**, ikke ved hvert klip. Ellers skulle vi holde regnskab med, hvor meget af en betaling der var tjent hjem, hver gang en time blev brugt.

**`sessionsUsed` frem for at slette klip.** En elev skal kunne se, hvad der er brugt, og vi skal kunne svare på det, hvis der bliver spurgt.

**Klippet trækkes betinget.** `updateMany` med `sessionsUsed: { lt: total }` frem for at læse, tælle og skrive: to bookinger på samme tid kan ellers bruge det sidste klip to gange. Databasen afgør det, ikke rækkefølgen af to forespørgsler.

## Sletning af konto

Rækken i `User` slettes ikke — den anonymiseres. Bookinger og betalinger peger på brugeren, og dem må vi ikke slette: transaktioner skal kunne dokumenteres i fem år. GDPR anerkender netop den slags retlige forpligtelser som grund til at beholde data, og databeskyttelse handler om personoplysninger, ikke om at et beløb har skiftet hænder.

Alt personhenførbart fjernes eller overskrives, og tilbage står en række, der stadig kan bære en bogføringspost, men ikke siger noget om et menneske. Det, der kan slettes helt, bliver det: beskeder, opslag, swipes, anmeldelser, trænerprofil, halvfærdige logins og ubetalte reservationer.

E-mailfeltet er unikt i databasen og kan derfor ikke bare tømmes. Det sættes til en tilfældig adresse på `@slettet.invalid` — et domæne, der ikke kan findes, og som ingen kan modtage post på.

## Hvorfor genbook og pakkerabat findes

En elev og en træner, der aftaler næste time på banen og afregner med MobilePay, forsvinder ud af platformen. Det kan ikke forhindres — kun gøres mindre attraktivt end alternativet. To ting gør det:

**Klippekort binder tid fremad.** En elev med ti betalte klip har ingen grund til at overføre penge; timerne er købt, og booking er ét klik. Derfor viser både trænerens formular og elevens visning nu besparelsen: `spar X kr` i forhold til enkelttimer. Er pakken ikke billigere end at betale pr. gang, siger formularen det højt til træneren, før de gemmer — en pakke uden rabat er der ingen grund til at købe.

**Genbook står, hvor telefonen er i hånden.** "Book samme time igen" ligger på profilen, lige under de overståede timer: samme træner, samme ugedag, samme klokkeslæt, næste uge. Ét tryk mod at finde trænerens nummer, skrive, aftale og overføre.

`getRepeatableLessons()` viser højst tre og kun én pr. træner og ugentligt tidspunkt — otte identiske knapper er ikke otte gange så nyttigt. `rebookLesson()` henter længden fra trænerens nuværende indstilling, ikke fra den gamle booking: har træneren skiftet fra 60 til 45 minutter, er det de 45, der kan bookes.

Genbook af en trænertime returnerer ingen betalingsadresse. Det er en anmodning, træneren skal godkende, præcis som en almindelig booking.

## Trænerens anmodninger

Booking af en trænertime er en anmodning, ikke en booking. Træneren godkender eller afviser, og der trækkes ingen penge, før træneren har sagt ja.

**Hvorfor spørge først.** En træner kan være syg, have en turnering eller bare ikke ville tage netop den elev. Før blev tiden solgt, og træneren fik det at vide bagefter — og en afvisning skulle refunderes. Nu spørger vi først, og en afvisning koster ingenting, fordi der ikke er betalt.

**Klippet bruges ved godkendelsen**, ikke ved anmodningen. Ellers ville en afvist anmodning koste eleven et klip.

**Anmodninger spærrer tiden**, indtil træneren svarer. De udløber ikke af sig selv — en træner kan tage en dag om at svare, og tiden skal ikke gå til en anden imens. Til gengæld får træneren en mail med det samme, så den ikke ligger uset.

**Godkendt uden klip giver et døgn til at betale.** Derefter frigives tiden igen af den almindelige oprydning.

**Man kan ikke betale for en anmodning.** Checkout-ruten, checkout-siden og bekræftelsen afviser alle status `REQUESTED`. Uden det kunne man åbne adressen direkte og betale for en time, træneren aldrig havde godkendt — og så var godkendelsen ingenting værd.

## Trænerens billede

Et profilbillede vises først, når superadmin har set det. Det er den eneste moderering, der findes, og det er et bevidst valg: en tjeneste, der skal godkende billeder, koster penge og en nøgle, og med under tyve trænere er det hurtigere og mere pålideligt at kigge selv.

Billedet beskæres til en firkant på 600 px og vises som en cirkel. Ét billede pr. træner; et nyt erstatter det gamle og skal ses igennem igen, også hvis det gamle var godkendt.

Et afvist billede slettes. Det skal ikke ligge og vente på at blive godkendt ved en fejl.

## Trænerens ledige tider

Træneren markerer sine timer i en ugekalender på `/profil/traener`. Før var det et tekstfelt med rå JSON — det virkede, men ingen træner udfylder det, og en enkelt manglende tuborgklamme gjorde profilen ubookbar uden nogen forklaring.

**Formatet er uændret.** Der gemmes stadig `[{ "day": 2, "from": 16, "to": 20 }]` i `CoachProfile.weeklySlots`, så `upcomingSlotsFromWeekly()`, trænersiden og mobilappens API læser præcis som før. Kalenderen skriver bare ned i et skjult felt.

**Der klikkes i timer, men der gemmes intervaller.** En træner tænker "tirsdag 16-20", ikke "fire enkelttimer". Timerne samles derfor til sammenhængende intervaller igen, inden de gemmes — overlap smelter sammen, og pauser midt på dagen bliver til to intervaller.

**Rensningen sker på serveren, ikke i browseren.** `normaliseWeeklySlots()` kaldes i `updateCoachProfile`, uanset om mønsteret kom fra kalenderen eller fra en API-klient. Ugyldige dage, bagvendte intervaller og timer uden for døgnet frasorteres. Ingen kan gemme noget, brugerfladen ikke selv kunne have lavet.

**Der males kun med musen.** På en telefon ville et træk hen over kalenderen slås med at rulle siden. Et tryk pr. time er lidt langsommere, men forudsigeligt — og en typisk uge er en halv snes timer. Et tryk på en dags navn markerer eller rydder hele dagen.

## Klubbernes abonnement

En klub kan være på provision (10% af hver gæstebooking) eller på abonnement (fast beløb om måneden, ingen provision). Abonnementet blev aldrig opkrævet: `subscriptionKr` stod som tekst tre steder, og `platformFeeForBooking()` returnerede 0 for enhver klub med `billingModel: "SUBSCRIPTION"`. En abonnementsklub kørte altså gratis på begge modeller samtidig.

**To Stripe-roller, ikke én.** `Club.stripeAccountId` er en Connect-konto, vi sender penge **ud** til, når en gæst booker. `Club.stripeCustomerId` er klubben som kunde **hos os**, på vores egen Stripe-konto. Samme klub, modsat pengestrøm, to id'er der ikke må forveksles.

**Prisen laves i checkout, ikke i Stripe-panelet.** Hver klub har sin egen aftalte pris, så `price_data` sættes direkte i sessionen med `recurring: { interval: "month" }`. Et katalog af Produkter, der skulle holdes i sync med `subscriptionKr`, ville være to steder at rette det samme.

**Aftale er ikke betaling.** `subscriptionIsActive()` kræver både `billingModel: "SUBSCRIPTION"` og en status, Stripe kalder betalende (`active` eller `trialing`). Alt andet — ikke startet, `past_due`, opsagt, eller en status vi ikke kender — betyder, at klubben falder tilbage på provision. Systemet retter altså sig selv: holder en klub op med at betale, begynder vi automatisk at tage 10% igen i stedet for at køre dem gratis.

En ukendt status fra Stripe tæller bevidst som "betaler ikke". Det er bedre at opkræve for meget og få en henvendelse end at opkræve ingenting og aldrig opdage det.

**Reglerne ligger for sig selv.** `src/lib/billing.ts` er ren — ingen database, ingen Stripe — netop fordi den ene funktion afgør provisionen på hver eneste booking. Den er dækket af tests. Selve Stripe-delen (kunde, checkout, kundeportal, statussynkronisering) ligger i `src/lib/subscription.ts`.

**Nye webhook-events.** Ud over `checkout.session.completed` og `account.updated` skal Stripe nu også sende `customer.subscription.created`, `.updated` og `.deleted`. Tilføj dem i Stripe-panelet på det eksisterende endpoint.

**Kundeportalen skal slås til.** Knappen "Kort, fakturaer og opsigelse" bruger Stripes egen portal, som kræver, at den er aktiveret én gang under Settings → Billing → Customer portal. Er det ikke gjort, fejler kaldet, og klubben får en læsbar besked i stedet for en tom side.

## Lektionens længde

En trænertime behøver ikke være en time. Træneren vælger 30, 45, 60 eller 90 minutter på sin profil, og tiderne lægges efter hinanden inden for de intervaller, kalenderen er markeret med.

**Den sidste lektion skal kunne nå at slutte.** Et interval fra 16 til 20 med 45-minutters lektioner giver fem tider: 16.00, 16.45, 17.30, 18.15 og 19.00. Ikke 19.45 — den ville slutte 20.30, efter træneren er gået hjem.

**Timeprisen bliver stående.** `priceHour` er fortsat det, trænere sammenlignes på i oversigten, og prisen for én lektion regnes ud fra den. Ellers ville en halv time til 200 kr se billigere ud end en hel til 350.

**"Optaget" er nu et spørgsmål om overlap.** Før blev der sammenlignet starttidspunkter: to bookinger var i konflikt, hvis de begyndte på samme minut. Med lektioner på 45 eller 90 minutter kan to bookinger ramme hinanden uden at begynde samtidig, og den gamle sammenligning ville have solgt tiden to gange. `isTaken()` spørger i stedet, om der findes en booking, der begynder før den nye slutter og slutter efter den begynder.

**Ét sted, ikke fire.** Trænersiden, dens API-modstykke, bookingen fra nettet og bookingen fra mobilappen vidste hver især det samme om trænertider — og antog hver især en time. Logikken ligger nu i `src/lib/coaching.ts`, mens regnestykkerne ligger i `src/lib/slots.ts`, hvor browseren også kan nå dem.

**Tidspunktet valideres nu.** Både på nettet og i API'et tjekkes det, at træneren rent faktisk tilbyder den tid. Knapperne på siden var ikke den eneste vej ind — man kunne sende et hvilket som helst klokkeslæt og booke uden om kalenderen.

## Tests

`npm test` kører Nodes indbyggede testkører gennem `tsx`. Ingen testramme installeret.

Der er kun tests ét sted indtil videre: `src/lib/slots.test.ts`, som dækker omregningen mellem gemte intervaller og klikbare timer samt udregningen af lektioner inden for et interval. Netop dér ville en fejl være stille — en træners tider ville forsvinde uden fejlmeddelelse, og det ville først blive opdaget, når en elev ikke kunne booke.

Booking-flowet og betalingssplittet er de næste steder, der bør dækkes.

## Landevalget

Vi gætter, hvor den besøgende er, og spørger kun, hvis gættet peger et andet sted hen end det, vi allerede viser. En dansker i Danmark ser altså ingenting.

Før var det en boks med fire lande midt på forsiden. Den stod i vejen for alle for at hjælpe de få — langt de fleste er dér, hvor vi allerede viser.

**Gættet, i den rækkefølge.** Først et landeheader fra en CDN foran appen (Cloudflare, Vercel og CloudFront sætter hver sit). Ligger der ingen CDN foran — som på Render i dag — falder vi tilbage på browserens `Accept-Language`. Det er noget, den besøgende selv har sat, det kræver ingen opslagstjeneste og ingen IP-adresse, og en browser sat til tysk er et bedre gæt på Tyskland end de fleste IP-databaser. Lande, vi ikke er i endnu, tæller som et blankt svar.

**Spørgsmålet står på sproget dér, hvor vi tror, de er.** En tysker, der lander på en dansk side, skal kunne læse netop den ene sætning, der tilbyder at gøre noget ved det. Resten af siden er stadig dansk, indtil de svarer ja.

**Gættet bestemmer aldrig noget selv.** Det stiller kun et spørgsmål. Et gæt, der lander forkert og bare skifter sproget under fødderne på nogen, er værre end slet ikke at gætte.

**Vi kan se forskel på et valg og en standard.** `User.countryChosen` og landcookien fortæller, om nogen selv har valgt. Uden det felt kunne vi ikke skelne en dansker fra en tysker, der endnu ikke var blevet spurgt.

**Ingen klient-JavaScript.** Ja og nej er hver sin formular, ligesom sprog- og sportsvælgeren.

## Vejen ind, første gang

Hønen og ægget: superadmin-konti oprettes af en superadmin, og login i to trin sender koden til kontoens egen mail. Er den eneste superadmin en demo-konto på en adresse, ingen kan læse, findes der ingen vej ind.

`/superadmin/bootstrap` er den vej, og den er lukket som udgangspunkt. Den virker kun, når `BOOTSTRAP_TOKEN` er sat i miljøet, og kun med præcis det token. Kun den, der kan sætte miljøvariabler på serveren, kan altså bruge den — og det er allerede den samme person, der kunne læse databasen direkte.

Sådan bruges den:

1. Sæt `BOOTSTRAP_TOKEN` til noget langt og tilfældigt på Render
2. Åbn `/superadmin/bootstrap?token=DIT_TOKEN&email=din@adresse.dk`
3. Gem adgangskoden, der vises én gang
4. Slet `BOOTSTRAP_TOKEN` igen

Uden variablen svarer siden "Ikke fundet" — samme svar som ved forkert token, så ingen kan aflæse, om der overhovedet er en dør der.

**Demo-superadmin bør fjernes.** Seed opretter `super@demo.dk` med rollen SUPERADMIN. Så længe den findes i produktion, er der en konto med fuld adgang på en adresse, ingen af os ejer. Sæt rollen til PLAYER, når din egen konto virker.

## Glemt adgangskode

`/login/glemt` sender et link til kontoens mail. Linket er beviset: kan man læse postkassen, må man gerne sætte en ny adgangskode. Det er den samme antagelse, login i to trin hviler på, så der er ikke noget at vinde ved at kræve begge dele.

- **Tokenet er 32 tilfældige bytes**, gemt som SHA-256. Vi skal kunne slå rækken op ud fra linket, og det kan man ikke med bcrypt — men der er intet at gætte, og hashen i databasen kan ikke bruges til at bygge linket igen.
- **En time, én gang.** Længe nok til at nå at åbne mailen, kort nok til at et link, der bliver liggende i en indbakke, ikke er en nøgle for evigt.
- **Samme svar, uanset om mailen findes.** Ellers kan siden bruges til at finde ud af, hvem der har en konto.
- **Alt der ventede på den gamle adgangskode ryddes**, når en ny er sat: både andre nulstillingslinks og halvfærdige login-koder.

## Fra demo til produktion

`prisma/seed.ts` lagde før demo-data ind. Den gør nu to ting:

**Sikrer ejerens konto.** `OWNER_EMAIL` får rollen SUPERADMIN, eller oprettes med en tilfældig adgangskode, ingen kender — heller ikke os. Vejen ind er så "Glemt adgangskode". En konto uden en kendt adgangskode er ikke en bagdør; en konto med en adgangskode fra en fil i et repo ville være det.

**Tømmer databasen, men kun på kommando.** Sættes `RESET_TO_PRODUCTION=1`, slettes alt undtagen indstillinger, sidevisninger og ejerkontoen. Uden den spærre ville en oprydning, der giver mening i dag, slette rigtige klubbers bookinger ved næste udrulning. Sæt variablen, udrul, fjern den igen.

Indstillingerne røres aldrig: det er Stripe-nøgler og afsenderadresse, og at tabe dem ville tage betalingerne ned sammen med demo-dataene.

## Login i to trin

En superadmin kan se og ændre alt. Adgangskoden alene er ikke nok til den konto: den kan lækkes fra et andet site, gættes eller kigges over skulderen. Efter adgangskoden sendes derfor en sekscifret kode til den mail, kontoen hører til, og sessionen oprettes først, når koden er indtastet.

Valgene bag `src/lib/twofactor.ts`:

- **Koden gemmes hashet.** Et udtræk af databasen skal ikke give adgang.
- **Fem forsøg, så er udfordringen død.** Uden det kan seks cifre gættes.
- **Ti minutter.** Længe nok til at finde mailen, kort nok til at en kode, der bliver liggende i en indbakke, ikke er en nøgle for evigt.
- **Rækken slettes, når koden er brugt.** En kode, der stadig ligger i databasen bagefter, er en kode, der kan bruges igen.
- **Samme svar til "forkert mail" og "forkert adgangskode".** Fortæller man "den mail findes ikke", har man givet en liste over, hvem der har en konto.

**Risikoen skal siges højt:** virker afsendelsen af e-mail ikke, kan ingen superadmin logge ind. Derfor tjekker selvtesten e-mail hver gang.

**En bremse på gentagne forsøg** ligger i hukommelsen: otte fejl i træk mod samme adresse, så er der lukket i ti minutter. Det dækker det, der faktisk sker — nogen der prøver adgangskoder i hurtig rækkefølge. Begrænsningen er, at tælleren nulstilles ved genstart og ikke deles mellem flere servere. Kører appen en dag på flere maskiner, skal den flyttes i databasen eller foran appen.

**Adgangskoder vises én gang.** Formularen på `/superadmin` laver koden på serveren og viser den på skærmen. Den sendes ikke på mail: en mail bliver liggende, videresendt og indekseret. Kan den ikke hentes frem igen, er den stadig en hemmelighed.

## Sprog

Seks valg, fem ordbøger: dansk, britisk engelsk, amerikansk engelsk, tysk, svensk og norsk. De svarer én til én til landene i `COUNTRIES`, så hvert marked møder sit eget sprog i stedet for engelsk som mellemled. Før faldt alt uden for Danmark tilbage på engelsk — det dårligste valg begge veje, for en svensker læser dansk lettere end engelsk, og en tysker forventer tysk.

**Amerikansk engelsk er en variant, ikke et sprog.** `en-US` arver hele den engelske ordbog og nævnes kun dér, hvor et ord faktisk siges anderledes: en amerikaner reserverer en bane frem for at booke den, og leder efter en hitting partner frem for en co-player. To komplette, næsten ens engelske ordbøger ville drive fra hinanden, første gang nogen rettede den ene. Derfor er `"en-US"` det eneste valgfrie felt i ordbogen.

**Typen tvinger fuldstændighed.** Ordbogen er `Record<string, Record<Locale, string>>`. Tilføjes et sprog til `LOCALES`, nægter TypeScript at bygge, indtil hver eneste streng er oversat. Et halvt oversat sprog er værre end intet, fordi fejlen først opdages af brugeren.

**Valget er en indstilling, ikke en adresse.** Sproget ligger i en cookie og på brugeren, ikke i URL'en. Den samme klubside skal kunne deles med naboen, uanset hvilket sprog I hver især læser den på. `<html lang>` følger med, så skærmlæsere og søgemaskiner får det rigtige.

**Sprogene står skrevet på sig selv** i vælgeren — "Deutsch", ikke "Tysk". Den, der leder efter tysk, læser ikke dansk.

**Dækningen er ikke fuld, og det skal man vide.** Oversat er det, en spiller møder: navigation, forside, booking, trænere, medspillere, profil. Ikke oversat er klubadministration, superadmin, handelsbetingelser, privatlivspolitik og alle e-mails — de er dansk. Det er et bevidst sted at stoppe: en klubadministrator i Tyskland er en samtale, man har taget, mens en spiller er en fremmed, der lander på siden. Men det betyder, at et tysk marked kræver mere arbejde end at slå sproget til.

## Mærket

Kun ordet i toppen af siden: **RacketBuddy**, med Buddy i banens blå. Der var et tegnet mærke ved siden af, men det gjorde ikke noget for et navn, der allerede er læseligt — to ting, der siger det samme, siger det svagere.

Faviconet er en tennisbold: boldgul kugle med to hvide sømme på mørkeblå. Samme geometri som tennisbolden på forsiden, så det er den samme bold hele vejen igennem.

Tre forsøg gik forud, og de er værd at kende, fordi de fejlede på samme måde. Strengegitter, to krydsede ketsjere, ring med bold i midten — alle tre var fine ved 512 px og grød under 64. Et favicon skal tegnes for 32 px. To sømme og en cirkel er, hvad der er plads til.

Alle filer genereres fra `src/app/icon.svg`: favicon, `icon.png`, `apple-icon.png`, delebilledet og `mobile/assets/*`.

## Markeder, der ikke er åbnet endnu

`COUNTRIES` har fire lande, men kun Danmark har `live: true`. De tre andre står i listen, fordi sproget og valutaen er klar — men vi tilbyder dem ikke.

Det får tre konsekvenser i koden:

**Gættet på land** peger kun på lande, vi sælger i. En tysker får ikke tilbudt at skifte til Tyskland, for det ville føre til en tom side på tysk.

**Landevalget afviser** et land, der ikke er åbnet. Ikke bare "findes landet", men "sælger vi der".

**Sprogene står grå** i footeren for de markeder, der ikke er åbnet. De er med alligevel, fordi de fortæller, hvor vi er på vej hen. Dansk og engelsk står altid åbne: engelsk er ikke et markedsvalg, men reserven for enhver, der lander på siden.

Åbnes et marked, sættes `live: true` på landet og `LOCALE_LIVE` for sproget. Så følger resten med.

## Betalingsmetoder

Checkout låser ikke længere til `["card"]`. Uden `payment_method_types` bruger Stripe de metoder, der er slået til i panelet, og en ny metode kræver derfor ingen kodeændring.

Det gjaldt ikke før: kommentaren i koden lovede, at MobilePay ville dukke op automatisk, mens linjen nedenunder gjorde det umuligt. Den slags leder man efter i den forkerte ende i en time.

MobilePay afregnes i øvrigt som en korttransaktion hos Stripe, ikke som en bankoverførsel. Om den kan slås til for netop denne konto, afgør Stripe ud fra kontoens profil, og svaret står under Payment methods i panelet.

## Forsiden

Åbner med det, produktet faktisk gør: hvor mange baner der står ledige lige nu. Derefter fire ting, i den rækkefølge en fremmed har brug for dem.

**Sportsvalget som bolde.** En bold genkendes hurtigere end et ord — man ved, hvad man spiller, længe før man har læst det. Boldene er tegnet frem for fotograferet: et foto kræver rettigheder, vejer hundrede gange mere, og seks fotos ved siden af hinanden ligner seks tilfældige billeder frem for ét sæt. Farverne er til gengæld de rigtige, for en squashbold ER sort med en prik.

**Tre trin.** Find en tid, betal, spil. Ikke fem, ikke to.

**Tre indvendinger, besvaret hver for sig:** intet medlemskab, prisen står der, og du får pengene igen ved aflysning i god tid. Det er de tre spørgsmål, en der aldrig har booket en bane udefra, faktisk stiller.

**Opret-profil-feltet vises kun til dem, der ikke har en.** Resten har allerede sagt ja.

## Designsystem

Den tidligere palet — cremehvid baggrund med lerfarvet accent — blev skiftet ud. Ikke fordi den var grim, men fordi den er den default, AI-genereret design altid lander på. Den var ikke et valg.

**Retningen er hardcourt, ikke grus.** Kølig grå-blå baggrund (`mist #F1F5F9`), dyb marineblå til mørke flader (`ink #0F2138`), banens blå som primær handling (`court #1B62C4`), kridhvide linjer. `optic #D8FF3E` er boldens farve og er reserveret til enkeltstående fremhævninger — den mister sin virkning, hvis den bruges to steder på samme skærm.

**Typografi:** Bricolage Grotesque til overskrifter (bred og lidt egensindig), Inter Tight til brødtekst, Martian Mono til tider, priser og antal. Tal står i mono, fordi de skal kunne skimmes i kolonne — det er hele pointen i en bookingkalender.

Skrifterne hentes i browseren via `<link>`, og `optimizeFonts` er slået fra i `next.config.mjs`. Ellers ville Next hente dem ved bygning, og et fejlende font-CDN kunne vælte et deploy.

**Signaturen er banefliserne.** Hver bookbar tid er en flise, der ser ud som et stykke bane: sportsgrenens rigtige farve med en kridhvid baglinje langs bunden. Første udgave havde linjen midt i flisen — den skar tværs gennem prisen, så beløbet så overstreget ud. Den ligger nu i bunden, hvor den læses som banemarkering.

**Farve er data.** Hver sportsgren har sin rigtige banefarve (`SPORT_COLORS` i `src/lib/sports.ts`): tennis hardcourt-blå, padel kunstgræs-turkis, badminton måttegrøn, squash rødbrun, bordtennis mørkeblå, pickleball lilla. Kan man kende grenen på farven, behøver man ikke læse etiketten.

**Navigation nederst på telefon.** De fire punkter er hele produktet og skal nås med tommelfingeren uden at åbne en menu først. En skuffe koster to tryk for noget, folk gør hver gang. På bred skærm ligger navigationen øverst, hvor der er plads.

Forsiden åbner med antallet af ledige banetimer i dag frem for et slogan. Et tomt tidsrum på en bane er den vare, platformen handler med, og tallet ændrer sig time for time — det er mere ærligt end et løfte.

## Hvad der får folk tilbage

Den udbredte opskrift fra Booking.com — "kun 1 tilbage", nedtællinger, "5 kigger på den lige nu" — er fravalgt bevidst. Tre grunde:

1. **Det er ulovligt, hvis det ikke er sandt.** EU's regler om urimelig handelspraksis forbyder opdigtet knaphed, og Kommissionens undersøgelse af dark patterns peger direkte på den slags. Den britiske konkurrencemyndighed har grebet ind over for netop de formuleringer.
2. **Forskningen peger på en bagside.** Studier af knapheds- og flertalsbudskaber i rejsebooking finder, at de flytter beslutninger — men at aggressive udgaver undergraver tilliden.
3. **Det passer ikke til produktet.** Et hotelværelse bookes én gang. En bane bookes hver tirsdag kl. 18.

**Vanen er mekanismen her.** Ketsjersport er en tilbagevendende aftale mellem de samme mennesker på det samme tidspunkt. Derfor:

- **"Spil igen"** øverst på profilen: samme bane, samme ugedag, næste uge, med ét tryk. Det er appens vigtigste knap.
- **Efter betaling** foreslås den samme tid næste uge, mens beslutningen stadig er varm.
- **I samtalen** ligger "Book en bane" øverst. En aftale uden en bane bliver sjældent til noget — det er dér, kæden ellers knækker.
- **Er tiden taget**, sendes man til klubbens kalender på den dag i stedet for at få en fejl. Man skal videre, ikke stoppes.

Tallene på forsiden og i klublisten er faktiske optællinger af ledige tider. De virker som knaphed, når der er få — men de er sande, og de falder til nul, når der ikke er noget.

**Ikke bygget:** påmindelse dagen før en booking, og et forslag om at booke, når ens faste tid bliver ledig. Begge kræver push-beskeder eller e-mail-udsendelse på et tidspunkt, og bør bygges, når der er brugere at sende til.

## Navigation

Fire punkter i bundlinjen: Book bane, Find træner, Find medspiller, Beskeder. Profilen ligger som initialer i øverste højre hjørne — den er noget man besøger, ikke noget man kommer for. Klub-administration og klubgodkendelser nås fra profilen.

Beskeder har et tal med ulæste. Det er et ægte tal, ikke en pyntet prik: har man ingen ulæste, er der ingenting at se. Et badge, der lyser uden grund, holder op med at betyde noget efter anden gang.

**Bundlinjen vises kun, når man er logget ind.** Udlogget er der ikke noget at navigere rundt i endnu, og fire faner, der alle ender på login-siden, er en blindgyde frem for en genvej. Forsiden fører selv de besøgende videre. Pladsen til bundlinjen (`has-tabbar`) afsættes samme sted, så en udlogget side ikke får tomme pixels nederst.

## Sådan kommer en klub i gang

Den tungeste del af at være klub hos os var, at man skulle frigive hver enkelt time i hånden — tyve klik om ugen, hver uge. Det er skiftet ud med tre ting:

**Regler i stedet for enkelttider.** Klubben sætter én regel op: "mandag til fredag, 9-15, bane 3 og 4, 120 kr". Reglen genererer løbende ledige tider, indtil den slås fra. Enkelttider findes stadig, men er nu til undtagelser.

**Sidste øjeblik.** Klubben kan sætte et antal timer — er en bane stadig ledig så tæt på start, frigives den automatisk. En tom bane om en time er tabt indtægt uanset hvad.

**Systemgenkendelse ved oprettelse.** Klubben skriver sin hjemmeside, og vi henter siden og gætter på bookingsystemet ud fra indholdet (`src/lib/detect.ts`). Vi leder samtidig efter et `.ics`-link og fisker klubnavnet ud af sidens titel, så formularen kan udfyldes på forhånd.

**Det er genkendelse, ikke integration.** Halbooking har ingen offentlig grænseflade, så selv når vi genkender det, kan vi ikke hente ledighed derfra uden en aftale med Globus Data. Det siger opsætningen rent ud i stedet for at love noget, den ikke kan holde — og foreslår en regel i stedet.

Finder vi et kalenderfeed, kan klubben teste det med en knap, der fortæller hvor mange bookinger vi kan se i det. Et feed der "ser rigtigt ud" er ikke det samme som et feed der virker.

## Plug and play: klubben bruger os som eneste system

Klubber på `integrationType = NATIVE` har ikke noget andet bookingsystem — og ofte heller ingen hjemmeside. Så `/klub/[slug]` er ikke en bookingkalender, det er klubbens ansigt udadtil:

- **Hoved** i klubbens egen farve med banemotiv, tagline, adresse og bedømmelse
- **Nyheder** — lukkedage, turneringer, alt det der ellers hænger på en opslagstavle
- **Booking** med medlems- og gæstepris
- **Om klubben** og **Praktisk** — hvor det vigtigste for en gæst er, hvordan man kommer ind på anlægget
- **Bliv medlem** med kode
- **Kontakt**

Alt redigeres i `/admin` under "Jeres side". Klubben skriver tekst i almindelige felter og ser resultatet med ét klik. Ingen udvikler, ingen skabelon at vælge.

**Medlemskab** virker med en kode, klubben selv genererer og deler. Er `memberPriceHour` sat, booker medlemmer til den pris, gæster til den almindelige. Prisen afgøres i adapterlaget (`isMember`), så både klubside, API og app viser det samme.

Laver klubben en ny kode, holder den gamle op med at virke, men eksisterende medlemmer forbliver medlemmer.

**Ikke bygget endnu:**

- **Eget domæne.** Klubben ligger på `/klub/navn`, ikke `navn.dk`. Datamodellen er klar til det (`slug` er unik), og en `middleware.ts` der læser værtsnavnet ville være nok — men det kræver også, at klubben peger sit DNS hen, og at der udstedes certifikater.
- **Billeder.** Der er ingen logo- eller fotoupload. Det kræver en lagringsudbyder og en beslutning om, hvem der rydder op i det.
- **Kontingent.** Medlemskab giver adgang til medlemspris, men der opkræves ikke kontingent. Det er en anden slags betaling end en booking og hører sammen med Stripe Billing.
- **Hold og turneringer.** Nyheder dækker det løseste behov. Rigtig holdadministration er et selvstændigt produkt.

## Hjemmeside som betalt ydelse

Salgssiden ligger på `/hjemmeside`: fast pris på 5.000 kr for opsætning, hvad klubben får, hvad vi skal bruge fra dem, og en bestillingsformular. Bestillingen lander i `WebsiteOrder` og dukker op i `/superadmin` med en simpel kø: Ringet op → Bygger → Færdig.

Klubben får en kvittering på mail. Sættes `ORDERS_EMAIL`, får I selv en besked med det samme.

### Egne domæner

`src/middleware.ts` kigger på værtsnavnet. Er det ikke et af vores egne, omskrives roden til `/domaene/[host]`, som slår klubben op på `customDomain` og viser klubbens side. Alt andet — login, betaling, beskeder — bliver på vores eget domæne, så der ikke skal håndteres sessioner på tværs af mange domæner.

**To skridt er manuelle og bliver ved med at være det:**

1. Domænet skal tilføjes under Custom Domains hos hostingudbyderen.
2. Klubben skal pege sit DNS mod os.

Certifikatet udstedes automatisk, når DNS er slået igennem. Det manuelle arbejde er ikke en mangel — det er blandt andet det, opsætningsgebyret dækker. Superadmin har en formular til at knytte domænet og markere det som aktivt, når det virker.

### Temaer

Tre udseender, klubben kan skifte mellem i admin: **Klassisk** (farvet hoved med banemotiv), **Markant** (mørkt hoved, stort klubnavn i klubfarven) og **Enkel** (lyst, med en farvet streg som eneste markering). De ændrer kun forsiden, ikke indholdet — så et skift kan ikke ødelægge noget.

### Hvad der stadig mangler for at kalde det Shopify

- **Betaling af selve gebyret.** De 5.000 kr opkræves manuelt. En engangsbetaling gennem Stripe hører sammen med resten af betalingsopsætningen.
- **Billeder.** Stadig ingen logo- eller fotoupload. Det er den enkelte ting, der tydeligst adskiller siderne fra en rigtig klubhjemmeside, og det kræver en lagringsudbyder.
- **Flere sider.** Klubben har én side. Vil de have "Hold", "Kontingent" og "Bestyrelsen" som selvstændige sider, er det en sidemodel, ikke et felt mere.

## Billeder

Klubber kan uploade et **forsidebillede**, et **logo** og op til **otte billeder af anlægget**. Det er den enkelte ting, der tydeligst løfter en klubside — tekst alene ser tynd ud ved siden af den hjemmeside, klubben har i forvejen.

Lagringen har to udbydere bag samme kontrakt (`src/lib/storage.ts`):

**`s3`** — Cloudflare R2 eller enhver anden S3-kompatibel tjeneste. Sæt `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` og `S3_PUBLIC_URL`, så bruges den automatisk.

**`database`** — fallback, når nøglerne ikke er sat. Virker uden konti, så platformen kan køre fra dag ét.

R2 er anbefalingen, fordi den ikke tager betaling for trafik ud. S3 og Cloudinary opkræver pr. visning, og en klubside med ti billeder bliver dyr, når den ses tit. R2 giver 10 GB gratis.

Fejler en upload til lagringstjenesten, gemmes billedet i databasen i stedet. En klub skal ikke miste sit forsidebillede, fordi en tjeneste har en dårlig dag.

**Flytning af eksisterende billeder:** `npm run images:migrate` flytter alt, der ligger i databasen, op til lagringstjenesten. Den er sikker at køre flere gange, og databasekopien slettes først, når filen er lagt op — så et afbrudt kørsel ikke kan tabe et billede.

Alle billeder hentes via `/api/billeder/[id]`, uanset hvor filen ligger. Ligger den eksternt, sendes browseren videre dertil. Det koster ét ekstra kald første gang, men til gengæld ved resten af koden aldrig, hvor filen er — og et skifte af udbyder ændrer ingen sider.

**De skaleres og komprimeres, før de gemmes.** Et testfoto på 2 MB i telefonopløsning bliver til 326 kB som forsidebillede. Uden det ville en klubside være ubrugelig på mobildata. Billeder taget på højkant rettes automatisk.

Grænser: 12 MB pr. upload, JPEG/PNG/WebP/HEIC, otte gallerifotos pr. klub. En klub med det hele fylder omkring 3 MB.

Billeder serveres fra `/api/billeder/[id]` med et års cache. Et billede ændrer sig aldrig — uploader klubben et nyt, får det et nyt id.

`imageUrl()` ligger i sin egen fil (`src/lib/imageUrl.ts`), fordi klientkomponenter har brug for den. Lå den i `images.ts`, blev billedbiblioteket trukket med ind i browser-bundlet, og det kan ikke køre der.

**Kendt kompatibilitetsproblem med R2 er rettet.** Nyere udgaver af `@aws-sdk/client-s3` sender som standard ekstra tjeksum-headers, som R2 ikke forstår — det ødelægger signaturen og viser sig som en 403 "adgang nægtet", selv med korrekte nøgler og rettigheder. Løst ved at sætte `requestChecksumCalculation` og `responseChecksumValidation` til `"WHEN_REQUIRED"` i `src/lib/storage.ts`.

**Kunne ikke testes direkte fra udviklingsmiljøet.** Sandkassen, koden er udviklet i, har en netværksspærring, der blokerer `*.r2.cloudflarestorage.com` — det gav i første omgang et 403-svar, der så ud som et rettighedsproblem hos Cloudflare, men var reelt kun sandkassens egen spærring. Første upload i produktion bør derfor kontrolleres manuelt: virker den ikke, falder billedet automatisk tilbage i databasen, og den egentlige fejl står i serverloggen.

**Ikke bygget:** klubben kan ikke ændre rækkefølgen på gallerifotos eller beskære et billede. Beskæringen sker automatisk fra midten, hvilket rammer skævt på billeder med motivet i kanten.

## Belastningstest af beskeder

Kørt lokalt mod en rigtig Postgres-database — samme forespørgsler og adgangskontrol som `src/lib/messages.ts` og `src/lib/actions.ts` bruger, men uden Prisma som mellemled (Prismas motorfil kunne ikke hentes i udviklingsmiljøet). **Ikke kørt mod jeres server:** sandkassen her kan ikke nå Render direkte, så testen viser, at logikken holder under belastning — ikke hvordan Renders netværk eller serverkapacitet opfører sig.

**Test 1 — 200 samtidige afsendere, 100 samtaler, 5.000 beskeder:**
- 2.300 beskeder i sekundet, ingen tabt eller duplikeret
- Svartid: median 60 ms, værste tilfælde 356 ms
- 0 uautoriserede beskeder slap igennem, på trods af forsøg fra udenforstående i hver samtale

**Test 2 — én samtale med over 200 beskeder fandt en reel fejl:** `readMessages()` hentede de 200 *ældste* beskeder i stedet for de nyeste. En samtale, der voksede forbi 200 beskeder, ville derfor fryse permanent på den ældste halvdel — nye beskeder blev gemt i databasen, men blev aldrig vist, uden nogen fejlmeddelelse nogen steder. Rettet ved at hente de seneste 200 og vende dem om, så visningen stadig er kronologisk, men altid viser det nyeste.

**Test 3 — 50 samtidige opslag af ulæst-tælleren** (den der vises i bundlinjen): 73 ms samlet.

Konklusion: beskedlogikken holder til langt mere belastning, end platformen får brug for i overskuelig fremtid. Fejlen i Test 2 ville til gengæld ramme jeres mest aktive brugere først — dem der skriver mest sammen — hvilket er præcis dem, I ikke har råd til at miste.

## Rigtig betaling med Stripe Connect

Betalingen er nu bygget færdig — ikke bare skitseret. Sådan hænger den sammen.

### Pengestrømmen

Det er en **destination charge**: kunden betaler det fulde beløb til Stripe, og Stripe sender automatisk `priceKr − platformFee` videre til klubbens eller trænerens egen konto med det samme. Vores andel (`platformFee`, 10%) bliver stående hos os.

**Stripes eget transaktionsgebyr trækkes fra vores andel, ikke oveni klubbens.** Det er derfor provisionen er sat til 10% i `COMMISSION_PCT` og ikke lavere — en indenlandsk betaling koster Stripe 1,5% + 1,80 kr, så på en banetime til 100 kr får vi 10,00 − 3,30 = 6,70 kr, og klubben får de fulde 90 kr uden fradrag. Klubben mærker aldrig Stripes gebyr.

### Hvem penge sendes til

Både klubber og trænere skal have deres egen **Stripe Express-konto** (`src/lib/connect.ts`), før de kan modtage betaling. Express er den lette model — Stripe står for hele registreringen (identitet, bankkonto), vi sender dem bare derhen:

- Klubben sætter det op i `/admin` under "Udbetalinger"
- Træneren sætter det op i `/profil/traener` under samme overskrift

Ingen af delene kan modtage en bane- eller trænerbooking, før Stripe siger `charges_enabled`. Prøver en gæst at booke en klub uden det, får de en tydelig fejl i stedet for en betaling, der ikke kan gennemføres.

### Webhooken er kilden til sandhed

`/api/webhooks/stripe` lytter på to ting:

- **`checkout.session.completed`** — bekræfter bookingen og sender kvitteringer. Dette sker uafhængigt af, om kunden bliver hængende på siden efter betaling. Kunden kan lukke browseren i samme sekund, betalingen tælles stadig.
- **`account.updated`** — opdaterer om en klub eller træner kan modtage penge endnu, hver gang de ændrer noget i deres Stripe-opsætning.

**Sæt webhooken op i Stripe Dashboard → Developers → Webhooks**, med adressen `https://<dit-domæne>/api/webhooks/stripe`, og kopiér den hemmelige nøgle over i `STRIPE_WEBHOOK_SECRET`.

### Refundering

Aflyser en spiller rettidigt (se afsnittet om aflysning), kalder `cancelAndRefund()` nu Stripes rigtige refunderings-API — med `reverse_transfer: true` og `refund_application_fee: true`, så pengene trækkes tilbage fra klubbens konto, og vores egen andel gives også tilbage. Vi har jo ikke leveret noget, når bookingen annulleres.

### Sådan slår du det til

1. `STRIPE_SECRET_KEY` og `STRIPE_WEBHOOK_SECRET` i miljøvariablerne — se `.env.example`
2. `PAYMENT_PROVIDER=stripe`
3. Slå MobilePay til under Stripe Dashboard → Settings → Payment methods — det kræver ingen kodeændring, det dukker automatisk op i checkout, når det er aktiveret
4. Kør `npx prisma db push` (eller lad byggeprocessen gøre det), så de nye Stripe-felter kommer med i databasen

### Ikke testet mod en rigtig Stripe-konto

Alt er skrevet efter Stripes dokumentation og typetjekket, men jeg har ingen Stripe-nøgler at teste imod — hverken test- eller livenøgler. **Det kan du selv løse på fem minutter:** opret en gratis Stripe-konto (kræver hverken bankkonto eller CVR i test-tilstand) og send mig testnøglerne (starter med `sk_test_`), så kan jeg lave en ægte gennemkørsel med Stripes testkort, ligesom jeg gjorde med R2 — i stedet for kun at stole på, at koden ligner det, dokumentationen beskriver.

### Ikke bygget

- **Abonnementsopkrævning** for klubber på fastprismodellen og for de 5.000 kr til hjemmesideydelsen. Begge er stadig manuelle. Stripe Billing er det naturlige næste skridt, når Connect-delen er bekræftet at virke.
- **Retry ved mislykket webhook.** Stripe forsøger selv igen i timevis ved fejl, men der er ingen egen overvågning af, om en booking er "hængt" i HOLD, fordi en webhook aldrig kom igennem.

## Adgang til anlægget

Løser det spørgsmål, der afgør, om gæstebooking overhovedet fungerer i virkeligheden: **hvordan kommer en gæst ind, hvis anlægget er aflåst?**

Klubben sætter det op i `/admin` under "Jeres side": en kode (`accessCode`) og/eller en fritekst-vejledning (`accessInstructions`), bag én kontakt "Anlægget er aflåst" (`hasLock`).

**Vises kun til folk med en bekræftet booking** — i kvitteringsmailen og på deres profil under kommende bookinger. Aldrig på den offentlige klubside. En kode, alle kan se, er ingen sikkerhed; det er hele pointen med at gemme den bag en betalt booking.

**Det er en statisk kode, ikke en digital lås.** Der er ingen integration til fysiske låsesystemer — koden er den samme for alle, indtil klubben selv ændrer den i admin. Rigtige udenlandske systemer som ClubSpark tilbyder engangskoder pr. booking gennem en fysisk lås-integration; det kræver en aftale med en låseleverandør og er ikke bygget. Til gengæld virker det med enhver aflåsning en klub allerede har — en kodelås, en nøgleboks, en vagt der skal ringes til — fordi det bare er tekst, klubben selv formulerer.

## Indlæsningstilstand på langsomme knapper

Stripe-kaldene tager typisk 1-6 sekunder — opsætning af udbetalinger opretter en konto og et onboarding-link hos Stripe, en booking opretter en checkout-session. Uden en synlig reaktion ser det ud som om, klikket ikke virkede, og folk klikker igen.

Løst med `useFormStatus()` fra React, som ved præcis hvornår den `<form>`, den sidder i, er ved at sende:

- **`src/components/SubmitButton.tsx`** — generisk knap med spinner og tekst ("Åbner Stripe…"), brugt til opsætning af udbetalinger for både klub og træner
- **`BookingGrid.tsx`** og **`CoachSlotButton.tsx`** — banetiderne og trænertiderne beholder deres egen stil (farvet flise med sportens farve, henholdsvis en lille kant-knap), men viser en spinner i stedet for teksten, mens bookingen oprettes

Knappen deaktiveres samtidig, mens den venter — et dobbeltklik under de 5-6 sekunder kan ellers nå at oprette to Stripe-kald for den samme handling.

**Udvidet til alle formularer med mærkbar ventetid:** login, oprettelse af profil, klubhenvendelse, systemgenkendelse (henter klubbens hjemmeside), billedupload (skalering tager tid), gem klubside, frigivelsesregler og "Spil igen". Hurtige databasehandlinger som "luk opslag" eller "godkend klub" har bevidst ikke fået spinner — dér ville den nå at blinke og forsvinde, hvilket er mere forstyrrende end hjælpsomt.

## Sikkerhedsrettelse: gratis booking var mulig

Fundet ved et spørgsmål om abonnementsgebyrer, ikke ved en systematisk gennemgang — værd at bemærke.

`/checkout/[id]` tjekkede aldrig `PAYMENT_PROVIDER`. Siden viste altid en "Betal (demo)"-knap, der bekræftede bookingen direkte uden nogen betaling — bygget til udvikling, men uden en spærring mod at blive brugt i produktion. Samtidig pegede `/api/v1/bookings` (det API, mobilappen bruger) altid derhen med en hårdkodet sti, uanset hvilken betalingsudbyder der var sat.

Kombinationen betød: med `PAYMENT_PROVIDER=stripe` sat i produktion kunne enhver med en konto booke og bekræfte en bane- eller trænertime uden at betale, ved at kalde API'et direkte.

Rettet to steder:

- **`/api/v1/bookings`** kalder nu den samme `startCheckout()`, som websitet bruger, og returnerer en ægte Stripe-adresse, når Stripe er slået til.
- **`/checkout/[id]`** sender nu videre til en ægte Stripe-session, så snart `PAYMENT_PROVIDER=stripe` — uanset hvordan nogen er landet på siden. Demo-knappen findes kun tilbage, når platformen kører i mock-tilstand.

Ingen tegn på, at hullet blev udnyttet — men det var reelt, og det lå live, indtil nu.

## Appen matcher nu websitet

Hele det visuelle sprog fra RacketBuddy-omlægningen er ført over i mobilappen — samme farver, samme banefliser, samme navigationsstruktur.

**Farver:** `mobile/src/lib/theme.js` bruger nu de samme tokens som `src/app/globals.css` — hardcourt-blå, mørk marineblå, kridhvid, kølig grå. Ingen af de gamle grus/bane-farver er tilbage.

**Navigation:** fire bundfaner i samme rækkefølge som websitet — Book bane, Trænere, Medspillere, Beskeder. Profilen er ikke en femte fane; den nås via et hjørne-ikon (initialer i en cirkel) på alle skærme, ligesom på websitet. Det løses med en global navigationsreference (`src/lib/navigationRef.js`) i stedet for at kæde `getParent()` gennem indlejrede stakke — mere robust, når fire uafhængige faner alle skal kunne åbne den samme profilskærm.

**Ikoner:** rigtige streg-ikoner tegnet med `react-native-svg`, ikke emojis. Samme streger som websitets `TabBar.tsx`.

**Banefliser:** ledige tider vises som et farvet felt i sportens farve med en kridhvid baglinje i bunden — samme signatur som websitets `.court-tile`, inklusive rettelsen af, hvor linjen sidder (i bunden, ikke midt i feltet, hvor den før skar gennem prisen).

**Sportsvælger:** `mobile/src/lib/SportPicker.js`, gemt lokalt med AsyncStorage i stedet for en cookie. Samme farveprikker som banefliserne.

**"Spil igen":** logikken er udtrukket til `src/lib/rebook.ts` og bruges nu af både websitet og appen gennem to nye endepunkter (`/api/v1/bookings/repeatable`, `/api/v1/bookings/rebook`). Det er bevidst delt kode, ikke to udgaver af den samme forretningslogik — to udgaver ville før eller siden opføre sig forskelligt.

**To reelle fejl fundet og rettet undervejs:**

- Login-skærmen sagde stadig "TENNIS MAKKER" i store bogstaver. Aldrig omdøbt efter RacketBuddy-skiftet.
- Appens `checkoutUrl()`-hjælper antog altid en relativ sti. Med Stripe slået til returnerer serveren en hel ekstern adresse (`https://checkout.stripe.com/...`), som hjælperen ville have sat foran sin egen serveradresse og ødelagt. Rettet til at genkende og videresende absolutte adresser direkte.

**Trænerskærmen viste mindre end websitet.** `/api/v1/coaches/[id]` manglede pakker og anmeldelser, som websitets tilsvarende side allerede havde. Rettet, så begge flader nu viser det samme.

Bygget og testet: bundler rent til både iOS (819 moduler) og Android (825 moduler) efter alle ændringerne.

## Stripe-webhook: to formater

Stripe udsender events i to formater. Det klassiske ("snapshot") indeholder hele objektet i beskeden. Det nyere ("thin") sender kun et event-id, som modtageren selv skal slå op bagefter.

Webhooken blev første gang oprettet med "thin" som payload style, og da koden kun forstod snapshot-formatet, **fejlede hver eneste webhook tavst** med `You passed a thin event notification to a function that expects a webhook`. Alt så rigtigt ud i Stripe-panelet (destination Active, korrekt adresse), men ingen betaling ville nogensinde være blevet bekræftet.

`/api/webhooks/stripe` håndterer nu begge: den forsøger først den klassiske verifikation, og falder ved fejl tilbage til at læse event-id'et og hente hele eventet fra Stripe. Opslaget er samtidig verifikationen — et opdigtet id findes ikke hos Stripe.

Det gør opsætningen robust over for, hvilken payload style der er valgt i panelet. Snapshot anbefales stadig, fordi det sparer et ekstra kald pr. event.

## Bookingfejl vises som beskeder, ikke serverfejl

Alle fejl i bookingflowet blev tidligere kastet som rå undtagelser, hvilket gav en blank "Application error"-side. En bruger der lige havde trykket på en bane, fik altså ingen anelse om hvad der gik galt eller hvad de skulle gøre.

`bookCourtSlot()` og `bookCoachSlot()` sender nu i stedet brugeren tilbage til klubbens eller trænerens side med en læsbar besked: tiden var taget, tidspunktet er passeret, eller klubben kan ikke modtage betaling endnu.

**Reservationen ryddes op ved fejl.** Kan betalingen ikke startes — typisk fordi modtageren ikke har fuldført Stripe-opsætningen — annulleres den oprettede reservation med det samme. Ellers ville tiden stå blokeret i ti minutter for alle andre, uden at nogen havde betalt for den.

**Klub-admin advarer nu tydeligt**, når udbetalinger ikke er sat op: "Gæster kan ikke booke hos jer endnu." Uden det ville en klub kunne frigive tider i god tro og først opdage problemet, når en gæst klagede.


### Faldgrube: redirect() må ikke ligge i en try/catch

`redirect()` i Next virker ved at kaste en intern undtagelse, som framework'et selv fanger. Ligger kaldet inde i en `try/catch`, der fanger alt, bliver omdirigeringen slugt — og brugeren sidder tilbage med en side, der bare bliver ved med at loade, uden fejl nogen steder.

Præcis det skete, da fejlhåndteringen ovenfor blev bygget: betalingsfejlen blev fanget korrekt, men den efterfølgende omdirigering til fejlbeskeden forsvandt i samme `catch`. Rettet ved at fange kun selve betalingsfejlen og placere `redirect()` bagefter, uden for blokken.

## Klubber uden betalingsopsætning vises ærligt

En klub kan være godkendt og have frigivet tider, men endnu ikke have fuldført sin Stripe-opsætning. Uden en spærring ville gæster kunne se ledige tider, trykke book, og først dér få at vide, at det ikke kan lade sig gøre.

Tre steder tager nu højde for det:

- **Forsidens tal** ("N ledige banetimer nær dig") tæller kun klubber, der faktisk kan modtage betaling. Tallet er et løfte, og det skal kunne holdes.
- **Klublisten** viser ikke "ledige i dag" for klubber, der ikke kan bookes.
- **Klubsiden** viser en tydelig besked øverst: klubben kan ikke tage imod bookinger endnu, og tiderne er vejledende.

De fem demo-klubber, der blev oprettet for at have noget at vise på kortet, falder i denne kategori — de har aldrig haft en Stripe-konto. Det var netop dem, en testbooking ramte, hvilket gjorde problemet synligt.

## Opsætning uden en tur forbi Render

`/superadmin/opsaetning` samler alt det, der ellers ville være miljøvariabler: Stripe-nøgler, webhook-hemmelighed, provision, mailnøgle, afsender, modtageradresse og appens egen adresse. Værdierne gemmes i tabellen `PlatformSetting` og slår igennem med det samme — ingen genstart, intet login hos Render.

**Hvorfor ikke bare miljøvariabler.** At rette en nøgle på Render kræver, at man logger ind der og venter på en genstart. Det er et dårligt sted at have sin provision liggende, når man opdager en fejl søndag aften.

**Rækkefølgen er database → miljø → standard.** Er feltet ikke udfyldt i appen, gælder miljøvariablen præcis som før. En tom tabel opfører sig altså identisk med den gamle opsætning, og der er ingen udrulning, hvor tingene står tomme et øjeblik. Ved hvert felt står det, hvis værdien kommer fra serveren i stedet for fra appen.

**Hemmeligheder krypteres.** Stripe-nøgler og mailnøglen gemmes AES-256-GCM-krypteret, med en nøgle udledt af `AUTH_SECRET`. De sendes aldrig ud til browseren — feltet står tomt med et maskeret spor i pladsholderen, og et tomt felt betyder "behold den, der står". Skiftes `AUTH_SECRET`, kan de gemte hemmeligheder ikke længere læses; så bruger appen miljøvariablerne igen, og nøglerne må tastes ind på ny.

**To ting kan ikke flyttes.** `DATABASE_URL` og `AUTH_SECRET` er adgangen til databasen og nøglen, der låser de gemte hemmeligheder op. De kan i sagens natur ikke ligge i den database, de selv låser op, og rettes fortsat hos Render.

**Tabellen lægges ind ved bygning.** `npm run build` kører `prisma db push`, før `next build`. Fejler det — fx uden `DATABASE_URL` i byggemiljøet — fortsætter bygningen alligevel, og opsætningssiden siger så tydeligt, at tabellen mangler, og hvad man gør ved det. Appen kører videre på miljøvariablerne i mellemtiden.

## Når platformen og klubberne står i hvert sit land

Platformens Stripe-konto behøver ikke være dansk. Er den det ikke, bliver udbetalingerne til klubberne grænseoverskridende, og det ændrer tre ting.

**`on_behalf_of` er ikke tilladt.** Stripe understøtter ikke destination charges med `on_behalf_of`, når udbetalingen krydser en grænse. Vi bruger den parameter til abonnementsklubber, netop for at flytte Stripes gebyr over på klubben, når vores egen andel er 0 kr. Sættes den alligevel, afvises kaldet, og hver eneste booking hos en abonnementsklub fejler.

`startCheckout()` slår derfor parameteren fra, når platformens land ikke er det samme som klubbens. Så bærer vi gebyret i stedet — og det er, hvad abonnementet skal dække. Landet slås op én gang pr. proces i `platformAccountCountry()`.

**Stripe skal slå det til.** Grænseoverskridende udbetalinger afgøres af Stripe ud fra platformens profil. Er de ikke slået til, skal Stripe Support kontaktes. Selvtestens forbindelsestjek viser nu platformens land og siger til, hvis klubberne ligger et andet sted.

**Det koster.** Stripe tager et gebyr pr. grænseoverskridende udbetaling, og betalinger i DKK, der udbetales i en anden valuta, veksles undervejs. Provisionsregnestykket i selvtesten regner med danske indenlandske kortgebyrer og passer derfor ikke, når platformen ligger uden for landet — tallene dér er et gulv, ikke et facit.

## Fra sandkasse til live

Ét felt styrer det: den hemmelige Stripe-nøgle under `/superadmin/opsaetning`. Skiftes `sk_test_…` ud med `sk_live_…`, flytter hele appen med i samme øjeblik. Der er ingen anden kontakt.

Men tre ting følger ikke med, fordi de bor i Stripe og ikke hos os:

**Webhooken.** Endpointet og dets signeringsnøgle findes kun i den verden, de blev oprettet i. Tryk på "Opret webhooken hos Stripe" igen efter skiftet — knappen bruger den nye nøgle og gemmer den nye signeringsnøgle.

**Kundeportalen.** Konfigureres pr. tilstand under Settings → Billing → Customer portal.

**Klubbernes og trænernes Connect-konti.** Et `acct_`-id fra sandkassen eksisterer ikke i live. Alle klubber og trænere skal igennem udbetalingsopsætningen forfra. Bookinger fejler heldigvis sikkert imens — de afvises frem for at sende penge det forkerte sted hen.

Det sidste var værd at hærde. `stripeChargesEnabled` i databasen er sidst kendte status, og efter skiftet ville den blive ved med at påstå, at klubben var klar, mens enhver booking blev afvist. Nu gælder to ting: `refreshAccountStatus()` skriver `false`, hvis kontoen slet ikke kan slås op, i stedet for at lade den gamle værdi stå — og selvtestens liste over modtagere spørger Stripe om hver enkelt konto frem for at tro på databasen. Listen retter altså samtidig det, den finder forkert.

## Sæsonhold

Træningshold over en sæson: "Voksne begyndere, tirsdag 18-19, forår 2026". Halbookings "Book sæsonhold".

**Holdet reserverer ikke banen.** Klubben lægger holdene i sit skema og spærrer tiden med en fast bane, hvis den skal låses. Ville vi selv oprette 22 bookinger pr. hold, ville en aflyst træning i efterårsferien kræve, at nogen huskede at slette syv bookinger — én pr. deltager.

**Pladsen er først reserveret, når der er betalt.** Alternativet ville betyde, at et hold på otte kunne stå fuldtegnet med otte halvfærdige tilmeldinger, og klubben ville tro, de var solgt.

## Klubbens klippekort

Ti banetimer betalt på én gang. Trænerne har det i forvejen; dette er klubbens egen udgave til banetid.

Klippet trækkes betinget i databasen — `updateMany` med en betingelse på `sessionsUsed` — så to bookinger på samme tid ikke kan bruge det sidste klip to gange. Det er databasen, der afgør rækkefølgen, ikke to forespørgsler.

**Til forskel fra trænernes kan klubbens klip udløbe.** En klub, der sælger et sommerklippekort, skal ikke have folk til at møde op med klip fra 2023.

**Klippet bruges kun, hvis timen koster noget.** Er den gratis i forvejen — et medlem med fri banetid — ville et klip være spildt.

## Kvitteringer

Ingen ny tabel. Alt er betalt i forvejen og står i `Payment`, `Membership`, `TeamSignup`, `PackagePurchase` og `ClubPunchPurchase`. En fakturatabel ved siden af ville være en kopi, der kunne komme til at sige noget andet end betalingen selv.

**Derfor er der heller ikke et fakturanummer.** Et nummer skulle være fortløbende pr. klub for at være en rigtig faktura, og det er en bogføringsforpligtelse, klubben har over for SKAT — ikke en, vi kan påtage os på deres vegne. Det er kvitteringer, og de hedder det.

## Automatisk fornyelse af kontingent

Den funktion, jeg holdt tilbage længst. Et kontingent på 1.200 kroner, der bliver trukket hos et medlem, som troede de var meldt ud, er den slags fejl en forening husker i årevis.

Tre spærrer:

1. **Medlemmet slår den aktivt til.** Ikke et forudafkrydset felt.
2. **Besked 14 dage før hver opkrævning**, med et link til at slå den fra. Det er også, hvad forbrugerbeskyttelse forventer af en tilbagevendende betaling.
3. **Opkrævning kun hvis klubben selv har oprettet den nye sæson** og koblet den til den gamle via `renewsFromId`. Vi gætter ikke på næste års pris.

Kortet gemmes hos Stripe med en setup-session, ikke hos os — vi har et kunde-id og intet andet. Opkrævningen er `off_session`, som kræver netop den slags samtykke.

Fornyelserne kører i det eksisterende cron-job. Egen cron ville være renere, men Render tager penge pr. job, og de to har samme rytme. Fejler fornyelserne, tager de ikke synkroniseringen med sig: en fejlet opkrævning er ærgerlig, en klub uden opdateret kalender er værre.

## Kontingent

Klubbens indtægt, og den funktion der afgør, om en klub kan forlade Halbooking. Booking kan man leve uden i en måned; kontingentet er hele foreningens økonomi.

**Sæsoner frem for løbende måneder.** "Sommer 01.05 – 30.09" til en fast pris, som danske klubber gør det. En månedlig model ville tvinge klubberne til at lave deres vedtægter om for at bruge os.

**Betaling én gang pr. sæson, ikke automatisk fornyelse.** Fornyelse med gemt kort kan bygges, men den skal være rigtig: et kontingent, der bliver trukket hos et medlem, der troede de var meldt ud, er den slags fejl en forening husker. Indtil da åbner klubben den nye sæson, og medlemmet tilmelder sig igen.

**Egen række pr. sæson frem for et felt på User.** Så har klubben en historik, og et medlem kan have både sommer- og vinterkontingent samtidig. Et felt ville betyde, at fornyelsen overskrev sidste sæson — og så kan ingen svare på, hvem der var medlem i 2025.

**Kontingentet går ubeskåret til klubben.** Vi tager intet af det; vi lever af abonnementet. Et fradrag i foreningens medlemsindtægt ville være en anden aftale end den, vi har solgt.

**En kontingenttype lukkes, den slettes ikke.** Medlemmer, der har betalt, har en række, der peger på typen. En sletning ville tage deres kontingent med — og dermed beviset for, at de har betalt.

### To modeller for medlemskab, side om side

`countsAsMember()` afgør prisen, og den håndterer to virkeligheder:

- Klubber **uden** kontingent hos os bruger tilmeldingskoden. Der er `User.clubId` hele sandheden.
- Klubber **med** kontingent skal have betalingen til at gælde, ellers ville et medlem, hvis sæson sluttede i september, booke til medlemspris resten af året.

Reglen: koblet til klubben, OG hvis klubben har kontingenter, skal et af dem være betalt og løbende. Uden det sidste led ville de klubber, der ikke bruger vores kontingent, miste deres medlemspriser den dag funktionen blev udrullet.

**En fejl fundet undervejs, værd at kende.** `bookCourtSlot` hentede ledigheden uden `isMember`, så prisen ved booking altid var gæsteprisen — mens klubsiden viste medlemsprisen. Et medlem så "0 kr" og blev sendt til en betaling på fuld pris. Samme fejl i mobil-API'et. Begge rettet; den slags opdager man som en klage, ikke som en fejl i en log.

## Faste baner

Samme bane, samme ugedag, samme klokkeslæt, hele sæsonen. Den funktion, en tennisklub spørger om først.

**Klubben tildeler, medlemmet booker ikke selv.** Det er sådan det foregår i virkeligheden: faste baner fordeles af bestyrelsen efter anciennitet eller lodtrækning, og der er flere ansøgere end tider. En selvbetjent "book fast bane" ville give den til den, der sad ved computeren klokken otte den rigtige morgen.

**Reglen står i `FixedSlot`; timerne oprettes som almindelige `Booking`-rækker.** Det er valget, der betyder mest: så virker ledighed, aflysning, kvitteringer, dørkoder og klubbens overblik uændret. Der er én slags booking i resten af systemet, og det er den, alt andet allerede kan håndtere. En "virtuel" booking, der regnes ud hver gang nogen ser på kalenderen, ville skulle indarbejdes i hvert eneste opslag — og glemmes i ét af dem.

**En optaget uge springes over, resten oprettes.** Alternativet — at afvise hele sæsonen, fordi én uge er booket — ville betyde, at en klub ikke kunne tildele en fast bane, hvis nogen tilfældigvis havde taget en enkelt tid. De oversprungne datoer meldes tilbage, så klubben selv kan tage stilling.

**Ophævelse fjerner kun kommende timer.** Spillede timer bliver stående; de er historie, og en klub skal kunne se, hvem der har brugt banen.

Højst et år ad gangen. En fast bane, der løber til 2035, ville oprette hundredvis af bookinger og gøre kalenderen ubrugelig.

Datoregningen ligger i `fixed-slots-core.ts` uden importer, så den kan afprøves — seks tests dækker sæsonlængde, inklusive slutdato, og at søndag er dag 0.

## Sletning af konto

Sletning var før ét ord i et felt. Det er for lidt, når kontoen kan være den eneste vej ind i en klub, der har taget imod penge.

**Både ordet og adgangskoden.** Ordet beskytter mod et fejlklik; adgangskoden beskytter også mod en, der sætter sig ved en åben skærm.

**Spærringerne vises på forhånd**, ikke efter man har skrevet sin adgangskode. `checkDeletion()` skelner mellem to slags:

- **HARD** — kan ikke slettes. Klubben ville stå uden administrator, eller en elev har betalt for timer, der ikke er givet.
- **SOFT** — kan slettes, men personen skal vide hvad de mister.

**Den tungeste er den eneste klubadministrator.** Klubben ville ikke være slettet — den ville være låst ude af sig selv: ingen kan frigive tider, godkende medlemmer, se omsætningen eller opsige abonnementet.

**Derfor kan klubben nu udpege flere administratorer.** "Udpeg en anden først" er et råd, man skal kunne følge uden at skrive til os. Den sidste administrator kan heller ikke fjerne sig selv — ellers kunne klubben låse sig ude ad en anden vej.

**En træner med kommende timer eller ubrugte klip kan ikke slette sig.** En elev, der har betalt for en time i næste uge, skal ikke møde op til en træner, der ikke findes.

## Priser: bane, tidspunkt, medlemskab

Indtil nu var der én pris for hele klubben. Men en hal koster mere end en grusbane, og fredag klokken 18 koster mere end tirsdag klokken 10 — det er reglen i enhver klub med en hal, og den kunne ikke skrives.

**Tre niveauer, mest specifik vinder:** en prisregel der dækker banen, ugedagen og timen; ellers banens egen pris; ellers klubbens. Rækkefølgen betyder, at en klub kan sætte hallens pris én gang på banen og kun skrive de regler, der afviger — frem for at gentage hallens pris i hver eneste regel.

**Rammer flere regler samme time, vinder den øverste.** Så kan en specifik regel lægges over en bred: "alle baner hverdage 17-21" med "hal 1 fredag 17-21" ovenover.

**`toHour` er eksklusiv.** 17 til 21 dækker 17, 18, 19 og 20. Det er sådan en klub siger det, og samme konvention som åbningstiderne.

**En regel uden medlemspris fjerner ikke medlemsrabatten.** Medlemmet falder ned ad trappen til banens eller klubbens medlemspris frem for op til gæsteprisen. Uden det ville en regel om prime time ved et uheld fjerne rabatten.

Regningen ligger i `pricing.ts` uden database: den kaldes for hver celle i kalenderen, og et opslag pr. celle ville være hundredvis pr. sidevisning. Ti tests dækker den.

**Baner er nu indendørs eller udendørs.** Det vises i bookingen, fordi det afgør, om man kan spille i regnvejr.

## Medlemmer booker på klubbens vilkår

Det, der gør RacketBuddy til en erstatning frem for et tillæg. En klub kan ikke forlade Halbooking, hvis deres medlemmer skal begynde at betale for at booke deres egne baner.

**Sæt medlemsprisen til 0, og bookingen bekræftes uden betaling.** Stripe afviser i øvrigt et beløb på nul, så vejen udenom var ikke bare pænere — den var nødvendig. Kvitteringen med dørkoden sendes stadig; derfor er `notifyBookingConfirmed()` nu eksporteret fra payments.ts.

**Tre regler, som enhver dansk klub har en holdning til:**

- `memberWindowDays` — hvor mange dage frem et medlem kan booke. Standard 14.
- `guestWindowDays` — det samme for gæster. Standard 7, altså kortere, så medlemmerne får første ret til de gode tider.
- `memberMaxActive` — hvor mange aktive bookinger et medlem må have. Standard 2. Uden et loft kan én person reservere hele ugen, og det er den klage, en bestyrelse hører først.

Loftet gælder kun medlemmer. En gæst betaler for hver time og har ingen grund til at hamstre; et medlem, der booker gratis, har.

**Reglerne håndhæves på serveren, ikke kun i skemaet.** Knapperne på siden er ikke den eneste vej ind, og et loft man kan omgå med en formular er intet loft. Afvisningen vises som en læsbar besked på klubbens side, ikke som en fejlkode.

**Regnestykket ligger i `club-rules-core.ts` uden importer**, så det kan afprøves uden database — seks tests dækker gæst mod medlem, medlem af en anden klub, og gratis mod betalt. `club-rules.ts` lægger databasedelen ovenpå.

## Automatisk spærring i klubbens eget system

Den vej, WannaSport bruger. Klubben giver os et login, og så spærrer vi selv de tider, de frigiver hos os — i stedet for at de skal gøre det i hånden og sætte et flueben.

**To faser, adskilt med vilje.** `ensureBlocks()` ser hvilke tider der er til salg og skriver en række for hver, der mangler at blive spærret; det er kun database og går hurtigt. `processBlocks()` tager rækkerne og kører browseren. Var det ét skridt, ville en klub, der frigiver tyve tider, sidde og vente på tyve browsersessioner — og en fejl halvvejs ville efterlade halvdelen spærret, uden at nogen vidste hvilke.

**Egen tabel, fordi regeltider ikke findes som rækker.** De regnes ud af `GuestRule` i farten, så der er ikke noget at sætte et flag på. `SystemBlock` er kvitteringen: denne bane, dette tidspunkt, spærret hos klubben, og hvornår.

**Fjorten dage frem, ti ad gangen.** Længere ville betyde hundredvis af browsersessioner for en klub, der frigiver hverdage året rundt. Uden et loft pr. kørsel ville et cron-job med to hundrede ventende tider køre i to timer og blive dræbt undervejs.

**Efter fem forsøg står tiden som fejlet**, og klubben får den at se med besked om at spærre den i hånden. En række, der forsøges i det uendelige, er en fejl, ingen opdager.

**Fluebenet forsvinder, når vi har et login.** At bede klubben love, at de har gjort vores arbejde, ville være noget rod.

**Vi fjerner ikke spærringer i klubbens system.** Det kræver en anden automatisering, og en fejl dér ville frigive en tid, en gæst har betalt for. Fjerner klubben adgangen, bliver spærringerne stående, og de rydder selv op.

## Automatisering mod klubbens eget bookingsystem

Til klubber, der ikke kan forlade fx Halbooking — en lang kontrakt, eller bare uvilje mod at skifte. Vi logger ind som dem i en usynlig browser og fører bookingen ind, så deres system er opdateret uden at klubben rører ved noget.

Globus Data har oplyst, at de tolererer det, og at deres software ikke opdateres. Det sidste er afgørende: browserautomatisering knækker normalt, fordi HTML'en flytter sig, og en side der ikke ændres, flytter sig ikke.

**Egen service, ikke en del af hovedappen.** `automation/` bygges som Docker med Playwrights eget browserbillede. To grunde: browseren kræver ~1 GB og et snes systembiblioteker, og lagde man det i hovedappens byggetrin, ville hver udrulning af hjemmesiden afhænge af, at et browserbillede kan hentes. En browser, der hænger, tager desuden hukommelsen med sig — her kan den kun tage denne service ned.

**Pengene trækkes efter verifikationen, aldrig før.** `/book` reserverer, henter siden igen og læser, om tiden nu står som optaget. Først når svaret er `verified: true`, må gæsten trækkes. En automatisering, der fejler tavst, ville ellers efterlade en betalt booking uden bane — og to hold på samme bane.

**Adgangskoden krypteres** med samme mekanik som Stripe-nøglerne, nu løftet ud i `src/lib/crypto-box.ts`, så der ikke findes to udgaver af krypteringskode i projektet. Egen tabel frem for felter på `Club`: rækken kan slettes, når en klub stopper, og en klub uden automatisering har ingen tom hemmelighed liggende.

**Selektorerne er ikke skrevet endnu, og det er med vilje.** De står i `automation/src/selectors.js` som gæt. De kan ikke skrives på forhånd — en selektor mod en side, man ikke har set, er kode, der ser rigtig ud og ikke virker.

`/superadmin/automatisering` finder dem: den logger ind, lister hvert felt, hver knap og hvert link med de attributter man vælger dem ud fra, dumper skemaets celler og tager et skærmbillede. Udfyld `selectors.js` ud fra det, udrul, prøv igen. Regn med et par runder.

**Opsætning:** opret en Docker-service på Render med rodmappen `automation`, sæt `AUTOMATION_SECRET` på den, og sæt `AUTOMATION_URL` og `AUTOMATION_SECRET` på hovedservicen. Servicen må ikke være offentligt tilgængelig — den logger ind i klubbers bookingsystemer.

## Klubbens eget domæne

En klub kan få sin side på `booking.jerklub.dk` eller `jerklub.dk`. Tre dele skal passe sammen.

**Værtsnavnet afgør klubben.** `src/middleware.ts` genkender et fremmed værtsnavn og omskriver `/` til `/domaene/<host>`, som slår klubben op og renderer `ClubPage`. Middleware kører på edge og kan ikke tale med databasen — derfor omskrivningen frem for et opslag.

**Siden renderes, den omdirigerer ikke.** Det var fejlen før: `/domaene/<host>` sendte videre til `/klub/<slug>`, så en besøgende på klubbens domæne endte på racketbuddy.app et sekund senere. Klubben havde betalt for en hjemmeside, der afleverede deres trafik hos os. Klubsiden er nu trukket ud i `src/components/ClubPage.tsx` og bruges af begge ruter — samme kode, ét sted at vedligeholde.

**Vores navigation vises ikke.** Layoutet læser værtsnavnet og skjuler header og bundlinje på et fremmed domæne. Tilbage står en enkelt linje: booking leveret af RacketBuddy. `isOwnHost()` ligger i `src/lib/hosts.ts`, fordi både middleware og layout skal bruge den samme vurdering — to kopier af den liste driver fra hinanden, og resultatet er "RacketBuddy · Book bane" i toppen af en klubs hjemmeside.

**Alt andet end roden omdirigeres til vores domæne.** Login, betaling, beskeder og profiler hører hos os: sessionscookien skal ikke findes i tyve varianter, og Stripes returadresser peger på `appUrl` uanset hvor man kom fra. Uden det kunne en klubs domæne vise hele RacketBuddy, inklusive andre klubbers sider.

**Det manuelle led, som ikke kan bygges væk.** Domænet skal tilføjes hos Render, før certifikatet kan udstedes, og det kan ikke gøres fra koden. Klubben opretter DNS-posten, skriver til os, og vi tilføjer domænet. `DomainForm` siger det højt — en klub, der tror det sker automatisk, ringer på dag to.

## Klubber med eget bookingsystem: spær først, frigiv bagefter

Halbooking har ingen grænseflade, tredjeparter kan skrive til. Der findes partnerintegrationer (kasseapparater, adgangskontrol), men de er aftaler med Globus Data, ikke en åben API. Så vi kan ikke reservere en tid i Halbooking, når den bookes hos os.

Den rækkefølge, der gør dobbeltbooking umulig, kræver ingen integration:

1. Klubben spærrer timerne i sit eget system.
2. Klubben frigiver dem hos os.
3. Timerne findes nu kun ét sted.
4. Booker en gæst, skriver klubben navnet på — bogføring, ikke beskyttelse.

**Systemet håndhæver rækkefølgen.** Har klubben et eget system (`integrationType !== "NATIVE"`), kræver både reglen og enkeltfrigivelsen et flueben på, at spærringen er sket. Serveren afviser uden — `requireBlockedFirst()` i actions.ts stoler ikke på, at knappen var der.

Den omvendte rækkefølge, som mailen før opfordrede til ("før tiden ind, så den ikke bliver dobbeltbooket"), har et tidsvindue, hvor et medlem kan nå at booke samme time i klubbens system. Mailen siger nu i stedet: skriv navnet på, tiden er spærret i forvejen.

**Genkendelse er ikke integration.** `src/lib/detect.ts` kigger på klubbens hjemmeside og genkender Halbooking, Matchi m.fl. Det bruges til at sige rent ud, hvad der er muligt — ikke til at love, at vi kan læse fra systemet.

## Gennemgang af platformen, 3. september 2026

Tretten ting tjekket i koden og på Render. Fem var problemer.

**Tidszone (kritisk, rettet).** Serveren kørte UTC, og al tidsregning bruger serverens lokale tid: `setHours`, `getDay`, `format`, "er tiden passeret". En regel for "kl. 9" blev til kl. 9 UTC, altså 11 dansk sommertid. Værst ved døgngrænsen: kl. 00.30 dansk tid er kl. 22.30 UTC dagen før, så "tirsdag" blev til mandag. Og en iCal-feed fra et dansk system kom ind med rigtig tidszone og blev sammenlignet mod UTC-tider — to timers forskydning og dermed dobbeltbookinger. Rettet med `TZ=Europe/Copenhagen` i miljøet. Databasen var tom, så intet gammelt skulle rettes.

**Byggekommandoen (kritisk, skal rettes i Renders panel).** `prisma db push --accept-data-loss` kører ved hver udrulning. Flaget betyder, at Prisma må slette kolonner og tabeller uden at spørge, hvis skemaet ændrer sig. Med en tom database var det bekvemt; med rigtige klubber er det en måde at miste data på ved en fejl i en commit. Fjern flaget. Uden det stopper Prisma og siger, hvad der ville gå tabt, og så tager man stilling.

**Sundhedstjek (rettet).** Render havde ingen sti at spørge, så trafik blev sendt til en instans, så snart processen var startet — også hvis databasen var væk. `/api/health` spørger databasen og svarer 503, hvis den ikke er der. Stien skal sættes i Renders panel under Health Check Path.

**Bremse på offentlige formularer (rettet).** Oprettelse, klubhenvendelse og hjemmesidebestilling havde ingen. Et script kunne oprette tusind konti på et minut. Samme bremse som ved login, nøglet på adressen.

**Accept af vilkår (rettet).** Der blev ikke gemt hvornår. `termsAcceptedAt` sættes nu ved oprettelse. "De stod på siden" er ikke et bevis, hvis det en dag bliver en tvist.

**Mindre, noteret:**

- Oprettelsen afslører, om en adresse allerede findes ("der findes allerede en konto"). Login er beskyttet mod det; oprettelsen er ikke. Standardløsningen er at svare det samme uanset og sende en mail til adressen i stedet. Ikke gjort.
- Mobilappen forventer stadig en `checkoutUrl` ved trænerbooking. Den får nu `status: "REQUESTED"` i stedet og skal vise "afventer trænerens svar".
- Adgangskode skal være mindst 8 tegn ved oprettelse og 10 ved nulstilling. Bør være det samme.
- Billeder ligger i databasen. Fint nu; ved hundrede klubber med otte billeder hver bør de flyttes til R2 — `storage.ts` har allerede vejen.
- Ingen fejlovervågning. Fejl står kun i Renders log, og ingen får besked. Sentry har en gratis plan, der er rigelig.
- `HOLD_MINUTES` er defineret to steder.

## Prismodel: én pris, ingen provision

199 kr om måneden pr. klub. Banebookinger går ubeskåret til klubbens egen konto — `platformFeeForBooking()` returnerer 0 for alt med en `courtId`.

**Trænertimer er stadig på provision.** En træner er selvstændig og har ikke et abonnement; 199 kr om måneden for en person, der giver to timer om ugen, ville lukke ned for trænerne, før de kom i gang. `commissionPct` gælder derfor kun `kind: "COACH"` og pakkeforløb.

**Konsekvensen af manglende betaling er ny.** Før faldt en klub uden aktivt abonnement tilbage på 10% af hver booking, så der altid var en indtægt. Med én pris findes den reserve ikke, og uden en konsekvens kunne en klub bruge platformen gratis for evigt.

Løsningen: `requireActiveSubscription()` spærrer for at frigive nye tider. Både faste regler og enkelttider afviser, hvis abonnementet ikke er aktivt.

**Kun nye tider spærres.** Bookinger, en gæst har betalt for, står ved magt. Gæsten kan ikke gøre for, at klubbens kort er udløbet, og en aflyst spilletid er en dårlig måde at inddrive 199 kr på.

`Club.billingModel` bliver stående i skemaet med værdien SUBSCRIPTION for alle. At migrere feltet væk er en større ting end en konstant, og feltet koster ingenting at lade ligge.

## Selvtest af betalingskæden

`/superadmin/selvtest` kører hele betalingsopsætningen igennem på serveren og viser resultatet ét sted. Formålet er at slippe for at klikke sig igennem en rigtig booking hver gang, man vil vide, om noget virker.

Den tjekker:

- **Opsætning** — én linje: mangler der noget, eller er alt sat. Selve værdierne hører hjemme på `/superadmin/opsaetning`, hvor de også kan rettes
- **Forbindelse til Stripe** — et rigtigt kald, ikke bare "nøglen ser rigtig ud"
- **Kundeportal** — er Stripes selvbetjening sat op i denne tilstand? Den bruges af knappen, hvor en abonnementsklub selv skifter kort eller siger op. Portalen konfigureres én gang pr. tilstand, og sandkassen tæller ikke i live
- **Betalingsmetoder** — testbetalingen viser nu, hvad kunden faktisk kan vælge imellem. Stripe udfylder selv listen ud fra panelet, så det er det eneste sted, man kan se om fx MobilePay virker for netop denne valuta og konto — panelet viser hvad der er *tilladt*, ikke hvad der virker
- **Webhook** — findes der et endpoint hos Stripe, der peger på vores adresse, i den samme verden som nøglen? Sandkasse og live er adskilte: et endpoint oprettet i en sandkasse findes ikke i live, og dets signeringsnøgle validerer ikke live-events. Tjekket kigger også efter, om endpointet lytter på alle de events, appen behøver
- **Provisionsregnestykket** — hvad klubben får, hvad vi får, og hvad der er tilbage efter Stripes eget gebyr. Ét eksempel: satsen er den samme uanset beløb, så flere linjer viste det samme tal tre gange. Vil man se flere beløb, står de på opsætningssiden ved siden af satsen
- **Modtagere** — hvilke klubber og trænere der kan tage imod penge, hvilke der er halvvejs igennem, og hvilke der ikke er begyndt
- **Testbetaling** — opretter en rigtig checkout-session mod en klar konto med korrekt gebyrsplit, bekræfter at Stripe accepterer den, og **lukker sessionen igen med det samme**. Ingen betaler noget, men det beviser, at nøgle, Connect-konto, gebyrsplit og valuta hænger sammen.

Det er den vigtigste af dem: hvis testbetalingen er grøn, virker kæden for rigtige kunder også.

**Appen kan oprette webhooken selv.** Er tjekket rødt, står der en knap på `/superadmin/opsaetning`, som opretter endpointet hos Stripe med præcis den nøgle, appen selv bruger — så nøgle og endpoint per definition er i samme verden. Stripe udleverer kun signeringsnøglen i selve oprettelseskaldet, og den gemmes i samme kald. Dermed forsvinder både "forkert sandkasse" og "forkert kopieret hemmelighed" som fejlkilder. Findes endpointet allerede, men mangler events, retter knappen dem i stedet.

Logikken bag tjekket og bag knappen ligger samme sted (`src/lib/webhook-setup.ts`), så de aldrig kan blive uenige om, hvad der er rigtigt.

**Bemærk:** webhook-tjekket kan ikke bevise, at `STRIPE_WEBHOOK_SECRET` hører til netop det endpoint — Stripe udleverer kun signeringsnøglen ved oprettelsen. Det kan svare på, om endpointet findes det rigtige sted og lytter på det rigtige, hvilket er de to fejl, der faktisk sker. Selve signaturen viser sig først ved en rigtig betaling.

Det er værd at forstå hvorfor tjekket findes: forkert opsat webhook fejler **tavst**. Betalingen går igennem, pengene flytter sig, og bookingen bliver bare aldrig bekræftet. Og det rammer typisk præcis den dag, man skifter fra sandkasse til live — hvor endpointet, man byggede i sandkassen, pludselig ikke findes.

## Fejl: falsk betalingsbekræftelse

Profilen viste "Tiden er din — kvittering er sendt", udelukkende fordi der stod `?betalt=1` i adressen. Den tjekkede aldrig, om bookingen faktisk var betalt. Det gav to problemer:

1. En ubetalt booking kunne se bekræftet ud, mens den samme side lige nedenfor stadig sagde "Afventer betaling" og viste en "Betal nu"-knap — to modstridende beskeder på samme skærm.
2. Adressen kunne skrives i hånden for at fremkalde en falsk kvittering.

Bekræftelsen afhænger nu af, om der findes en `CONFIRMED` booking oprettet inden for den seneste time. Er man kommet tilbage fra betaling uden at den er registreret, siges det direkte, i stedet for at lade brugeren tro at alt er i orden.

### Den underliggende årsag: omdirigering på tværs af domæner

Brugeren blev sendt til `/profil?betalt=1` uden nogensinde at have set Stripes betalingsside. `startCheckout()` returnerer en adresse på Stripes eget domæne, og en server-`redirect()` til et andet domæne behandles af Next som en intern navigation — browseren kunne derfor ende med at blive stående og lande tilbage på profilen.

Rettet to steder:

- **Bookingflowet** omdirigerer nu til vores egen `/checkout/[id]`-side i stedet for direkte til Stripe.
- **Checkout-siden** sender videre til Stripe med en meta-refresh og viser samtidig et klikbart link, hvis browseren ikke følger med automatisk.

Bookingflowet kontrollerer desuden `stripeChargesEnabled` direkte i databasen i stedet for at oprette en Stripe-session bare for at teste — det sparer et unødigt kald og en overflødig session pr. booking.

### Hvorfor betalingen aldrig nåede til Stripe

Tre forsøg i træk fejlede på samme grundproblem, hver gang med en ny forklædning. Loggen afslørede det til sidst:

```
GET /checkout/<id>?_rsc=1gbqz  →  200
GET /profil?_rsc=1gbqz          →  200
```

`_rsc` betyder, at Next hentede checkout-siden som **data i baggrunden**, ikke som en rigtig sidenavigation. Det sker, fordi knappen var et `<Link>`. Al omdirigering inde i den side — først `redirect()`, siden en meta-refresh — lå dermed i et datasvar, browseren aldrig kørte.

Løsningen er en **route handler** (`/checkout/[id]/start`) i stedet for en side. Den svarer med en ægte HTTP-302 til Stripes adresse, og den følger browseren altid, uanset hvordan den blev kaldt. Knappen er samtidig ændret fra `<Link>` til et almindeligt `<a>`.

Læren: når et flow skal forlade appen til et andet domæne, skal det gå gennem en route handler med et rigtigt omdirigeringssvar — ikke gennem en sidekomponent.

### Bekræftelse sker to steder

Betalingen bekræftes nu ad to uafhængige veje:

1. **`/checkout/[id]/faerdig`** — Stripes `success_url` peger hertil. Ruten spørger Stripe direkte, om sessionen er betalt, og bekræfter bookingen med det samme. Det giver brugeren et korrekt svar i samme øjeblik, de kommer tilbage.
2. **Webhooken** — fanger de tilfælde, hvor brugeren lukker browseren eller mister forbindelsen undervejs. Pengene er trukket, så bookingen skal bekræftes uanset hvad.

`confirmBookingPayment()` er idempotent, så det gør ingen skade, at begge veje kalder den. Uden vej 1 ville en forsinket webhook betyde, at brugeren så "Afventer betaling" umiddelbart efter at have betalt — uden vej 2 ville en lukket browser efterlade en betalt booking som ubekræftet.

## E-mail

Sendes via Resend. Tre variabler styrer det:

| Variabel | Betydning |
|---|---|
| `EMAIL_API_KEY` | Resend-nøgle. Mangler den, logges mails i stedet for at blive sendt |
| `EMAIL_FROM` | Afsender. **Skal ligge på et domæne, der er verificeret hos Resend** — ellers afvises mailen eller lander i spam |
| `ORDERS_EMAIL` | Hvor klubhenvendelser og hjemmesidebestillinger sendes hen |

Afsenderen var oprindeligt sat til `tennismakker.dk` — et domæne, der aldrig har eksisteret. Enhver mail ville være blevet afvist. Nu bruges `racketbuddy.app`, som er verificeret.

**Selvtesten sender en rigtig mail.** `/superadmin/selvtest` afsender en testmail til `ORDERS_EMAIL` hver gang den køres. Det er den eneste pålidelige måde at kontrollere opsætningen på: en uverificeret afsender fejler først i selve afsendelsen, ikke i konfigurationen.

Kommer testmailen ikke frem, men står tjekket som grønt, er nøglen god, men afsenderdomænet er ikke verificeret hos Resend.
