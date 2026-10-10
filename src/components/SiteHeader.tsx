"use client";

// Sidehovedet på bred skærm. På telefon bæres navigationen af bundlinjen
// (TabBar), så hovedet reduceres til logo og konto.

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { LanguagePicker } from "./LanguagePicker";
import { translator } from "../lib/i18n";
import {phrase} from '../lib/phrases';
import {isPublicPage} from '../lib/public-pages';
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
  const marketingPage = isPublicPage(pathname);
  const languageDetailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (user?.role !== "COACH" || pathname === "/onboarding-sports") return;

    let cancelled = false;
    fetch("/api/v1/me/coach-sports-status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.needsSelection) {
          window.location.replace("/onboarding-sports");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname, user?.role]);

  useEffect(() => {
    const closeLanguagePicker = (event: PointerEvent) => {
      const details = languageDetailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && languageDetailsRef.current?.open) {
        languageDetailsRef.current.open = false;
        languageDetailsRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeLanguagePicker);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeLanguagePicker);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const links = marketingPage ? [] : [
    { href: "/book", label: t("nav.book") },
    { href: "/traenere", label: t("nav.coaches") },
    { href: "/spillere", label: t("nav.players") },
    { href: "/beskeder", label: t("nav.messages") },
    ...(user?.role === "CLUB_ADMIN"
      ? [
          { href: "/admin", label: t("nav.admin") },
          { href: "/admin/custom", label: "Custom" },
        ]
      : [{ href: "/opret-klub", label: phrase('Til klubber',locale) }]),
  ];

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-30 border-b border-slate/10 bg-chalk/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6">
        <Link href="/" className="display shrink-0 text-lg tracking-tight">
          Racket<span className="text-court">Buddy</span>
        </Link>

        <div className={`${marketingPage ? 'flex min-w-0 gap-3 text-[13px] sm:gap-6 sm:text-sm' : 'hidden gap-6 text-sm md:flex'} flex-1 items-center font-semibold`}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative py-1 ${marketingPage && l.href === '/admin' ? 'hidden sm:inline-flex' : ''} ${active(l.href) ? "text-court" : "text-slate hover:text-ink"}`}
            >
              {l.label}
              {active(l.href) && (
                <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-court" />
              )}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <details ref={languageDetailsRef} className="relative">
            <summary className="cursor-pointer list-none min-h-11 flex items-center px-2 font-semibold" aria-label={t('common.language')}>{locale.toUpperCase()} ▾</summary>
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-xl border bg-white p-4 shadow-lg"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button") && languageDetailsRef.current) {
                  languageDetailsRef.current.open = false;
                }
              }}
            >
              <LanguagePicker active={locale}/>
            </div>
          </details>
          {user ? (
            <>
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
              <Link href="/login" aria-label={t('nav.login')} className={`${marketingPage ? 'flex h-10 w-10 items-center justify-center sm:h-auto sm:w-auto' : ''} font-semibold text-slate hover:text-ink`}>
                {marketingPage && <svg className="sm:hidden" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>}
                <span className={marketingPage ? 'hidden sm:inline' : undefined}>{t("nav.login")}</span>
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-xl bg-court px-4 py-2.5 font-semibold text-chalk hover:bg-court-dark sm:inline-flex"
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
