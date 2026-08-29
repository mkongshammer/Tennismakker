"use client";

// Sidehovedet.
//
// På bred skærm ligger punkterne i én række. På telefon er der ikke plads
// til otte punkter — de brød før over tre linjer og skubbede indholdet ned.
// Derfor: logo og en menuknap, og resten i en skuffe der folder ud.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: { name: string; role: string } | null;
  logout: () => Promise<void>;
};

const LINKS = [
  { href: "/spillere", label: "Find spillere" },
  { href: "/makkere", label: "Opslag" },
  { href: "/traenere", label: "Trænere" },
  { href: "/klubber", label: "Klubber" },
];

export function SiteHeader({ user, logout }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Luk skuffen når man navigerer, ellers bliver den hængende over den nye side
  useEffect(() => setOpen(false), [pathname]);

  // Lås baggrunden, så siden ikke ruller bag den åbne skuffe
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
          Tennis&nbsp;Makker
        </Link>

        {/* Bred skærm */}
        <div className="hidden flex-1 items-center gap-5 text-sm font-medium md:flex">
          {LINKS.map((l) => (
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
              <Link href="/beskeder" className="hover:underline">Beskeder</Link>
              <Link href="/profil" className="font-semibold hover:underline">
                {user.name.split(" ")[0]}
              </Link>
              {user.role === "CLUB_ADMIN" && (
                <Link href="/admin" className="hover:underline">Klub-admin</Link>
              )}
              <form action={logout}>
                <button className="opacity-80 hover:underline">Log ud</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">Log ind</Link>
              <Link
                href="/signup"
                className="rounded-md bg-grus px-3 py-1.5 font-semibold hover:bg-grus-dark"
              >
                Opret profil
              </Link>
            </>
          )}
        </div>

        {/* Telefon */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Luk menu" : "Åbn menu"}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-md md:hidden"
        >
          <span className="relative block h-4 w-6" aria-hidden="true">
            <span
              className={`absolute left-0 block h-0.5 w-6 bg-kridt transition-transform ${
                open ? "top-2 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-2 block h-0.5 w-6 bg-kridt transition-opacity ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 block h-0.5 w-6 bg-kridt transition-transform ${
                open ? "top-2 -rotate-45" : "top-4"
              }`}
            />
          </span>
        </button>
      </nav>

      {open && (
        <div className="md:hidden">
          <div className="border-t border-kridt/15 px-4 pb-5 pt-2">
            <ul className="space-y-1">
              {LINKS.map((l) => (
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

            <div className="mt-3 border-t border-kridt/15 pt-3">
              {user ? (
                <ul className="space-y-1">
                  <li>
                    <Link href="/beskeder" className="block rounded-md px-3 py-3 text-base">
                      Beskeder
                    </Link>
                  </li>
                  <li>
                    <Link href="/profil" className="block rounded-md px-3 py-3 text-base font-semibold">
                      {user.name.split(" ")[0]}
                    </Link>
                  </li>
                  {user.role === "CLUB_ADMIN" && (
                    <li>
                      <Link href="/admin" className="block rounded-md px-3 py-3 text-base">
                        Klub-admin
                      </Link>
                    </li>
                  )}
                  <li>
                    <form action={logout}>
                      <button className="w-full rounded-md px-3 py-3 text-left text-base opacity-80">
                        Log ud
                      </button>
                    </form>
                  </li>
                </ul>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/login" className="rounded-md px-3 py-3 text-base">
                    Log ind
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-md bg-grus px-3 py-3 text-center text-base font-semibold"
                  >
                    Opret profil
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="chalk-line" />
    </header>
  );
}
