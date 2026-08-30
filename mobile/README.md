# RacketBuddy — mobilapp

iOS- og Android-app til RacketBuddy, bygget med React Native og Expo. Én kodebase til begge platforme.

Appen har ingen egen database. Den taler med web-platformen over HTTP.

Appen ligger i samme repo som websitet, men er et selvstændigt projekt med egne afhængigheder. Kør altid kommandoerne herunder **fra `mobile/`-mappen** — ikke fra roden.

## Kom i gang

```bash
cd mobile
npm install
npx expo start
```

Scan QR-koden med **Expo Go** (hent den i App Store eller Google Play). Så kører appen på din telefon uden at du skal bruge Xcode eller Android Studio.

Appen peger som standard på produktionsserveren. Skal den pege et andet sted, ret `expo.extra.apiUrl` i `app.json`.

## Sådan hænger det sammen

```
App.js                   Navigation: 4 faner, hver med sin stak
src/lib/api.js           API-klient — alle kald mod serveren samles her
src/lib/auth.js          Login-tilstand, token gemmes i AsyncStorage
src/lib/ui.js            Knapper, kort, badges, fejl- og tomme tilstande
src/lib/theme.js         Farver og etiketter, samme som websitet
src/lib/dates.js         Dansk datoformatering uden ekstra pakker
src/screens/             En fil pr. skærm
```

## Hvad appen kan

- Opret profil og log ind
- Se og filtrere makker-opslag, opret eget opslag, slå til på andres
- Se klubber og deres ledige tider, book en bane
- Se trænere og deres ledige tider, book en time
- Se egne kommende bookinger

## Betaling foregår på web

Når du booker, oprettes en reservation gennem API'et, og appen åbner betalingssiden i browseren. Det er et bevidst valg:

- Appen skal aldrig håndtere kortdata, hvilket gør PCI-compliance til serverens problem
- Der er kun ét betalingsflow at vedligeholde
- Banebooking er en fysisk ydelse, så Apples og Googles krav om in-app-køb gælder ikke

## Før appen kan udgives

- **Ikoner og splash screen** mangler. `app.json` peger kun på baggrundsfarver. Uden rigtige ikoner afviser App Store indsendelsen.
- **Apple Developer Program** koster 99 USD/år, **Google Play** 25 USD én gang.
- **Build** laves med EAS: `npx eas build --platform all`. Kræver ikke en Mac.
- **Push-beskeder** er ikke bygget. Det er nok den vigtigste manglende funktion — en besked når nogen slår til på dit opslag er hele pointen med matching.
- **Privatlivspolitik** skal ligge på et offentligt link, før begge butikker godkender.

## Kendte begrænsninger

- Ingen offline-tilstand. Uden netværk viser appen en fejl.
- Faneikoner er emojis, ikke rigtige ikoner.
- Første kald kan tage op mod et minut, hvis serveren kører på Renders gratis plan og er gået i dvale.

## Web-forhåndsvisning

Appen er også bygget som web og ligger på `/app` på serveren, så den kan prøves fra en telefon uden Expo Go og uden en computer.

Sådan opdateres den efter kodeændringer:

```bash
cd mobile
npx expo export --platform web --output-dir ../public/app
```

Forhåndsvisningen er ikke det samme som appen. React Native Web oversætter komponenterne til HTML, så layout og opførsel ligner, men er ikke identisk — og der er ingen push-beskeder, ingen app-ikon og ingen adgang til telefonens funktioner. Brug den til at se flowet og finde fejl i API-kaldene, ikke til at bedømme, hvordan den færdige app føles.
