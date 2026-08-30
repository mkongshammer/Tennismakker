import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "../lib/session";
import { getPreferences } from "../lib/preferences";
import { SiteHeader } from "../components/SiteHeader";
import { TabBar } from "../components/TabBar";
import { translator } from "../lib/i18n";
import { unreadCount } from "../lib/messages";

export const metadata: Metadata = {
  title: "RacketBuddy — book bane, find træner og medspiller",
  description:
    "Book en bane, find en træner, og find en medspiller på dit niveau. Tennis, padel, badminton, squash og mere.",
  // icon.png, apple-icon.png og opengraph-image.png i denne mappe
  // opsamles automatisk af Next.js — ingen <link>-tags nødvendige.
  metadataBase: new URL(process.env.APP_URL ?? "https://tennis-makker.onrender.com"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F2138",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);
  const t = translator(prefs.locale);
  const unread = user ? await unreadCount(user.id) : 0;

  return (
    <html lang={prefs.locale}>
      <head>
        {/* Skrifterne hentes i browseren, ikke ved bygning — et fejlende
            font-CDN må aldrig kunne vælte et deploy. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter+Tight:wght@400;500;600;700&family=Martian+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <SiteHeader
          user={user ? { name: user.name, role: user.role } : null}
          locale={prefs.locale}
        />

        <main className="has-tabbar mx-auto max-w-6xl px-4 py-6 md:pb-16 md:pt-10">
          {children}
        </main>

        <footer className="has-tabbar mt-20 border-t border-slate/10 bg-chalk md:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <p className="display text-lg">
              Racket<span className="text-court">Buddy</span>
            </p>
            <p className="mt-1 text-sm text-slate">Ketsjersport samlet ét sted</p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate">
              <Link href="/opret-klub" className="hover:text-ink">{t("club.signup")}</Link>
              <Link href="/hjemmeside" className="hover:text-ink">Hjemmeside til klubben</Link>
              <Link href="/app" className="hover:text-ink">App</Link>
              <Link href="/vilkaar" className="hover:text-ink">Handelsbetingelser</Link>
              <Link href="/privatliv" className="hover:text-ink">Privatliv</Link>
              <Link href="/databehandleraftale" className="hover:text-ink">Databehandleraftale</Link>
            </div>
          </div>
        </footer>

        <TabBar locale={prefs.locale} unread={unread} />
      </body>
    </html>
  );
}
