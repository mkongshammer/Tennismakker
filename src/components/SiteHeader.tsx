"use client";

// Sidehovedet: fire punkter, som er hele produktet i overskrifter.
// Book bane · Find træner · Find medspiller · Min profil.
//
// På telefon foldes de til en skuffe — fire punkter plus sprogvalg og
// login brød før over flere linjer.

import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = translator(locale);

  const links = [
    { href: "/book", label: t("nav.book") },
    { href: "/traenere", label: t("nav.coaches") },
    { href: "/spillere", label: t("nav.players") },
    { href: "/profil", label: t("nav.profile") },
  ];

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="bg-bane text-kridt">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="display shrink-0 text-xl">
          Racket<span className="text-grus">Buddy</span>
        </Link>

        <div className="hidden flex-1 items-center gap-5 text-sm font-medium md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={active(l.href) ? "underline underline-offset-4" : "hover:underline"}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-4 text-sm md:flex">
          {user ? (
            <>
              <Link href="/beskeder" className="hover:underline">{t("nav.messages")}</Link>
              {user.role === "CLUB_ADMIN" && (
                <Link href="/admin" className="hover:underline">{t("nav.admin")}</Link>
              )}
              {user.role === "SUPERADMIN" && (
                <Link href="/superadmin" className="hover:underline">Godkendelser</Link>
              )}
              <form action={logout}>
                <button className="opacity-80 hover:underline">{t("nav.logout")}</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">{t("nav.login")}</Link>
              <Link
                href="/signup"
                className="rounded-md bg-grus px-3 py-1.5 font-semibold hover:bg-grus-dark"
              >
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t("nav.menuClose") : t("nav.menuOpen")}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-md md:hidden"
        >
          <span className="relative block h-4 w-6" aria-hidden="true">
            <span className={`absolute left-0 block h-0.5 w-6 bg-kridt transition-transform ${open ? "top-2 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 top-2 block h-0.5 w-6 bg-kridt transition-opacity ${open ? "opacity-0" : "opacity-100"}`} />
            <span className={`absolute left-0 block h-0.5 w-6 bg-kridt transition-transform ${open ? "top-2 -rotate-45" : "top-4"}`} />
          </span>
        </button>
      </nav>

      {open && (
        <div className="border-t border-kridt/15 px-4 pb-5 pt-2 md:hidden">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block rounded-md px-3 py-3 text-base ${
                    active(l.href) ? "bg-kridt/10 font-semibold" : ""
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1 border-t border-kridt/15 pt-3">
            {user ? (
              <>
                <Link href="/beskeder" className="block rounded-md px-3 py-3 text-base">
                  {t("nav.messages")}
                </Link>
                {user.role === "CLUB_ADMIN" && (
                  <Link href="/admin" className="block rounded-md px-3 py-3 text-base">
                    {t("nav.admin")}
                  </Link>
                )}
                {user.role === "SUPERADMIN" && (
                  <Link href="/superadmin" className="block rounded-md px-3 py-3 text-base">
                    Godkendelser
                  </Link>
                )}
                <form action={logout}>
                  <button className="w-full rounded-md px-3 py-3 text-left text-base opacity-80">
                    {t("nav.logout")}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/login" className="rounded-md px-3 py-3 text-base">
                  {t("nav.login")}
                </Link>
                <Link href="/signup" className="rounded-md bg-grus px-3 py-3 text-center text-base font-semibold">
                  {t("nav.signup")}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="chalk-line" />
    </header>
  );
}
