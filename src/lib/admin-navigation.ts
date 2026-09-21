export const ADMIN_PAGES = [
  { id: 'oversigt', label: 'Overblik', description: 'Nøgletal og genveje til klubbens daglige arbejde.', group: 'Daglig drift' },
  { id: 'bookinger', label: 'Bookinger', description: 'Kommende bookinger og faste reservationer.', group: 'Daglig drift' },
  { id: 'tider', label: 'Ledige tider', description: 'Frigiv tider og styr, hvornår gæster kan booke.', group: 'Daglig drift' },
  { id: 'medlemmer', label: 'Medlemmer', description: 'Kontingenter og medlemskaber.', group: 'Daglig drift' },
  { id: 'hold', label: 'Hold', description: 'Sæsonhold og tilmeldinger.', group: 'Daglig drift' },
  { id: 'nyheder', label: 'Nyheder', description: 'Skriv og administrer klubbens opslag.', group: 'Daglig drift' },
  { id: 'baner', label: 'Baner og sportsgrene', description: 'Sportsgrene, baner og borde samt deres underlag.', group: 'Opsætning' },
  { id: 'lys-adgang', label: 'Lys og adgang', description: 'Controllere, lys, døre og adgangsvinduer.', group: 'Opsætning' },
  { id: 'priser', label: 'Priser og klippekort', description: 'Prisregler og klippekort.', group: 'Opsætning' },
  { id: 'betaling', label: 'Betaling og abonnement', description: 'Udbetalinger, abonnement og fakturaer.', group: 'Opsætning' },
  { id: 'integrationer', label: 'Bookingsystem', description: 'Forbind klubbens eksisterende bookingsystem.', group: 'Opsætning' },
  { id: 'hjemmeside', label: 'Hjemmeside', description: 'Klubside, billeder, domæne og design.', group: 'Opsætning' },
  { id: 'indstillinger', label: 'Administratorer og kontakt', description: 'Adgang til administrationen og klubbens kontaktpersoner.', group: 'Opsætning' },
] as const;
export type AdminSection = typeof ADMIN_PAGES[number]['id'];
export const adminHref = (section: AdminSection) => section === 'oversigt' ? '/admin' : `/admin/${section}`;
export const isAdminSection = (value: string): value is AdminSection => ADMIN_PAGES.some(p => p.id === value);
