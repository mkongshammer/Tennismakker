# RacketBuddy — mobilapp

iOS- og Android-app til RacketBuddy, bygget med React Native og Expo. Én kodebase til begge platforme.

Appen har ingen egen database. Den taler med RacketBuddy-platformen over HTTPS. Appen ligger i samme repo som websitet, men er et selvstændigt projekt med egne afhængigheder. Kør mobilkommandoer fra `mobile/`-mappen.

## Kom i gang

```bash
cd mobile
npm install
npx expo start
```

Appen peger som standard på `https://racketbuddy.app`. Skal en lokal udviklingsbuild pege et andet sted, ret `expo.extra.apiUrl` i `app.json` og sørg for ikke at committe en lokal URL til en release.

## Sådan hænger det sammen

```text
App.js                   Navigation og faner
src/lib/api.js           API-klient mod /api/v1
src/lib/auth.js          Login-tilstand og token i AsyncStorage
src/lib/ui.js            Fælles knapper, kort, badges og states
src/lib/theme.js         Farver og etiketter
src/lib/dates.js         Dansk datoformatering
src/screens/             En fil pr. skærm
scripts/store-check.mjs  Deterministisk release/config-check
```

## Hvad appen kan

- Opret profil med 18+ bekræftelse og accept af vilkår/privatliv
- Log ind og åbne password-reset fra login
- Se spillere og makkeropslag, oprette opslag og starte samtaler
- Rapportere profiler, opslag, samtaler og anmeldelser
- Blokere brugere og administrere blokeringer under Min profil
- Se klubber og ledige tider og booke en bane
- Se trænere, ledige tider og anmeldelser og booke en time
- Se kommende bookinger
- Slette sin konto permanent fra appen

## Betaling

Når en bruger booker en fysisk bane- eller træningsydelse, oprettes reservationen gennem API'et, og appen åbner RacketBuddys web-checkout. Den native app modtager ikke fulde kortnumre.

## Release checks

Kør altid dette før en release candidate:

```bash
cd mobile
npm install
npm run store:check
npm run doctor
npx expo export --platform web --output-dir /tmp/racketbuddy-web
```

Pull requests, der ændrer mobilappen eller dens relevante API'er, kører tilsvarende checks i GitHub Actions sammen med en TypeScript-check af serverkoden.

## Før første cloud-build

RacketBuddy skal være oprettet som sit eget Expo/EAS-projekt under den konto, der skal eje appens builds. Fra `mobile/`:

```bash
npx eas login
npx eas init
```

`eas init` tilføjer projektets EAS `projectId` til appkonfigurationen. Commit den ændring. Brug ikke et EAS-projekt, der tilhører en anden RacketBuddy-uafhængig app.

De permanente application IDs i projektet er:

- iOS bundle identifier: `dk.racketbuddy.app`
- Android package name: `dk.racketbuddy.app`

Kontrollér disse mod App Store Connect og Google Play Console **før den første upload**. Når en app først er oprettet/udgivet under et application ID, skal identifieren behandles som permanent.

## Builds

Preview-build til rigtige enheder/testere:

```bash
npx eas build --profile preview --platform all
```

Production-build til butikkerne:

```bash
npx eas build --profile production --platform all
```

Android production-profilen bygger en Android App Bundle (`.aab`). iOS-buildet bruger EAS' aktuelle understøttede App Store-toolchain for den valgte Expo SDK.

## Submission

Før submission skal følgende ligge klar i de to developer consoles:

- RacketBuddy-app record under den korrekte RacketBuddy LLC-organisation
- Storetekst fra `STORE_LISTING.md`
- Rigtige screenshots fra production-candidate buildet
- Privatlivs-/Data Safety-svar, kontrolleret mod den faktiske produktionskonfiguration
- Content/age-rating questionnaire
- Reviewer-testkonto med data nok til at teste spiller-, besked- og bookingflows
- Offentlige links til privatlivspolitik, vilkår, support og kontosletning

Store submission kan derefter ske med EAS Submit eller direkte i App Store Connect/Google Play Console, afhængigt af hvilke credentials der er sat op.

## Sikkerhed og user-generated content

UGC-funktionerne har server-side moderationskontroller, rapportering og blokering. En blokering håndhæves i spilleroversigten, opslag, nye kontakter, swipe-flow og samtaler. Moderationsrapporter gemmes server-side og sendes til RacketBuddys support/moderationsmail, når mailtjenesten er konfigureret.

Vilkår og privatlivspolitik beskriver brugerindhold, rapportering og blokering. Disse flows skal testes i production-candidate buildet før submission.

## Kendte produktvalg

- Appen er online-first og har ikke offline-mode.
- iPad-support er slået fra i v1, så første iOS-release målrettes iPhone.
- Push-notifikationer er ikke nødvendige for store submission og er ikke med i v1-releasekravet. De kan tilføjes som en senere produktforbedring.
- Web-forhåndsvisningen på `/app` er nyttig til flowtests, men erstatter ikke test på rigtige iOS- og Android-builds.
