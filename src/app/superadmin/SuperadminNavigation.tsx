'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SUPERADMIN_PAGES, superadminHref } from '../../lib/superadmin-navigation';

export function SuperadminNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const section = pathname.split('/')[2] || 'oversigt';
  const current = SUPERADMIN_PAGES.find(p => p.id === section);
  useEffect(() => {
    if (pathname === '/superadmin' && (window.location.hash === '#opret-klub' || new URLSearchParams(window.location.search).has('leadId'))) {
      router.replace(`/superadmin/opret-klub${window.location.search}`);
    }
  }, [pathname, router]);
  if (!current) return <>{children}</>;
  const menu = <nav aria-label="Superadministration" className="space-y-5">
    {['Daglig drift', 'Opsætning'].map(group => <div key={group}>
      <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-slate">{group}</p>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {SUPERADMIN_PAGES.filter(p => p.group === group).map(p => <li key={p.id}>
          <Link prefetch={false} href={superadminHref(p.id)} aria-current={section === p.id ? 'page' : undefined}
            className={`flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${section === p.id ? 'bg-ink text-white' : 'text-ink hover:bg-mist'}`}>
            {p.label}
          </Link>
        </li>)}
      </ul>
    </div>)}
  </nav>;
  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-wider text-slate">RacketBuddy</p><p className="display text-xl">Superadministration</p></div>
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden rounded-2xl border border-slate/15 bg-white p-3 lg:sticky lg:top-6 lg:block">{menu}</aside>
      <details key={pathname} className="rounded-2xl border border-slate/15 bg-white p-4 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-semibold"><span>Menu · {current.label}</span><span aria-hidden="true">▾</span></summary>
        <div className="mt-4">{menu}</div>
      </details>
      <div className="min-w-0">{children}</div>
    </div>
  </div>;
}
