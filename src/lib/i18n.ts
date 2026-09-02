// Oversættelser.
//
// Bevidst en almindelig ordbog frem for et i18n-bibliotek: der er to sprog
// og et par hundrede strenge, og en manglende nøgle skal fejle synligt i
// stedet for at blive slugt. Kommer der flere sprog eller oversættere
// udefra, er det tid til et rigtigt bibliotek.

import type { Locale } from "./sports";

type Dict = Record<string, { da: string; en: string }>;

const T: Dict = {
  // Navigation
  "nav.book": { da: "Book bane", en: "Book court" },
  "nav.coaches": { da: "Find træner", en: "Find coach" },
  "nav.players": { da: "Find medspiller", en: "Find co-player" },
  "nav.profile": { da: "Min profil", en: "My profile" },
  "nav.messages": { da: "Beskeder", en: "Messages" },

  // Korte udgaver til bundlinjen på telefon, hvor fire faner skal dele
  // bredden. De lange navne bruges stadig som sidetitler.
  "tab.book": { da: "Book bane", en: "Book" },
  "tab.coaches": { da: "Trænere", en: "Coaches" },
  "tab.players": { da: "Medspillere", en: "Players" },
  "tab.messages": { da: "Beskeder", en: "Messages" },
  "nav.admin": { da: "Klub-admin", en: "Club admin" },
  "nav.login": { da: "Log ind", en: "Log in" },
  "nav.signup": { da: "Opret profil", en: "Sign up" },
  "nav.logout": { da: "Log ud", en: "Log out" },
  "nav.menuOpen": { da: "Åbn menu", en: "Open menu" },
  "nav.menuClose": { da: "Luk menu", en: "Close menu" },

  // Generelt
  "common.perHour": { da: "pr. time", en: "per hour" },
  "common.from": { da: "fra", en: "from" },
  "common.courts": { da: "baner", en: "courts" },
  "common.book": { da: "Book", en: "Book" },
  "common.save": { da: "Gem", en: "Save" },
  "common.cancel": { da: "Annullér", en: "Cancel" },
  "common.loading": { da: "Henter…", en: "Loading…" },
  "common.back": { da: "Tilbage", en: "Back" },
  "common.all": { da: "Alle", en: "All" },
  "common.sport": { da: "Sportsgren", en: "Sport" },
  "common.country": { da: "Land", en: "Country" },
  "common.language": { da: "Sprog", en: "Language" },
  "common.area": { da: "Område", en: "Area" },
  "common.level": { da: "Niveau", en: "Level" },
  "common.price": { da: "Pris", en: "Price" },

  // Book bane
  "book.title": { da: "Book bane", en: "Book a court" },
  "book.intro": {
    da: "Find en ledig bane i en klub nær dig.",
    en: "Find an available court at a club near you.",
  },
  "book.noClubs": {
    da: "Ingen klubber i dit land med den sportsgren endnu.",
    en: "No clubs in your country for that sport yet.",
  },
  "book.available": { da: "Ledige tider", en: "Available times" },
  "book.noneToday": {
    da: "Ingen ledige tider denne dag. Prøv en anden dag ovenfor.",
    en: "No available times this day. Try another day above.",
  },
  "book.holdNote": {
    da: "Tiden holdes i 10 minutter, mens du betaler.",
    en: "The slot is held for 10 minutes while you pay.",
  },

  // Trænere
  "coach.title": { da: "Find træner", en: "Find a coach" },
  "coach.intro": {
    da: "Book en enkelt time eller et helt forløb.",
    en: "Book a single session or a full package.",
  },
  "coach.none": { da: "Ingen trænere fundet.", en: "No coaches found." },
  "coach.singleSession": { da: "Enkelt time", en: "Single session" },
  "coach.packages": { da: "Pakker", en: "Packages" },
  "coach.sessions": { da: "timer", en: "sessions" },
  "coach.perSession": { da: "pr. time", en: "per session" },
  "coach.availableTimes": { da: "Ledige tider", en: "Available times" },
  "coach.editProfile": { da: "Redigér trænerprofil", en: "Edit coach profile" },

  // Medspillere
  "players.title": { da: "Find medspiller", en: "Find a co-player" },
  "players.intro": {
    da: "Se spillere på dit niveau i dit område, én ad gangen.",
    en: "See players at your level nearby, one at a time.",
  },
  "players.skip": { da: "Spring over", en: "Skip" },
  "players.interested": { da: "Vil spille", en: "Want to play" },
  "players.matchNote": {
    da: "Siger I begge ja, åbner der en samtale. Den anden får ikke besked, hvis du springer over.",
    en: "If you both say yes, a conversation opens. They are not told if you skip.",
  },
  "players.empty": {
    da: "Ikke flere lige nu. Kig forbi igen om et par dage.",
    en: "No more right now. Check back in a couple of days.",
  },

  // Profil
  "profile.title": { da: "Min profil", en: "My profile" },
  "profile.bookings": { da: "Kommende bookinger", en: "Upcoming bookings" },
  "profile.settings": { da: "Indstillinger", en: "Settings" },
  "profile.mySports": { da: "Mine sportsgrene", en: "My sports" },

  // Klubber
  "club.pending": { da: "Afventer godkendelse", en: "Awaiting approval" },
  "club.pendingNote": {
    da: "Vi gennemgår jeres oplysninger manuelt. I hører fra os inden for et par hverdage.",
    en: "We review your details manually. You will hear from us within a few working days.",
  },
  "club.rejected": { da: "Ikke godkendt", en: "Not approved" },
  "club.signup": { da: "Få jeres klub med", en: "List your club" },
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
  return entry[locale];
}

/** Bundet oversætter, så komponenter slipper for at sende locale med hver gang. */
export function translator(locale: Locale) {
  return (key: string) => t(key, locale);
}
