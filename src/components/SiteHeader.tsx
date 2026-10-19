"use client";

// Site header.
//
// On wide screens the header carries the navigation. On phones the tab bar
// (TabBar) carries the signed-in product navigation, so the header
// reduces to the logo, the account entry and — on marketing pages — a
// compact menu.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { translator } from "../lib/i18n";
import { isPublicPage } from "../lib/public-pages";
import type { Locale } from "../lib/sports";
import { Icon } from "./ui";

type Props = {
  user: { name: string; role: string } | null;
  locale: Locale;
};

const MARKETING_LINKS = [
  { href: "/book", label: "Courts" },
  { href: "/traenere", label: "Coaches" },
  { href: "/spillere", label: "Players" },
  { href: "/opret-klub", label: "For clubs" },
  { href: "/#pricing", label: "Pricing" },
];

export function SiteHeader({ user, locale }: Props) {
  const pathname = usePathname();
  const t = translator(locale);
  const marketingPage = isPublicPage(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.role !== "COACH" || pathname === "/onboarding-sports") return;
    let cancelled = false;
    fetch("/api/v1/me/coach-sports-status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.needsSelection) window.location.replace("/onboarding-sports");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, user?.role]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  const productLinks = [
    { href: "/book", label: t("nav.book") },
    { href: "/traenere", label: t("nav.coaches") },
    { href: "/spillere", label: t("nav.players") },
    { href: "/beskeder", label: t("nav.messages") },
    ...(user?.role === "CLUB_ADMIN"
      ? [{ href: "/admin", label: t("nav.admin") }]
      : user?.role === "COACH"
        ? [{ href: "/profil/traener", label: "Coach dashboard" }]
        : []),
  ];
  const links = marketingPage ? MARKETING_LINKS : productLinks;

  const active = (href: string) => {
    const path = href.split("#")[0];
    return path !== "/" && (pathname === path || pathname.startsWith(path + "/"));
  };

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="sticky top-0 z-30 border-b border-slate/10 bg-chalk/90 backdrop-blur">
      <nav className="mx-auto flex max-w-page items-center gap-3 px-4 py-3 sm:gap-6" aria-label="Main">
        <Link href="/" className="display shrink-0 text-lg tracking-tight">
          Racket<span className="text-court">Buddy</span>
        </Link>

        <div className={`hidden flex-1 items-center gap-6 text-sm font-semibold md:flex`}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`relative py-1 ${active(l.href) ? "text-court" : "text-slate hover:text-ink"}`}>
              {l.label}
              {active(l.href) && <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-court" />}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link
                href="/profil"
                aria-label={t("nav.profile")}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  active("/profil") ? "bg-court text-chalk" : "bg-ink text-chalk hover:bg-ink-soft"
                }`}
              >
                {initials}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={`btn-ghost btn-sm whitespace-nowrap ${marketingPage ? "!hidden sm:!inline-flex" : ""}`}>
                {t("nav.login")}
              </Link>
              <Link href={marketingPage ? "/opret-klub" : "/signup"} className="btn-court btn-sm whitespace-nowrap">
                {marketingPage ? "List your club" : t("nav.signup")}
              </Link>
            </>
          )}

          {marketingPage && (
            <div className="relative md:hidden" ref={menuRef}>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="site-menu"
                aria-label="Menu"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate/20 text-ink"
              >
                <Icon name={menuOpen ? "x" : "list"} />
              </button>
              {menuOpen && (
                <div id="site-menu" className="absolute right-0 top-full mt-2 w-60 animate-pop-in rounded-2xl border border-slate/15 bg-chalk p-2 shadow-pop">
                  {links.map((l) => (
                    <Link key={l.href} href={l.href} className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-ink hover:bg-mist">
                      {l.label}
                    </Link>
                  ))}
                  {!user && (
                    <>
                      <Link href="/login" className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-ink hover:bg-mist">{t("nav.login")}</Link>
                      <Link href="/signup" className="mt-1 flex min-h-11 items-center rounded-xl bg-court px-3 font-semibold text-chalk">{t("nav.signup")}</Link>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
