// Public information and sales pages share the landing page's compact header.
const PUBLIC_PAGES = ['/', '/list-your-club', '/website', '/app', '/terms', '/privacy', '/dpa'];

export function isPublicPage(pathname: string) {
  return PUBLIC_PAGES.some(path => pathname === path || path !== '/' && pathname.startsWith(path + '/'));
}
