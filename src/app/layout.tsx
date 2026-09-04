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
import { detectCountry } from "../lib/geo";
import { recordView } from "../lib/analytics";
import { translator } from "../lib/i18n";
import { unreadCount } from "../lib/messages";
import { getSettings } from "../lib/settings";

// Asynkron, fordi adressen kan ændres under Opsætning: metadataBase
// afgør, hvor delelinks og OG-billeder peger hen.
export async function generateMetadata(): Promise<Metadata> {
  const [settings, prefs] = await Promise.all([getSettings(), getPreferences()]);
  const t = translator(prefs.locale);

  return {
    // Titlen i fanen skal følge sproget som alt andet — en tysker, der har
    // valgt tysk, skal ikke have en dansk fane stående.
    title: t("meta.title"),
    description: t("meta.description"),
    // icon.png, apple-icon.png og opengraph-image.png i denne mappe
    // opsamles automatisk af Next.js — ingen <link>-tags nødvendige.
    metadataBase: new URL(settings.appUrl),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F2138",
};

/**
 * Er siden hentet på en klubs eget domæne?
 *
 * Så skal vores navigation ikke vises. Klubben har betalt for en
 * hjemmeside, ikke for en RacketBuddy-side med deres navn på.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, prefs] = await Promise.all([getCurrentUser(), getPreferences()]);
  const t = translator(prefs.locale);
  const unread = user ? await unreadCount(user.id) : 0;
  const suggestedCountry = prefs.countryChosen ? null : detectCountry();

  // Tælles her, fordi layoutet kører for hver sidevisning og allerede er
  // dynamisk. Der ventes ikke på den: et tal til en oversigt må aldrig
  // forsinke siden for den, der kigger på den.
  void recordView(headers().get("user-agent"));

  // Ligger siden på en klubs eget domæne, skjules vores egen navigation og
  // bundlinje. Klubben har betalt for en hjemmeside, ikke for en
  // RacketBuddy-side med deres navn på.
  const onOwnDomain = !isOwnHost(headers().get("host") ?? "");

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
        {onOwnDomain ? null : (
          <SiteHeader
          user={user ? { name: user.name, role: user.role } : null}
          locale={prefs.locale}
        />
        )}

        {/* Pladsen til bundlinjen afsættes kun, når bundlinjen faktisk er
            der — ellers ville en udlogget besøgende få 68 tomme pixels
            nederst på hver eneste side. */}
        <main
          className={`mx-auto max-w-6xl px-4 py-6 md:pb-16 md:pt-10 ${user ? "has-tabbar" : ""}`}
        >
          {/* Kun når gættet peger et andet sted hen end det, vi viser. Er
              man dér, hvor vi allerede er, er der ingenting at spørge om. */}
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

        {/* Bundlinjen er navigation i det, man har adgang til. Udlogget er
            der intet at navigere rundt i endnu, og fire faner, der alle
            ender på login-siden, er en blindgyde frem for en genvej.
            Forsiden fører selv de besøgende videre. */}
        {user && <TabBar locale={prefs.locale} unread={unread} />}


      </body>
    </html>
  );
}
