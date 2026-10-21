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
      images: [{ url: "/images/og-racketbuddy.jpg", width: 1200, height: 630, alt: "RacketBuddy: your next court, one tap away" }],
    },
    twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, images: ["/images/og-racketbuddy.jpg"] },
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
      <body className="flex min-h-screen flex-col">
        <InternationalProvider locale={prefs.locale} country={prefs.country}>
          {onOwnDomain ? null : <SiteHeader user={user ? { name: user.name, role: user.role } : null} locale={prefs.locale} />}

          <main className={`mx-auto w-full max-w-page flex-1 px-4 py-6 md:pb-16 md:pt-10 ${user ? "has-tabbar" : ""}`}>{children}</main>

          {onOwnDomain ? (
            <footer className="mt-16 border-t border-slate/15 px-4 py-6 text-center text-xs text-slate-light">
              Booking and payments powered by{" "}
              <a href="https://racketbuddy.app" className="underline">RacketBuddy</a>
            </footer>
          ) : (
            <footer className={`relative isolate mt-20 overflow-hidden bg-ink-deep text-white ${user ? "has-tabbar" : ""}`}>
              {/* Court lines, faint, running off the corner: the brand without a picture. */}
              <svg aria-hidden="true" viewBox="0 0 360 780" className="pointer-events-none absolute -right-24 -top-40 -z-10 hidden h-[640px] w-[300px] rotate-[32deg] opacity-[0.07] md:block">
                <g fill="none" stroke="#fff" strokeWidth="4">
                  <rect x="2" y="2" width="356" height="776" />
                  <line x1="47" y1="2" x2="47" y2="778" /><line x1="313" y1="2" x2="313" y2="778" />
                  <line x1="47" y1="212" x2="313" y2="212" /><line x1="47" y1="568" x2="313" y2="568" />
                  <line x1="180" y1="212" x2="180" y2="568" />
                </g>
              </svg>
              <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-court-light/60 to-transparent" />

              <div className="mx-auto max-w-page px-4 pb-8 pt-14 md:pt-16">
                <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8">
                  <div>
                    <Link href="/" className="display text-2xl text-white">
                      Racket<span className="text-optic">Buddy</span>
                    </Link>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
                      The easiest way to play racquet sports and the smartest way to run a club. Made for the United States.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Link href="/courts" className="inline-flex items-center rounded-full bg-optic px-4 py-2 text-sm font-bold text-ink transition hover:bg-white">Reserve a court</Link>
                      <Link href="/list-your-club" className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5">List your club</Link>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:contents">
                    {Object.entries(FOOTER_LINKS).map(([group, links]) => (
                      <div key={group}>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">{group}</p>
                        <ul className="mt-4 space-y-2.5 text-sm">
                          {links.map((link) => (
                            <li key={link.href}>
                              <Link href={link.href} className="text-white/75 transition hover:text-optic">{link.label}</Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
                  <p>© {new Date().getFullYear()} PTMove LLC · RacketBuddy. All prices in USD.</p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <a href="mailto:support@racketbuddy.app" className="transition hover:text-white">support@racketbuddy.app</a>
                    <a href="https://db-ip.com" target="_blank" rel="noreferrer" className="transition hover:text-white">IP Geolocation by DB-IP</a>
                  </div>
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
