import { clubHasSection } from '../../lib/club-features';
import Link from 'next/link';
import { ADMIN_PAGES, adminHref, type AdminSection } from '../../lib/admin-navigation';
export function AdminNavigation({ section, facility, mode }: { section: AdminSection; facility: string; mode?: string }) {
  const current = ADMIN_PAGES.find(p => p.id === section)!;
  const menu = <nav aria-label="Klubadministration" className="space-y-5">
    {['Daglig drift', 'Opsætning'].map(group => <div key={group}>
      <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-slate">{group}</p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">{ADMIN_PAGES.filter(p => p.group === group && clubHasSection(mode, p.id)).map(p => <li key={p.id}>
        <Link href={adminHref(p.id)} aria-current={section === p.id ? 'page' : undefined} className={`flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${section === p.id ? 'bg-ink text-white' : 'text-ink hover:bg-mist'}`}>
          {p.id === 'baner' ? `${facility} og sportsgrene` : p.label}
        </Link>
      </li>)}</ul>
    </div>)}
  </nav>;
  return <>
    <aside className="hidden lg:block lg:sticky lg:top-6 lg:self-start rounded-2xl border border-slate/15 bg-white p-3">{menu}</aside>
    <details key={section} className="lg:hidden rounded-2xl border border-slate/15 bg-white p-4">
      <summary className="cursor-pointer font-semibold min-h-11 flex items-center justify-between gap-3"><span>Menu · {current.id === 'baner' ? facility : current.label}</span><span aria-hidden="true">▾</span></summary>
      <div className="mt-4">{menu}</div>
    </details>
  </>;
}
