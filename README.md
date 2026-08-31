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
