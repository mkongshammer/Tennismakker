"use client";

// Sidehovedet på bred skærm. På telefon bæres navigationen af bundlinjen
// (TabBar), så hovedet reduceres til logo og konto.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { translator } from "../lib/i18n";
import type { Locale } from "../lib/sports";

type Props = {
  user: { name: string; role: string } | null;
  locale: Locale;
  logout: () => Promise<void>;
};

export function SiteHeader({ user, locale, logout }: Props) {
  const pathname = usePathname();
  const t = translator(locale);

  const links = [
    { href: "/book", label: t("nav.book") },
    { href: "/traenere", label: t("nav.coaches") },
    { href: "/spillere", label: t("nav.players") },
    { href: "/profil", label: t("nav.profile") },
  ];

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-30 border-b border-slate/10 bg-chalk/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="display shrink-0 text-lg tracking-tight">
          Racket<span className="text-court">Buddy</span>
        </Link>

        <div className="hidden flex-1 items-center gap-6 text-sm font-semibold md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative py-1 ${active(l.href) ? "text-court" : "text-slate hover:text-ink"}`}
            >
              {l.label}
              {active(l.href) && (
                <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-court" />
              )}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/beskeder" className="hidden font-semibold text-slate hover:text-ink md:block">
                {t("nav.messages")}
              </Link>
              {user.role === "CLUB_ADMIN" && (
                <Link href="/admin" className="hidden font-semibold text-slate hover:text-ink md:block">
                  {t("nav.admin")}
                </Link>
              )}
              {user.role === "SUPERADMIN" && (
                <Link href="/superadmin" className="hidden font-semibold text-slate hover:text-ink md:block">
                  Godkendelser
                </Link>
              )}
              <form action={logout} className="hidden md:block">
                <button className="font-semibold text-slate hover:text-ink">
                  {t("nav.logout")}
                </button>
              </form>
              {/* Telefon: kontoen nås via profilfanen, så her er kun beskeder */}
              <Link
                href="/beskeder"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-mist md:hidden"
                aria-label={t("nav.messages")}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path
                    d="M4 5.5h16v11H9l-5 3.5V5.5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="font-semibold text-slate hover:text-ink">
                {t("nav.login")}
              </Link>
              <Link href="/signup" className="rounded-xl bg-court px-4 py-2.5 font-semibold text-chalk hover:bg-court-dark">
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
