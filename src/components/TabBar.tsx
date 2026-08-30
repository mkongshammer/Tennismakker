"use client";

// Bundlinjen på telefon.
//
// De fire punkter ER produktet, og de skal kunne nås med tommelfingeren
// uden at åbne en menu først. En skuffe koster to tryk for noget, folk gør
// hver gang. Derfor ligger navigationen nederst på telefon og øverst på
// bred skærm.
//
// Det aktive punkt markeres med en kridtlinje — samme markering som på en
// bane, brugt til at vise hvor man står.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { translator } from "../lib/i18n";
import type { Locale } from "../lib/sports";

function IconCourt({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="15"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
      />
      <path
        d="M12 4.5v15M3.5 12h17M8 8.5h8M8 15.5h8"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCoach({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="12" cy="7.5" r="3.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} />
      <path
        d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlayers({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} />
      <circle cx="16" cy="10.5" r="2.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} />
      <path
        d="M2.5 19c0-3 2.7-5 6-5s6 2 6 5M14.5 19c.3-2.3 2.3-3.6 4.6-3.6 1.3 0 2.4.4 3.2 1.1"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} />
      <path
        d="M6.2 18.4c.9-2.3 3.1-3.6 5.8-3.6s4.9 1.3 5.8 3.6"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
      />
      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} />
    </svg>
  );
}

export function TabBar({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = translator(locale);

  const tabs = [
    { href: "/book", label: t("nav.book"), Icon: IconCourt },
    { href: "/traenere", label: t("nav.coaches"), Icon: IconCoach },
    { href: "/spillere", label: t("nav.players"), Icon: IconPlayers },
    { href: "/profil", label: t("nav.profile"), Icon: IconProfile },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label={t("nav.book")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate/10 bg-chalk/95 pb-[env(safe-area-inset-bottom)] shadow-tab backdrop-blur md:hidden"
    >
      <ul className="flex">
        {tabs.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-[68px] flex-col items-center justify-center gap-1 ${
                  active ? "text-court" : "text-slate"
                }`}
              >
                {/* Kridtlinjen markerer hvor man står */}
                <span
                  aria-hidden="true"
                  className={`absolute top-0 h-[3px] w-9 rounded-full transition-opacity ${
                    active ? "bg-court opacity-100" : "opacity-0"
                  }`}
                />
                <Icon active={active} />
                <span className={`text-[11px] ${active ? "font-bold" : "font-medium"}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
