import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "../lib/session";
import { logout } from "../lib/actions";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Tennis Makker — find makker, træner og bane",
  description:
    "Dansk tennisplatform: find en makker på dit niveau, book en træner, og find en ledig bane i en klub nær dig.",
};

// Uden dette skalerer telefoner siden ned som var den et skrivebord
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // så indhold kan tage højde for hak og hjemmeindikator
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
        <SiteHeader
          user={user ? { name: user.name, role: user.role } : null}
          logout={logout}
        />

        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>

        <footer className="mt-16 bg-bane-dyb pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 text-kridt/70">
          <div className="chalk-line mb-6" />
          <div className="mx-auto max-w-5xl px-4 text-center text-sm">
            <div className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-3">
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
