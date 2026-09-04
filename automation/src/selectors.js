// Halbookings felter.
//
// ═══════════════════════════════════════════════════════════════════════
//  DETTE ER DEN ENESTE FIL, DER SKAL UDFYLDES.
//
//  Værdierne nedenfor er gæt. De er ikke afprøvet mod en rigtig
//  Halbooking-side, fordi den ikke kunne nås fra det miljø, koden blev
//  skrevet i. Alt andet i mappen er færdigt.
//
//  Sådan finder du de rigtige:
//    1. Åbn /superadmin/automatisering på RacketBuddy
//    2. Skriv klubbens adresse, brugernavn og adgangskode
//    3. Tryk "Se hvad automatiseringen ser"
//
//  Værktøjet logger ind og viser dig alle felter og knapper på siden med
//  deres navne. Skriv dem ind her, udrul, og prøv igen.
// ═══════════════════════════════════════════════════════════════════════

export const HALBOOKING = {
  // Login
  loginPath: "/",
  usernameField: 'input[name="username"], input[type="email"], #username',
  passwordField: 'input[name="password"], input[type="password"], #password',
  submitButton: 'button[type="submit"], input[type="submit"]',

  // Hvad der beviser, at vi er logget ind. Findes dette element ikke efter
  // login, betragtes forsøget som fejlet — bedre end at gå videre og klikke
  // i blinde på en login-side.
  loggedInMarker: 'a[href*="logout"], a[href*="logud"], .user-menu',

  // Bookingsiden
  bookingPath: "/booking",
  /** Feltet hvor datoen vælges. Formatet sættes i dateFormat nedenfor. */
  dateField: 'input[name="date"], input[type="date"]',
  dateFormat: "yyyy-MM-dd",

  /**
   * En ledig celle i skemaet. {court} og {time} erstattes.
   * Halbooking bruger typisk en tabel med en celle pr. bane og time.
   */
  freeSlotCell: '[data-court="{court}"][data-time="{time}"]',

  /** Knappen der bekræfter reservationen i dialogen, der åbner. */
  confirmButton: 'button:has-text("Book"), button:has-text("Bekræft")',

  /**
   * Hvad der beviser, at reservationen står. Læses EFTER bookingen, som
   * verifikation — det er dette tjek, der afgør, om gæsten trækkes penge.
   */
  bookedMarker: '[data-court="{court}"][data-time="{time}"].booked',
};
