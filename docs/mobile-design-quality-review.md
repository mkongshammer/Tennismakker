# Mobil kvalitetspas — 19. september 2026

Målet er færre fejltryk, forståelig betaling og læselige skærme. Dette er ikke
en certificering som “bedst i test” eller en fuld WCAG-konformitetserklæring.

## Implementeret

- Efter ny feedback bruger webdemoen sidemenu fra 900 px og bundnavigation
  på mindre skærme. Sportsvalg ombrydes på desktop. Profilindhold er højst
  600 px og uden tom afstand fra skjult “Spil igen”. Mindre tung typografi og en bookinghandling i tomtilstanden.
  Log ud og kontosletning bruger diskrete knapper; sletning er rød og beholder
  sin eksisterende bekræftelsesdialog. Profilens lukknap har en 48 px trykflade.

- Bane- og trænerbooking viser et separat overblik med tidspunkt, sted/person
  og samlet pris. At vælge en tid eller gå tilbage opretter ingen booking.
  Én tydelig bekræftelsesknap udfører handlingen; samtidige tryk låses.
- Trænerforløbet forklarer, at betalingen først sker efter godkendelse.
  Baneforløbet skelner mellem midlertidig reservation og betalt bekræftelse.
- Overblikket kan rulle ved stor systemtekst og har safe area samt tilbageknap.
  Androids tilbagehandling respekterer en igangværende anmodning.
- Sport-, dato-, region-, niveau- og typevalg har mindst 48 enheders højde.
  Niveauvalg har også mindst 48 enheders bredde. Valgt tilstand og niveauets
  navn er tilgængelige for skærmlæsere. Formularvalg låses under afsendelse.
- Fælles handlingsknapper beholder teksten under indlæsning; spinneren ændrer
  ikke knaphøjden. Knaptekst er 16 og kan ombrydes.
- Klubfarver valideres som opaque hex-farver. Sort eller hvid tekst vælges
  automatisk med mindst 4,5:1 kontrast. Tekstens gennemsigtighed er fjernet.
- Klubnavne bliver ikke længere afkortet til én linje. Trænerrækker kan ombrydes,
  og den lyse “ny klub”-tekst er gjort mørkere og større.
- Min profil viser betalingsfristen og erstatter betalingsknappen med
  “Opdatér status”, når fristen er passeret.

## Grundlag

[Androids officielle tilgængelighedsprincipper](https://developer.android.com/guide/topics/ui/accessibility/apps)
anbefaler mindst 48 × 48 dp trykflader, beskrivende handlinger og tilstrækkelig
tekstkontrast. [WCAG 2.2 kontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
og [målstørrelse](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
supplerer kontrollen af webdemoen. Apples HIG-side blev fundet, men indholdet var
ikke tilgængeligt i tekstvisningen; der påstås ikke en gennemført HIG-audit.

## Verificeret og tilbageværende

15 mobile test består, herunder de faktiske bookingkomponenter med isolerede
afhængigheder: tilbage uden booking, korrekt pris/tid, én anmodning ved
dobbelttryk, og ingen checkout før trænergodkendelse. Kontrastvalget er testet
på lyse/mørke farver samt ugyldige input. 114 server-/domænetest består.

Expo-eksport til iOS, Android og web samt Next-produktionsbuild er kontrolleret.
Eksport er ikke en signeret TestFlight-/Play-build. Apple Pay på fysisk enhed,
VoiceOver/TalkBack, stor systemtekst på rigtige små telefoner, visuel kontrol
af det autentificerede bookingforløb og brugertest med klubber mangler stadig.
Se også payment-quality-review.md for finansielle releasekrav.
