export const SUPERADMIN_PAGES = [
  { id: 'oversigt', label: 'Overblik', description: 'Nøgletal og genveje til platformens administration.', group: 'Daglig drift' },
  { id: 'henvendelser', label: 'Klubhenvendelser', description: 'Følg op på interesserede klubber og opret dem direkte.', group: 'Daglig drift' },
  { id: 'klubber', label: 'Klubgodkendelser', description: 'Godkend nye klubber og se de senest behandlede.', group: 'Daglig drift' },
  { id: 'opret-klub', label: 'Opret klub', description: 'Opret en klub og udlever administratorens login.', group: 'Daglig drift' },
  { id: 'aktivitet', label: 'Aktivitet', description: 'Se platformens seneste aktivitet.', group: 'Daglig drift' },
  { id: 'traenere', label: 'Trænerbilleder', description: 'Gennemgå trænernes profilbilleder.', group: 'Daglig drift' },
  { id: 'oekonomi', label: 'Økonomi', description: 'Følg indtægter og økonomi.', group: 'Daglig drift' },
  { id: 'hjemmesider', label: 'Hjemmesidebestillinger', description: 'Følg bestillinger fra kontakt til færdig hjemmeside.', group: 'Opsætning' },
  { id: 'domaener', label: 'Domæner', description: 'Tilknyt og administrer klubbernes egne domæner.', group: 'Opsætning' },
  { id: 'automatisering', label: 'Bookingsystemer', description: 'Forbind klubbernes eksisterende bookingsystemer.', group: 'Opsætning' },
  { id: 'adgang', label: 'Administratoradgang', description: 'Administrer adgang til superadmin.', group: 'Opsætning' },
  { id: 'opsaetning', label: 'Platformindstillinger', description: 'Nøgler, provision og platformens indstillinger.', group: 'Opsætning' },
  { id: 'selvtest', label: 'Selvtest', description: 'Kontrollér platformens integrationer.', group: 'Opsætning' },
] as const;
export type SuperadminSection = typeof SUPERADMIN_PAGES[number]['id'];
export const superadminHref = (section: SuperadminSection) => section === 'oversigt' ? '/superadmin' : `/superadmin/${section}`;
export const isSuperadminSection = (value: string): value is SuperadminSection => SUPERADMIN_PAGES.some(p => p.id === value);
