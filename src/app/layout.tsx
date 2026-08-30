import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "../lib/session";
import { getPreferences } from "../lib/preferences";
import { logout } from "../lib/actions";
import { SiteHeader } from "../components/SiteHeader";
import { translator } from "../lib/i18n";

export const metadata: Metadata = {
  title: "RacketBuddy — book bane, find træner og medspiller",
  description:
    "Book en bane, find en træner, og find en medspiller på dit niveau. Tennis, padel, badminton, squash og mere.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);
  const t = translator(prefs.locale);

  return (
    <html lang={prefs.locale}>
      <body className="min-h-screen">
        <SiteHeader
          user={user ? { name: user.name, role: user.role } : null}
          locale={prefs.locale}
          logout={logout}
        />

        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>

        <footer className="mt-16 bg-bane-dyb pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 text-kridt/70">
          <div className="chalk-line mb-6" />
          <div className="mx-auto max-w-5xl px-4 text-center text-sm">
            <div className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-3">
              <Link href="/opret-klub" className="hover:underline">{t("club.signup")}</Link>
              <Link href="/app" className="hover:underline">App</Link>
              <Link href="/vilkaar" className="hover:underline">Handelsbetingelser</Link>
              <Link href="/privatliv" className="hover:underline">Privatliv</Link>
              <Link href="/databehandleraftale" className="hover:underline">Databehandleraftale</Link>
            </div>
            RacketBuddy · Ketsjersport samlet ét sted
          </div>
        </footer>
      </body>
    </html>
  );
}
