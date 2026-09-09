import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "./globals.css";
import { getCurrentUser } from "../lib/session";
import { getPreferences } from "../lib/preferences";
import { SiteHeader } from "../components/SiteHeader";
import { isOwnHost } from "../lib/hosts";
import { TabBar } from "../components/TabBar";
import { LanguagePicker } from "../components/LanguagePicker";
import { CountrySuggestion } from "../components/CountrySuggestion";
import { BuddySportsOnboarding } from "../components/BuddySportsOnboarding";
import { detectCountry } from "../lib/geo";
import { recordView } from "../lib/analytics";
import { translator } from "../lib/i18n";
import { unreadCount } from "../lib/messages";
import { getSettings } from "../lib/settings";
import { consumeSignupSportsIntent } from "../lib/buddy-sports";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, prefs] = await Promise.all([getSettings(), getPreferences()]);
  const t = translator(prefs.locale);

  return {
    title: t("meta.title"),
    description: t("meta.description"),
    metadataBase: new URL(settings.appUrl),
  };
}

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
  const suggestedCountry = prefs.countryChosen ? null : detectCountry();

  let needsSportsOnboarding = false;
  if (
    user &&
    ["PLAYER", "COACH"].includes(user.role) &&
    !user.sportsChosen
  ) {
    // Nye brugere har allerede valgt sportsgrene i oprettelsen. Valget
    // gemmes som et kortlivet intent, fordi den fælles signup-handler
    // opretter sessionen og redirecter. Vi forbruger det på første side.
    // Eksisterende brugere har intet intent og får derfor prompten én gang.
    const consumed = await consumeSignupSportsIntent({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    needsSportsOnboarding = !consumed;
  }

  void recordView(headers().get("user-agent"));

  const onOwnDomain = !isOwnHost(headers().get("host") ?? "");

  return (
    <html lang={prefs.locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter+Tight:wght@400;500;600;700&family=Martian+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        {onOwnDomain ? null : (
          <SiteHeader
            user={user ? { name: user.name, role: user.role } : null}
            locale={prefs.locale}
          />
        )}

        <main
          className={`mx-auto max-w-6xl px-4 py-6 md:pb-16 md:pt-10 ${user ? "has-tabbar" : ""}`}
        >
          {!prefs.countryChosen && suggestedCountry && suggestedCountry !== prefs.country && (
            <CountrySuggestion code={suggestedCountry} />
          )}
          {children}
        </main>

        {onOwnDomain ? (
          <footer className="mt-16 border-t border-slate/15 px-4 py-6 text-center text-xs text-slate-light">
            Booking og betaling leveret af{" "}
            <a href="https://racketbuddy.app" className="underline">
              RacketBuddy
            </a>
          </footer>
        ) : (
          <footer
            className={`mt-20 border-t border-slate/10 bg-chalk md:pb-0 ${user ? "has-tabbar" : ""}`}
          >
            <div className="mx-auto max-w-6xl px-4 py-10">
              <p className="display text-lg">
                Racket<span className="text-court">Buddy</span>
              </p>
              <p className="mt-1 text-sm text-slate">Ketsjersport samlet ét sted</p>
              <p className="mt-1 text-sm text-slate">{t("availability.soon")}</p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate">
                <Link href="/opret-klub" className="hover:text-ink">{t("club.signup")}</Link>
                <Link href="/hjemmeside" className="hover:text-ink">Hjemmeside til klubben</Link>
                <Link href="/app" className="hover:text-ink">App</Link>
                <Link href="/vilkaar" className="hover:text-ink">Handelsbetingelser</Link>
                <Link href="/privatliv" className="hover:text-ink">Privatliv</Link>
                <Link href="/databehandleraftale" className="hover:text-ink">Databehandleraftale</Link>
              </div>
              <div className="mt-6 border-t border-slate/10 pt-5">
                <p className="mb-2 text-xs font-bold text-slate">{t("common.language")}</p>
                <LanguagePicker active={prefs.locale} />
              </div>
            </div>
          </footer>
        )}

        {user && <TabBar locale={prefs.locale} unread={unread} />}

        {needsSportsOnboarding && <BuddySportsOnboarding locale={prefs.locale} />}
      </body>
    </html>
  );
}
