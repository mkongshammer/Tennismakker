import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "../lib/session";
import { logout } from "../lib/actions";

export const metadata: Metadata = {
  title: "Tennis Makker — find makker, træner og bane",
  description:
    "Dansk tennisplatform: find en makker på dit niveau, book en træner, og book bane i din klub — alt i ét system.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="da">
      <body className="min-h-screen">
        <header className="bg-bane text-kridt">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="display text-xl">
              Tennis&nbsp;Makker
            </Link>
            <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium">
              <Link href="/spillere" className="hover:underline">Find spillere</Link>
              <Link href="/makkere" className="hover:underline">Opslag</Link>
              <Link href="/traenere" className="hover:underline">Trænere</Link>
              <Link href="/klubber" className="hover:underline">Klubber</Link>
            </div>
            <div className="flex items-center gap-3 text-sm">
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
                  <Link href="/signup" className="rounded-md bg-grus px-3 py-1.5 font-semibold hover:bg-grus-dark">
                    Opret profil
                  </Link>
                </>
              )}
            </div>
          </nav>
          <div className="chalk-line" />
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mt-16 bg-bane-dyb py-8 text-kridt/70">
          <div className="chalk-line mb-6" />
          <div className="mx-auto max-w-5xl px-4 text-center text-sm">
            <div className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
              <Link href="/opret-klub" className="hover:underline">Få jeres klub med</Link>
              <Link href="/app" className="hover:underline">Prøv appen</Link>
              <Link href="/vilkaar" className="hover:underline">Handelsbetingelser</Link>
              <Link href="/privatliv" className="hover:underline">Privatliv</Link>
              <Link href="/databehandleraftale" className="hover:underline">Databehandleraftale</Link>
            </div>
            Tennis Makker · Én platform til spillere, trænere og klubber
          </div>
        </footer>
      </body>
    </html>
  );
}
