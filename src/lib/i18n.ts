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

/** Slår en tekst op. Mangler nøglen, returneres nøglen selv, så fejlen ses. */
export function t(key: string, locale: Locale = "da"): string {
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
  return entry[locale] || entry.en;
}

/** Bundet oversætter, så komponenter slipper for at sende locale med hver gang. */
export function translator(locale: Locale) {
  return (key: string) => t(key, locale);
}
