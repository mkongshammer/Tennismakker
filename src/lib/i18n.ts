// Oversættelser.
//
// Bevidst en almindelig ordbog frem for et i18n-bibliotek: der er fem sprog
// og et par hundrede strenge, og en manglende nøgle skal fejle synligt i
// stedet for at blive slugt. Kommer der oversættere udefra, som skal kunne
// arbejde uden at røre kode, er det tid til et rigtigt bibliotek.

import type { Locale } from "./sports";

// Record<Locale, …> frem for en løs liste: kommer der et sprog til,
// nægter TypeScript at bygge, indtil hver eneste streng er oversat. Et
// halvt oversat sprog er værre end intet, fordi fejlen først ses af brugeren.
type Dict = Record<string, Record<Locale, string>>;

const T: Dict = {
  // Navigation
  "nav.book": {
    da: "Book bane",
    en: "Book court",
    de: "Platz buchen",
    sv: "Boka bana",
    no: "Book bane",
  },
  "nav.coaches": {
    da: "Find træner",
    en: "Find coach",
    de: "Trainer finden",
    sv: "Hitta tränare",
    no: "Finn trener",
  },
  "nav.players": {
    da: "Find medspiller",
    en: "Find co-player",
    de: "Mitspieler finden",
    sv: "Hitta medspelare",
    no: "Finn medspiller",
  },
  "nav.profile": {
    da: "Min profil",
    en: "My profile",
    de: "Mein Profil",
    sv: "Min profil",
    no: "Min profil",
  },
  "nav.messages": {
    da: "Beskeder",
    en: "Messages",
    de: "Nachrichten",
    sv: "Meddelanden",
    no: "Meldinger",
  },

  // Korte udgaver til bundlinjen på telefon, hvor fire faner skal dele
  // bredden. De lange navne bruges stadig som sidetitler.
  "tab.book": { da: "Book bane", en: "Book", de: "Buchen", sv: "Boka", no: "Book" },
  "tab.coaches": { da: "Trænere", en: "Coaches", de: "Trainer", sv: "Tränare", no: "Trenere" },
  "tab.players": {
    da: "Medspillere",
    en: "Players",
    de: "Spieler",
    sv: "Medspelare",
    no: "Medspillere",
  },
  "tab.messages": {
    da: "Beskeder",
    en: "Messages",
    de: "Nachrichten",
    sv: "Meddelanden",
    no: "Meldinger",
  },
  "nav.admin": {
    da: "Klub-admin",
    en: "Club admin",
    de: "Club-Admin",
    sv: "Klubbadmin",
    no: "Klubbadmin",
  },
  "nav.login": { da: "Log ind", en: "Log in", de: "Anmelden", sv: "Logga in", no: "Logg inn" },
  "nav.signup": {
    da: "Opret profil",
    en: "Sign up",
    de: "Registrieren",
    sv: "Skapa konto",
    no: "Opprett profil",
  },
  "nav.logout": { da: "Log ud", en: "Log out", de: "Abmelden", sv: "Logga ut", no: "Logg ut" },
  "nav.menuOpen": {
    da: "Åbn menu",
    en: "Open menu",
    de: "Menü öffnen",
    sv: "Öppna meny",
    no: "Åpne meny",
  },
  "nav.menuClose": {
    da: "Luk menu",
    en: "Close menu",
    de: "Menü schließen",
    sv: "Stäng meny",
    no: "Lukk meny",
  },

  // Generelt
  "common.perHour": {
    da: "pr. time",
    en: "per hour",
    de: "pro Stunde",
    sv: "per timme",
    no: "per time",
  },
  "common.from": { da: "fra", en: "from", de: "ab", sv: "från", no: "fra" },
  "common.courts": { da: "baner", en: "courts", de: "Plätze", sv: "banor", no: "baner" },
  "common.book": { da: "Book", en: "Book", de: "Buchen", sv: "Boka", no: "Book" },
  "common.save": { da: "Gem", en: "Save", de: "Speichern", sv: "Spara", no: "Lagre" },
  "common.cancel": { da: "Annullér", en: "Cancel", de: "Abbrechen", sv: "Avbryt", no: "Avbryt" },
  "common.loading": {
    da: "Henter…",
    en: "Loading…",
    de: "Wird geladen…",
    sv: "Hämtar…",
    no: "Henter…",
  },
  "common.back": { da: "Tilbage", en: "Back", de: "Zurück", sv: "Tillbaka", no: "Tilbake" },
  "common.all": { da: "Alle", en: "All", de: "Alle", sv: "Alla", no: "Alle" },
  "common.sport": { da: "Sportsgren", en: "Sport", de: "Sportart", sv: "Sport", no: "Sport" },
  "common.country": { da: "Land", en: "Country", de: "Land", sv: "Land", no: "Land" },
  "common.language": { da: "Sprog", en: "Language", de: "Sprache", sv: "Språk", no: "Språk" },
  "common.area": { da: "Område", en: "Area", de: "Gebiet", sv: "Område", no: "Område" },
  "common.level": { da: "Niveau", en: "Level", de: "Niveau", sv: "Nivå", no: "Nivå" },
  "common.price": { da: "Pris", en: "Price", de: "Preis", sv: "Pris", no: "Pris" },

  // Vi starter i Danmark og åbner flere lande senere. Sætningen står to
  // steder: i hero'ens overlinje, hvor den møder en ny besøgende, og i
  // footeren, hvor den bliver stående uanset hvor man er på sitet.
  "availability.now": {
    da: "Tilgængelig i Danmark",
    en: "Available in Denmark",
    de: "Verfügbar in Dänemark",
    sv: "Tillgängligt i Danmark",
    no: "Tilgjengelig i Danmark",
  },
  "availability.soon": {
    da: "Tilgængelig i Danmark — flere lande på vej",
    en: "Available in Denmark — more countries coming",
    de: "Verfügbar in Dänemark — weitere Länder folgen",
    sv: "Tillgängligt i Danmark — fler länder på väg",
    no: "Tilgjengelig i Danmark — flere land på vei",
  },

  // Book bane
  "book.title": {
    da: "Book bane",
    en: "Book a court",
    de: "Platz buchen",
    sv: "Boka bana",
    no: "Book bane",
  },
  "book.intro": {
    da: "Find en ledig bane i en klub nær dig.",
    en: "Find an available court at a club near you.",
    de: "Finde einen freien Platz in einem Club in deiner Nähe.",
    sv: "Hitta en ledig bana i en klubb nära dig.",
    no: "Finn en ledig bane i en klubb nær deg.",
  },
  "book.noClubs": {
    da: "Ingen klubber i dit land med den sportsgren endnu.",
    en: "No clubs in your country for that sport yet.",
    de: "Noch keine Clubs für diese Sportart in deinem Land.",
    sv: "Inga klubbar i ditt land med den sporten än.",
    no: "Ingen klubber i landet ditt med den sporten ennå.",
  },
  "book.available": {
    da: "Ledige tider",
    en: "Available times",
    de: "Freie Zeiten",
    sv: "Lediga tider",
    no: "Ledige tider",
  },
  "book.noneToday": {
    da: "Ingen ledige tider denne dag. Prøv en anden dag ovenfor.",
    en: "No available times this day. Try another day above.",
    de: "An diesem Tag ist nichts frei. Probiere oben einen anderen Tag.",
    sv: "Inga lediga tider den här dagen. Prova en annan dag ovan.",
    no: "Ingen ledige tider denne dagen. Prøv en annen dag ovenfor.",
  },
  "book.holdNote": {
    da: "Tiden holdes i 10 minutter, mens du betaler.",
    en: "The slot is held for 10 minutes while you pay.",
    de: "Die Zeit wird 10 Minuten reserviert, während du bezahlst.",
    sv: "Tiden hålls i 10 minuter medan du betalar.",
    no: "Tiden holdes i 10 minutter mens du betaler.",
  },

  // Trænere
  "coach.title": {
    da: "Find træner",
    en: "Find a coach",
    de: "Trainer finden",
    sv: "Hitta tränare",
    no: "Finn trener",
  },
  "coach.intro": {
    da: "Book en enkelt time eller et helt forløb.",
    en: "Book a single session or a full package.",
    de: "Buche eine einzelne Stunde oder ein ganzes Paket.",
    sv: "Boka en enstaka timme eller ett helt paket.",
    no: "Book en enkelttime eller et helt forløp.",
  },
  "coach.none": {
    da: "Ingen trænere fundet.",
    en: "No coaches found.",
    de: "Keine Trainer gefunden.",
    sv: "Inga tränare hittades.",
    no: "Ingen trenere funnet.",
  },
  "coach.singleSession": {
    da: "Enkelt time",
    en: "Single session",
    de: "Einzelstunde",
    sv: "Enstaka timme",
    no: "Enkelttime",
  },
  "coach.packages": { da: "Pakker", en: "Packages", de: "Pakete", sv: "Paket", no: "Pakker" },
  "coach.sessions": { da: "timer", en: "sessions", de: "Stunden", sv: "timmar", no: "timer" },
  "coach.perSession": {
    da: "pr. time",
    en: "per session",
    de: "pro Stunde",
    sv: "per timme",
    no: "per time",
  },
  "coach.availableTimes": {
    da: "Ledige tider",
    en: "Available times",
    de: "Freie Zeiten",
    sv: "Lediga tider",
    no: "Ledige tider",
  },
  "coach.editProfile": {
    da: "Redigér trænerprofil",
    en: "Edit coach profile",
    de: "Trainerprofil bearbeiten",
    sv: "Redigera tränarprofil",
    no: "Rediger trenerprofil",
  },

  // Medspillere
  "players.title": {
    da: "Find medspiller",
    en: "Find a co-player",
    de: "Mitspieler finden",
    sv: "Hitta medspelare",
    no: "Finn medspiller",
  },
  "players.intro": {
    da: "Se spillere på dit niveau i dit område, én ad gangen.",
    en: "See players at your level nearby, one at a time.",
    de: "Sieh dir Spieler auf deinem Niveau in deiner Nähe an, einen nach dem anderen.",
    sv: "Se spelare på din nivå i ditt område, en i taget.",
    no: "Se spillere på ditt nivå i ditt område, én om gangen.",
  },
  "players.skip": {
    da: "Spring over",
    en: "Skip",
    de: "Überspringen",
    sv: "Hoppa över",
    no: "Hopp over",
  },
  "players.interested": {
    da: "Vil spille",
    en: "Want to play",
    de: "Will spielen",
    sv: "Vill spela",
    no: "Vil spille",
  },
  "players.matchNote": {
    da: "Siger I begge ja, åbner der en samtale. Den anden får ikke besked, hvis du springer over.",
    en: "If you both say yes, a conversation opens. They are not told if you skip.",
    de: "Sagt ihr beide ja, öffnet sich ein Gespräch. Überspringst du, erfährt die andere Person nichts.",
    sv: "Säger ni båda ja öppnas en konversation. Den andra får inte veta om du hoppar över.",
    no: "Sier dere begge ja, åpnes en samtale. Den andre får ikke beskjed hvis du hopper over.",
  },
  "players.empty": {
    da: "Ikke flere lige nu. Kig forbi igen om et par dage.",
    en: "No more right now. Check back in a couple of days.",
    de: "Gerade niemand mehr. Schau in ein paar Tagen wieder vorbei.",
    sv: "Inga fler just nu. Kom tillbaka om ett par dagar.",
    no: "Ikke flere akkurat nå. Stikk innom igjen om et par dager.",
  },

  // Profil
  "profile.title": {
    da: "Min profil",
    en: "My profile",
    de: "Mein Profil",
    sv: "Min profil",
    no: "Min profil",
  },
  "profile.bookings": {
    da: "Kommende bookinger",
    en: "Upcoming bookings",
    de: "Kommende Buchungen",
    sv: "Kommande bokningar",
    no: "Kommende bookinger",
  },
  "profile.settings": {
    da: "Indstillinger",
    en: "Settings",
    de: "Einstellungen",
    sv: "Inställningar",
    no: "Innstillinger",
  },
  "profile.mySports": {
    da: "Mine sportsgrene",
    en: "My sports",
    de: "Meine Sportarten",
    sv: "Mina sporter",
    no: "Mine sporter",
  },

  // Landevalget, første gang nogen lander på siden
  "country.title": { da: "Hvor spiller du?", en: "Where do you play?", de: "Wo spielst du?", sv: "Var spelar du?", no: "Hvor spiller du?" },
  "country.intro": {
    da: "Så viser vi klubber, priser og sprog for dit land. Du kan skifte det nederst på siden.",
    en: "We will show clubs, prices and language for that country. You can change it at the bottom of the page.",
    de: "Dann zeigen wir Clubs, Preise und Sprache für dein Land. Ganz unten auf der Seite kannst du es ändern.",
    sv: "Då visar vi klubbar, priser och språk för ditt land. Du kan ändra det längst ned på sidan.",
    no: "Da viser vi klubber, priser og språk for landet ditt. Du kan endre det nederst på siden.",
  },
  "country.skip": { da: "Ikke nu", en: "Not now", de: "Nicht jetzt", sv: "Inte nu", no: "Ikke nå" },

  // Forside
  "home.slotOne": {
    da: "ledig banetime nær dig",
    en: "free court hour near you",
    de: "freie Platzstunde in deiner Nähe",
    sv: "ledig bantimme nära dig",
    no: "ledig banetime nær deg",
  },
  "home.slotMany": {
    da: "ledige banetimer nær dig",
    en: "free court hours near you",
    de: "freie Platzstunden in deiner Nähe",
    sv: "lediga bantimmar nära dig",
    no: "ledige banetimer nær deg",
  },
  "home.lede": {
    da: "Book uden medlemskab. Find en træner, når du vil blive bedre. Find en medspiller, når du mangler en at spille imod.",
    en: "Book without a membership. Find a coach when you want to improve. Find a co-player when you need someone to play against.",
    de: "Buchen ohne Mitgliedschaft. Finde einen Trainer, wenn du besser werden willst. Finde einen Mitspieler, wenn dir jemand zum Spielen fehlt.",
    sv: "Boka utan medlemskap. Hitta en tränare när du vill bli bättre. Hitta en medspelare när du saknar någon att spela mot.",
    no: "Book uten medlemskap. Finn en trener når du vil bli bedre. Finn en medspiller når du mangler noen å spille mot.",
  },
  "home.cardBook": {
    da: "Se ledige tider i klubber nær dig, og betal online. Du behøver ikke være medlem.",
    en: "See available times at clubs near you and pay online. No membership needed.",
    de: "Sieh freie Zeiten in Clubs in deiner Nähe und zahle online. Eine Mitgliedschaft brauchst du nicht.",
    sv: "Se lediga tider i klubbar nära dig och betala online. Du behöver inte vara medlem.",
    no: "Se ledige tider i klubber nær deg, og betal på nett. Du trenger ikke være medlem.",
  },
  "home.cardCoaches": {
    da: "Enkelttimer eller hele forløb. Priser og ledige tider står på profilen.",
    en: "Single sessions or full packages. Prices and available times are on the profile.",
    de: "Einzelstunden oder ganze Pakete. Preise und freie Zeiten stehen im Profil.",
    sv: "Enstaka timmar eller hela paket. Priser och lediga tider står på profilen.",
    no: "Enkelttimer eller hele forløp. Priser og ledige tider står på profilen.",
  },
  "home.cardPlayers": {
    da: "Se spillere på dit niveau. Siger I begge ja, åbner der en samtale.",
    en: "See players at your level. If you both say yes, a conversation opens.",
    de: "Sieh Spieler auf deinem Niveau. Sagt ihr beide ja, öffnet sich ein Gespräch.",
    sv: "Se spelare på din nivå. Säger ni båda ja öppnas en konversation.",
    no: "Se spillere på ditt nivå. Sier dere begge ja, åpnes en samtale.",
  },
  "unit.club": { da: "klub", en: "club", de: "Club", sv: "klubb", no: "klubb" },
  "unit.clubs": { da: "klubber", en: "clubs", de: "Clubs", sv: "klubbar", no: "klubber" },
  "unit.coach": { da: "træner", en: "coach", de: "Trainer", sv: "tränare", no: "trener" },
  "unit.coaches": { da: "trænere", en: "coaches", de: "Trainer", sv: "tränare", no: "trenere" },
  "unit.player": { da: "spiller", en: "player", de: "Spieler", sv: "spelare", no: "spiller" },
  "unit.players": { da: "spillere", en: "players", de: "Spieler", sv: "spelare", no: "spillere" },
  "club.missing": {
    da: "Mangler din klub?",
    en: "Is your club missing?",
    de: "Fehlt dein Club?",
    sv: "Saknas din klubb?",
    no: "Mangler klubben din?",
  },
  "club.pitch": {
    da: "I beholder jeres eget bookingsystem. Vi viser kun de tider, I selv frigiver, til spillere udefra — og sender betalingen videre til jer.",
    en: "You keep your own booking system. We only show the times you release yourselves, to players from outside — and pass the payment on to you.",
    de: "Ihr behaltet euer eigenes Buchungssystem. Wir zeigen nur die Zeiten, die ihr selbst freigebt, an Spieler von außerhalb — und leiten die Zahlung an euch weiter.",
    sv: "Ni behåller ert eget bokningssystem. Vi visar bara de tider ni själva släpper, till spelare utifrån — och skickar betalningen vidare till er.",
    no: "Dere beholder deres eget bookingsystem. Vi viser bare tidene dere selv frigir, til spillere utenfra — og sender betalingen videre til dere.",
  },
  "club.pitchPricing": {
    da: "Vælg mellem {pct}% pr. booking eller et fast månedsbeløb.",
    en: "Choose between {pct}% per booking or a fixed monthly fee.",
    de: "Wählt zwischen {pct}% pro Buchung oder einem festen Monatsbetrag.",
    sv: "Välj mellan {pct}% per bokning eller ett fast månadsbelopp.",
    no: "Velg mellom {pct}% per booking eller et fast månedsbeløp.",
  },

  // Trænere, liste og profil
  "common.search": { da: "Søg", en: "Search", de: "Suchen", sv: "Sök", no: "Søk" },
  "coach.noneInArea": {
    da: "Ingen trænere i det område endnu.",
    en: "No coaches in that area yet.",
    de: "Noch keine Trainer in diesem Gebiet.",
    sv: "Inga tränare i det området än.",
    no: "Ingen trenere i det området ennå.",
  },
  "coach.alsoOffersOne": {
    da: "Tilbyder også {name}",
    en: "Also offers {name}",
    de: "Bietet außerdem {name}",
    sv: "Erbjuder även {name}",
    no: "Tilbyr også {name}",
  },
  "coach.alsoOffersMany": {
    da: "Tilbyder også {n} pakkeforløb",
    en: "Also offers {n} packages",
    de: "Bietet außerdem {n} Pakete",
    sv: "Erbjuder även {n} paket",
    no: "Tilbyr også {n} pakkeforløp",
  },
  "coach.seeTimes": {
    da: "Se ledige tider",
    en: "See available times",
    de: "Freie Zeiten ansehen",
    sv: "Se lediga tider",
    no: "Se ledige tider",
  },
  "coach.packagesNote": {
    da: "Aftales direkte med træneren — skriv eller book en enkelt time først.",
    en: "Arranged directly with the coach — write to them or book a single session first.",
    de: "Wird direkt mit dem Trainer vereinbart — schreib ihm oder buche zuerst eine Einzelstunde.",
    sv: "Bestäms direkt med tränaren — skriv eller boka en enstaka timme först.",
    no: "Avtales direkte med treneren — skriv eller book en enkelttime først.",
  },
  "coach.lessonLine": {
    da: "Én lektion er {length} og koster {price} kr.",
    en: "One session is {length} and costs {price} kr.",
    de: "Eine Stunde dauert {length} und kostet {price} kr.",
    sv: "En lektion är {length} och kostar {price} kr.",
    no: "Én leksjon er {length} og koster {price} kr.",
  },
  "coach.timesTitle": {
    da: "Ledige tider (næste {days} dage)",
    en: "Available times (next {days} days)",
    de: "Freie Zeiten (nächste {days} Tage)",
    sv: "Lediga tider (nästa {days} dagar)",
    no: "Ledige tider (neste {days} dager)",
  },
  "coach.noTimes": {
    da: "Ingen ledige tider lige nu — træneren har ikke åbnet flere tider denne uge.",
    en: "No available times right now — the coach has not opened more times this week.",
    de: "Gerade keine freien Zeiten — der Trainer hat diese Woche keine weiteren geöffnet.",
    sv: "Inga lediga tider just nu — tränaren har inte öppnat fler tider den här veckan.",
    no: "Ingen ledige tider akkurat nå — treneren har ikke åpnet flere tider denne uken.",
  },
  "coach.noTimesNote": {
    da: "Skriv til træneren, hvis du vil aftale noget uden for de faste tider.",
    en: "Write to the coach if you want to arrange something outside the fixed times.",
    de: "Schreib dem Trainer, wenn du etwas außerhalb der festen Zeiten vereinbaren willst.",
    sv: "Skriv till tränaren om du vill komma överens om något utanför de fasta tiderna.",
    no: "Skriv til treneren hvis du vil avtale noe utenfor de faste tidene.",
  },
  "coach.loginToBook": {
    da: "Log ind for at booke en tid",
    en: "Log in to book a session",
    de: "Melde dich an, um eine Stunde zu buchen",
    sv: "Logga in för att boka en tid",
    no: "Logg inn for å booke en time",
  },
  "coach.errNoPayout": {
    da: "Træneren kan ikke tage imod betaling endnu, så bookingen blev ikke gennemført.",
    en: "The coach cannot receive payment yet, so the booking did not go through.",
    de: "Der Trainer kann noch keine Zahlungen empfangen, deshalb kam die Buchung nicht zustande.",
    sv: "Tränaren kan inte ta emot betalning än, så bokningen gick inte igenom.",
    no: "Treneren kan ikke ta imot betaling ennå, så bookingen ble ikke gjennomført.",
  },
  "coach.errSelf": {
    da: "Du kan ikke booke en tid hos dig selv.",
    en: "You cannot book a session with yourself.",
    de: "Du kannst keine Stunde bei dir selbst buchen.",
    sv: "Du kan inte boka en tid hos dig själv.",
    no: "Du kan ikke booke en time hos deg selv.",
  },
  "coach.errPast": {
    da: "Det tidspunkt er passeret. Vælg en anden tid.",
    en: "That time has passed. Choose another one.",
    de: "Dieser Zeitpunkt ist vorbei. Wähle einen anderen.",
    sv: "Den tiden har passerat. Välj en annan tid.",
    no: "Det tidspunktet er passert. Velg en annen tid.",
  },
  "coach.errNotOffered": {
    da: "Træneren tilbyder ikke den tid. Vælg en af tiderne herunder.",
    en: "The coach does not offer that time. Choose one of the times below.",
    de: "Der Trainer bietet diese Zeit nicht an. Wähle eine der Zeiten unten.",
    sv: "Tränaren erbjuder inte den tiden. Välj en av tiderna nedan.",
    no: "Treneren tilbyr ikke den tiden. Velg en av tidene nedenfor.",
  },
  "coach.errTaken": {
    da: "Den tid var lige taget. Vælg en anden.",
    en: "That time was just taken. Choose another.",
    de: "Diese Zeit war gerade vergeben. Wähle eine andere.",
    sv: "Den tiden blev precis tagen. Välj en annan.",
    no: "Den tiden ble nettopp tatt. Velg en annen.",
  },

  // Spillere og makkere
  "players.findTitle": {
    da: "Find spillere",
    en: "Find players",
    de: "Spieler finden",
    sv: "Hitta spelare",
    no: "Finn spillere",
  },
  "players.waiting": {
    da: "{n} venter på dig",
    en: "{n} waiting for you",
    de: "{n} warten auf dich",
    sv: "{n} väntar på dig",
    no: "{n} venter på deg",
  },
  "players.seenAll": {
    da: "Du har set alle spillere på dit niveau i dit område. Kig forbi igen om et par dage.",
    en: "You have seen every player at your level nearby. Check back in a couple of days.",
    de: "Du hast alle Spieler auf deinem Niveau in deiner Nähe gesehen. Schau in ein paar Tagen wieder vorbei.",
    sv: "Du har sett alla spelare på din nivå i ditt område. Kom tillbaka om ett par dagar.",
    no: "Du har sett alle spillere på ditt nivå i området ditt. Stikk innom igjen om et par dager.",
  },
  "players.alsoCoach": {
    da: "Er også træner på platformen",
    en: "Also a coach on the platform",
    de: "Ist auch Trainer auf der Plattform",
    sv: "Är även tränare på plattformen",
    no: "Er også trener på plattformen",
  },
  "partners.title": {
    da: "Find en makker",
    en: "Find a partner",
    de: "Partner finden",
    sv: "Hitta en partner",
    no: "Finn en makker",
  },
  "partners.intro": {
    da: "Åbne opslag fra spillere der søger modstander, doublemakker eller træningspartner.",
    en: "Open posts from players looking for an opponent, a doubles partner or someone to train with.",
    de: "Offene Gesuche von Spielern, die einen Gegner, Doppelpartner oder Trainingspartner suchen.",
    sv: "Öppna inlägg från spelare som söker motståndare, dubbelpartner eller träningspartner.",
    no: "Åpne oppslag fra spillere som søker motstander, doublemakker eller treningspartner.",
  },
  "partners.none": {
    da: "Ingen åbne opslag matcher din søgning endnu.",
    en: "No open posts match your search yet.",
    de: "Noch passt kein offenes Gesuch zu deiner Suche.",
    sv: "Inga öppna inlägg matchar din sökning än.",
    no: "Ingen åpne oppslag matcher søket ditt ennå.",
  },
  "partners.createFirst": {
    da: "Opret det første",
    en: "Create the first one",
    de: "Erstelle das erste",
    sv: "Skapa det första",
    no: "Opprett det første",
  },
  "partners.respond": { da: "Slå til", en: "Take it", de: "Zusagen", sv: "Nappa", no: "Slå til" },
  "partners.loginToRespond": {
    da: "Log ind for at svare",
    en: "Log in to reply",
    de: "Zum Antworten anmelden",
    sv: "Logga in för att svara",
    no: "Logg inn for å svare",
  },

  // Profil
  "profile.paidTitle": {
    da: "Tiden er din",
    en: "The time is yours",
    de: "Die Zeit gehört dir",
    sv: "Tiden är din",
    no: "Tiden er din",
  },
  "profile.paidBody": {
    da: "Kvittering er sendt til {email}. Spiller du fast? Book den samme tid næste uge nedenfor, så er den ikke væk.",
    en: "A receipt has been sent to {email}. Play regularly? Book the same time next week below, so it is not gone.",
    de: "Eine Quittung ging an {email}. Spielst du regelmäßig? Buche unten dieselbe Zeit nächste Woche, dann ist sie dir sicher.",
    sv: "Ett kvitto har skickats till {email}. Spelar du regelbundet? Boka samma tid nästa vecka nedan, så är den inte borta.",
    no: "Kvittering er sendt til {email}. Spiller du fast? Book den samme tiden neste uke nedenfor, så er den ikke borte.",
  },
  "profile.pendingTitle": {
    da: "Betalingen er ikke registreret endnu",
    en: "The payment is not registered yet",
    de: "Die Zahlung ist noch nicht erfasst",
    sv: "Betalningen är inte registrerad än",
    no: "Betalingen er ikke registrert ennå",
  },
  "profile.pendingBody": {
    da: "Det tager nogle gange et øjeblik. Genindlæs siden om lidt. Står der stadig Afventer betaling nedenfor, er beløbet ikke trukket, og du kan trygt prøve igen.",
    en: "It sometimes takes a moment. Reload the page shortly. If it still says Awaiting payment below, nothing has been charged and you can safely try again.",
    de: "Das dauert manchmal einen Moment. Lade die Seite gleich neu. Steht unten weiterhin Zahlung ausstehend, wurde nichts abgebucht und du kannst es bedenkenlos erneut versuchen.",
    sv: "Det tar ibland ett ögonblick. Ladda om sidan strax. Står det fortfarande Väntar på betalning nedan har inget dragits, och du kan tryggt försöka igen.",
    no: "Det tar noen ganger et øyeblikk. Last inn siden på nytt om litt. Står det fortsatt Venter på betaling nedenfor, er beløpet ikke trukket, og du kan trygt prøve igjen.",
  },
  "profile.noBookings": {
    da: "Ingen bookinger endnu —",
    en: "No bookings yet —",
    de: "Noch keine Buchungen —",
    sv: "Inga bokningar än —",
    no: "Ingen bookinger ennå —",
  },
  "profile.noPosts": {
    da: "Ingen opslag —",
    en: "No posts —",
    de: "Keine Gesuche —",
    sv: "Inga inlägg —",
    no: "Ingen oppslag —",
  },
  "profile.createOne": {
    da: "opret et",
    en: "create one",
    de: "erstelle eines",
    sv: "skapa ett",
    no: "opprett et",
  },
  "profile.awaitingPayment": {
    da: "Afventer betaling",
    en: "Awaiting payment",
    de: "Zahlung ausstehend",
    sv: "Väntar på betalning",
    no: "Venter på betaling",
  },
  "profile.confirmed": {
    da: "Bekræftet",
    en: "Confirmed",
    de: "Bestätigt",
    sv: "Bekräftad",
    no: "Bekreftet",
  },
  "profile.coachSession": {
    da: "Trænertime: {name}",
    en: "Coach session: {name}",
    de: "Trainerstunde: {name}",
    sv: "Tränartimme: {name}",
    no: "Trenertime: {name}",
  },
  "profile.matchedWith": {
    da: "Matchet med {name}",
    en: "Matched with {name}",
    de: "Verbunden mit {name}",
    sv: "Matchad med {name}",
    no: "Matchet med {name}",
  },
  "common.or": { da: "eller", en: "or", de: "oder", sv: "eller", no: "eller" },

  "club.boardQuestion": {
    da: "Sidder du i en klubbestyrelse?",
    en: "On a club board?",
    de: "Sitzt du im Vorstand eines Clubs?",
    sv: "Sitter du i en klubbstyrelse?",
    no: "Sitter du i et klubbstyre?",
  },
  "partners.createPost": {
    da: "Opret opslag",
    en: "New post",
    de: "Gesuch erstellen",
    sv: "Skapa inlägg",
    no: "Opprett oppslag",
  },
  "partners.yourLevel": {
    da: "Dit niveau (viser ±1)",
    en: "Your level (shows ±1)",
    de: "Dein Niveau (zeigt ±1)",
    sv: "Din nivå (visar ±1)",
    no: "Ditt nivå (viser ±1)",
  },
  "common.filter": { da: "Filtrér", en: "Filter", de: "Filtern", sv: "Filtrera", no: "Filtrer" },
  "partners.yours": {
    da: "Dit opslag",
    en: "Your post",
    de: "Dein Gesuch",
    sv: "Ditt inlägg",
    no: "Ditt oppslag",
  },

  // Klubber
  "club.pending": {
    da: "Afventer godkendelse",
    en: "Awaiting approval",
    de: "Wartet auf Freigabe",
    sv: "Väntar på godkännande",
    no: "Venter på godkjenning",
  },
  "club.pendingNote": {
    da: "Vi gennemgår jeres oplysninger manuelt. I hører fra os inden for et par hverdage.",
    en: "We review your details manually. You will hear from us within a few working days.",
    de: "Wir prüfen eure Angaben von Hand. Ihr hört innerhalb weniger Werktage von uns.",
    sv: "Vi går igenom era uppgifter manuellt. Ni hör från oss inom ett par arbetsdagar.",
    no: "Vi går gjennom opplysningene deres manuelt. Dere hører fra oss innen et par virkedager.",
  },
  "club.rejected": {
    da: "Ikke godkendt",
    en: "Not approved",
    de: "Nicht freigegeben",
    sv: "Inte godkänd",
    no: "Ikke godkjent",
  },
  "club.signup": {
    da: "Få jeres klub med",
    en: "List your club",
    de: "Euren Club aufnehmen",
    sv: "Få med er klubb",
    no: "Få klubben deres med",
  },
};

/**
 * Slår en tekst op. Mangler nøglen, returneres nøglen selv, så fejlen ses.
 *
 * `vars` erstatter pladsholdere som {navn} i teksten. Det er nødvendigt,
 * fordi ordstillingen skifter fra sprog til sprog: "5 venter på dig" og
 * "5 warten auf dich" kan ikke sættes sammen af de samme stumper i samme
 * rækkefølge. Hele sætningen skal være ét opslag med huller i.
 */
export function t(
  key: string,
  locale: Locale = "da",
  vars?: Record<string, string | number>
): string {
  const entry = T[key];
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Manglende oversættelse: ${key}`);
    }
    return key;
  }
  // Falder tilbage på engelsk frem for at vise en tom streng. Typerne
  // sikrer, at det ikke kan ske — men en tom knap i en butik er værre end
  // en knap på det forkerte sprog.
  const text = entry[locale] || entry.en;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) =>
    name in vars ? String(vars[name]) : whole
  );
}

/** Bundet oversætter, så komponenter slipper for at sende locale med hver gang. */
export function translator(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) => t(key, locale, vars);
}
