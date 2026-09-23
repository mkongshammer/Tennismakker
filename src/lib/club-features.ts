import type { AdminSection } from './admin-navigation';
export const STANDARD_SECTIONS: AdminSection[] = ['oversigt','bookinger','tider','baner','betaling','integrationer','indstillinger'];
export function clubHasSection(mode: string | undefined, section: AdminSection) {
  return mode === 'CUSTOM' || STANDARD_SECTIONS.includes(section);
}
