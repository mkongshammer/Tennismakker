// Public information and sales pages share the landing page's compact header.
const PUBLIC_PAGES = ['/', '/opret-klub', '/hjemmeside', '/app', '/vilkaar', '/privatliv', '/databehandleraftale'];

export function isPublicPage(pathname: string) {
  return PUBLIC_PAGES.some(path => pathname === path || path !== '/' && pathname.startsWith(path + '/'));
}
