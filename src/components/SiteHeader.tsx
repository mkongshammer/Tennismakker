"use client";

// Sidehovedet på bred skærm. På telefon bæres navigationen af bundlinjen
// (TabBar), så hovedet reduceres til logo og konto.

import Link from "next/link";
import { Logo } from "./Logo";
import { usePathname } from "next/navigation";
import { translator } from "../lib/i18n";
import type { Locale } from "../lib/sports";

type Props = {
  user: { name: string; role: string } | null;
  locale: Locale;
};

// Log ud-knappen ligger på /profil, ikke her — profilen er kun et
// hjørne-ikon i headeren, og det er der, kontoen i øvrigt styres fra.
export function SiteHeader({ user, locale }: Props) {
  const pathname = usePathname();
  const t = translator(locale);

  const links = [
    { href: "/book", label: t("nav.book") },
    { href: "/traenere", label: t("nav.coaches") },
    { href: "/spillere", label: t("nav.players") },
    { href: "/beskeder", label: t("nav.messages") },
  ];

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-30 border-b border-slate/10 bg-chalk/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="display shrink-0 text-lg tracking-tight">
          <Logo size={30} />
          <span>
            Racket<span className="text-court">Buddy</span>
          </span>
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

        <div className="ml-auto flex items-center gap-2 text-sm">
          {user ? (
            <>
              {/* Profilen: initialer i hjørnet, som man kender det fra en app */}
              <Link
                href="/profil"
                aria-label={t("nav.profile")}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  active("/profil")
                    ? "bg-court text-chalk"
                    : "bg-ink text-chalk hover:bg-ink-soft"
                }`}
              >
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="font-semibold text-slate hover:text-ink">
                {t("nav.login")}
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-court px-4 py-2.5 font-semibold text-chalk hover:bg-court-dark"
              >
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
