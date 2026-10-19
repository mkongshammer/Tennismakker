// Adressen et billede vises fra.
//
// Ligger i sin egen fil, fordi klientkomponenter har brug for den. Lå den
// i images.ts, ville billedbehandlingsbiblioteket blive trukket med ind i
// browser-bundlet — og det kan ikke køre der.
export function imageUrl(id: string, width?: 320 | 480 | 640 | 960): string {
  return width ? `/api/billeder/${id}?w=${width}` : `/api/billeder/${id}`;
}
