# Selvbetjent opsætning af lys og adgang

Åbn `/admin#lys-og-adgang` som administrator for klubben. Guiden er lavet til mobil og desktop og husker gemte relævalg og bekræftelser i databasen.

1. **Forbind.** Controllerne skal allerede være monteret og online i Shelly Cloud. Kopiér Server URI og Authorization Cloud Key fra Shelly → User settings → Authorization cloud key. Kopiér Device Id fra hver controllers Settings → Device Information; indsæt ét ID pr. linje. RacketBuddy kontrollerer alle angivne enheder, henter antal switch-kanaler og giver controllerne navne. Ingen relæer aktiveres på dette trin.
2. **Test relæer.** Vælg én kendt funktion ad gangen: banelys, ganglys, dør eller intet tilsluttet. Kør en 3-sekunders test, mens nogen er fysisk til stede, og bekræft at netop den rigtige funktion reagerede og vendte tilbage efter testen. Ubrugte relæer springes over uden fysisk kommando. Alle relæer skal være gennemgået, og mindst ét skal bruges.
3. **Aktivér.** Gennemgå oversigten. Standard: lys 10 min. før / 5 min. efter; dør 15 min. før / 15 min. efter; dørpuls 5 sekunder. Tiderne kan ændres. Serveren kontrollerer online-status igen og afviser aktivering, hvis opsætningen er ændret under kontrollen.

## Ændringer og fejl

- Pause stopper automatisk styring og appens døråbning, men ændrer ikke lysenes aktuelle tilstand. Hav manuel adgang og betjening som fallback.
- Ændrede relævalg nulstiller den pågældende test og bekræftelse. Ændret konto/nøgle nulstiller testbekræftelserne.
- Der kan kun startes én fysisk test pr. klub inden for 15 sekunder. Det begrænser overlappende test under timeout/dobbelttryk.
- En vellykket Cloud-kommando er ikke fysisk bevis. Derfor kræves en særskilt menneskelig bekræftelse.
- Enhedslisten tilføjer/opdaterer de angivne controllere. Eksisterende controllere fjernes kun via den særskilte controlleroversigt med bekræftelse.
- Cloud-nøglen må ikke sendes i e-mail eller indbygges i mobilappen.

## Afgrænsning

Dette er ikke OAuth eller automatisk søgning efter alle enheder på en konto. Den dokumenterede Cloud Control v2 kræver enheds-ID'er. Shelly oplyser, at tredjepartsintegratorer skal få deres eget client ID og callback-konfiguration til OAuth. Brug ikke DIY-identiteten som produktionsintegration for klubber.

- https://shelly-api-docs.shelly.cloud/cloud-control-api/
- https://shelly-api-docs.shelly.cloud/cloud-control-api/communication-v2/
- https://shelly-api-docs.shelly.cloud/cloud-control-api/real-time-events/

## Verifikation

`npm test` tester input og opsætningsregler. `node scripts/test-club-control-ui.cjs` tester seks visningstilstande med mockede server actions ved mobilbredde; kræver Playwright/Chromium. Den sidste test erstatter ikke en integrationstest med login, database og fysisk Shelly-hardware.
