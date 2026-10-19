import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import "./globals.css";
import { InternationalProvider } from "../components/InternationalProvider";
import { getCurrentUser } from "../lib/session";
import { getPreferences } from "../lib/preferences";
import { SiteHeader } from "../components/SiteHeader";
import { isOwnHost } from "../lib/hosts";
import { TabBar } from "../components/TabBar";
import { BuddySportsOnboarding } from "../components/BuddySportsOnboarding";
import { recordView } from "../lib/analytics";
import { unreadCount } from "../lib/messages";
import { getSettings } from "../lib/settings";
import { consumeSignupSportsIntent, hasChosenBuddySports } from "../lib/buddy-sports";

const SITE_NAME = "RacketBuddy";
const DEFAULT_TITLE = "RacketBuddy — Reserve courts, book coaches, run your club";
const DEFAULT_DESCRIPTION =
  "The easiest way to play racquet sports and the smartest way to run a club. Reserve tennis, pickleball and padel courts, book coaches and find hitting partners across the United States.";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(settings.appUrl),
    title: { default: DEFAULT_TITLE, template: `%s · ${SITE_NAME}` },
    description: DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [{ url: "/images/club-life-hero.webp", width: 1536, height: 1024, alt: "Tennis players beside a clubhouse in the afternoon sun" }],
    },
    twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F2138",
};

const FOOTER_LINKS = {
  Players: [
    { href: "/courts", label: "Reserve a court" },
    { href: "/coaches", label: "Find a coach" },
    { href: "/players", label: "Find a hitting partner" },
    { href: "/app", label: "Get the app" },
  ],
  Clubs: [
    { href: "/list-your-club", label: "List your club" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/website", label: "Club website" },
    { href: "/login", label: "Club sign in" },
  ],
  Company: [
    { href: "/terms/us", label: "Terms of service" },
    { href: "/privacy", label: "Privacy" },
    { href: "/dpa", label: "Data processing agreement" },
    { href: "/delete-account", label: "Delete your account" },
  ],
} as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);
  const unread = user ? await unreadCount(user.id) : 0;
  const requestHeaders = await headers();

  let needsSportsOnboarding = false;
  if (user && ["PLAYER", "COACH"].includes(user.role)) {
    const alreadyChosen = await hasChosenBuddySports(user.id);
    if (!alreadyChosen) {
      // New users already chose their sports at signup. The choice is kept
      // briefly against the e-mail address until their account/session
      // exists. Existing users have no signup intent, so they get the
      // prompt exactly once the next time they visit.
      const consumed = await consumeSignupSportsIntent({ id: user.id, email: user.email, role: user.role });
      needsSportsOnboarding = !consumed;
    }
  }

  void recordView(requestHeaders.get("user-agent"));

  const onOwnDomain = !isOwnHost(requestHeaders.get("host") ?? "");

  return (
    <html lang="en-US">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter+Tight:wght@400;500;600;700&family=Martian+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <InternationalProvider locale={prefs.locale} country={prefs.country}>
          {onOwnDomain ? null : <SiteHeader user={user ? { name: user.name, role: user.role } : null} locale={prefs.locale} />}

          <main className={`mx-auto max-w-page px-4 py-6 md:pb-16 md:pt-10 ${user ? "has-tabbar" : ""}`}>{children}</main>

          {onOwnDomain ? (
            <footer className="mt-16 border-t border-slate/15 px-4 py-6 text-center text-xs text-slate-light">
              Booking and payments powered by{" "}
              <a href="https://racketbuddy.app" className="underline">RacketBuddy</a>
            </footer>
          ) : (
            <footer className={`mt-20 border-t border-slate/10 bg-chalk ${user ? "has-tabbar md:pb-0" : ""}`}>
              <div className="mx-auto max-w-page px-4 py-12">
                <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(3,1fr)]">
                  <div>
                    <p className="display text-xl">
                      Racket<span className="text-court">Buddy</span>
                    </p>
                    <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate">
                      The easiest way to play racquet sports and the smartest way to run a club. Made for the United States.
                    </p>
                  </div>
                  {Object.entries(FOOTER_LINKS).map(([group, links]) => (
                    <div key={group}>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate">{group}</p>
                      <ul className="mt-3 space-y-2 text-sm font-medium text-slate">
                        {links.map((link) => (
                          <li key={link.href}>
                            <Link href={link.href} className="hover:text-ink">{link.label}</Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate/10 pt-6 text-xs text-slate-light">
                  <p>© {new Date().getFullYear()} RacketBuddy. All prices in USD.</p>
                  <p>
                    <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="hover:text-slate">IP Geolocation by DB-IP</a>
                  </p>
                </div>
              </div>
            </footer>
          )}

          {user && <TabBar locale={prefs.locale} unread={unread} />}
          {needsSportsOnboarding && <Suspense><BuddySportsOnboarding locale={prefs.locale} /></Suspense>}
        </InternationalProvider>
      </body>
    </html>
  );
}
