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

function IconMessages({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M4 5.5h16v11H9.5L4.5 20V5.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TabBar({
  locale,
  unread = 0,
}: {
  locale: Locale;
  unread?: number;
}) {
  const pathname = usePathname();
  const t = translator(locale);

  // Tre punkter, ikke fire. Profilen ligger i hjørnet: den er noget man
  // besøger, ikke noget man kommer for. Færre valg i bundlinjen gør det
  // tydeligere, hvad appen er til.
  const tabs = [
    { href: "/book", label: t("tab.book"), Icon: IconCourt, badge: 0 },
    { href: "/traenere", label: t("tab.coaches"), Icon: IconCoach, badge: 0 },
    { href: "/spillere", label: t("tab.players"), Icon: IconPlayers, badge: 0 },
    { href: "/beskeder", label: t("tab.messages"), Icon: IconMessages, badge: unread },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label={t("nav.book")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate/10 bg-chalk/95 pb-[env(safe-area-inset-bottom)] shadow-tab backdrop-blur md:hidden"
    >
      <ul className="flex">
        {tabs.map(({ href, label, Icon, badge }) => {
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
                <span className="relative">
                  <Icon active={active} />
                  {badge > 0 && (
                    <span
                      className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-court px-1 text-[10px] font-bold text-chalk"
                      aria-label={`${badge} ulæste`}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span
                  className={`whitespace-nowrap text-[10px] leading-tight ${
                    active ? "font-bold" : "font-medium"
                  }`}
                >
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
