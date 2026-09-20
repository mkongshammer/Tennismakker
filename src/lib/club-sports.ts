import { SPORTS, SURFACES_BY_SPORT, type Sport } from './sports';

export const COURT_OPTIONS: Record<Sport, { surfaces: string[]; indoor: boolean; noun: string; plural: string }> = {
  TENNIS: { surfaces: SURFACES_BY_SPORT.TENNIS, indoor: false, noun: 'bane', plural: 'Baner' },
  PADEL: { surfaces: SURFACES_BY_SPORT.PADEL, indoor: false, noun: 'bane', plural: 'Baner' },
  BADMINTON: { surfaces: SURFACES_BY_SPORT.BADMINTON, indoor: true, noun: 'bane', plural: 'Baner' },
  SQUASH: { surfaces: SURFACES_BY_SPORT.SQUASH, indoor: true, noun: 'bane', plural: 'Baner' },
  BORDTENNIS: { surfaces: SURFACES_BY_SPORT.BORDTENNIS, indoor: true, noun: 'bord', plural: 'Borde' },
  PICKLEBALL: { surfaces: SURFACES_BY_SPORT.PICKLEBALL, indoor: false, noun: 'bane', plural: 'Baner' },
};
export function clubSports(configured: string | null | undefined, courts: {sport: string}[] = []): Sport[] {
  const values = [...(configured ?? '').split(','), ...courts.map(c => c.sport)];
  return SPORTS.filter(s => values.includes(s));
}
export function facilityLabel(sports: readonly string[]) {
  return sports.length === 1 && sports[0] === 'BORDTENNIS' ? 'Borde' : sports.includes('BORDTENNIS') ? 'Baner og borde' : 'Baner';
}
export function validateCourtSport(sport: string, surface: string, allowed: readonly string[]) {
  if (!(SPORTS as readonly string[]).includes(sport) || !allowed.includes(sport)) return 'Vælg en af klubbens sportsgrene.';
  if (!COURT_OPTIONS[sport as Sport].surfaces.includes(surface)) return 'Vælg et underlag, der passer til sportsgrenen.';
  return null;
}
