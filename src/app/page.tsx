// Forsiden.
//
// Åbner med det, produktet faktisk gør: hvor mange baner der står ledige
// lige nu. Et tomt tidsrum på en bane er den vare, platformen handler med,
// og tallet ændrer sig time for time — det er mere karakteristisk end et
// slogan og mere ærligt end et løfte.
import Link from "next/link";
import { addDays, startOfDay } from "date-fns";
import { db } from "../lib/db";
import { getPreferences } from "../lib/preferences";
import { getSettings } from "../lib/settings";
import { getClubAvailability } from "../lib/integrations";
import { translator } from "../lib/i18n";
import { SPORTS, sportColor, sportLabel } from "../lib/sports";
import { setSport } from "../lib/actions";
import { getCurrentUser } from "../lib/session";
import { Ball } from "../components/Ball";

export const dynamic = "force-dynamic";

export default async function Home() {
  const prefs = await getPreferences();
  const user = await getCurrentUser();
  const t = translator(prefs.locale);

  const clubs = await db.club.findMany({
    where: {
      status: "APPROVED",
      country: prefs.country,
      courts: { some: { sport: prefs.sport } },
      // Forsidens tal er et løfte. Klubber der ikke kan modtage betaling
      // endnu, kan ikke bookes — så de skal ikke tælles med.
      stripeChargesEnabled: true,
    },
    include: { courts: { where: { sport: prefs.sport } } },
  });

  const today = startOfDay(new Date());
  const counts = await Promise.all(
    clubs.map(async (c: any) => {
      const { slots } = await getClubAvailability(c.id, today, addDays(today, 1));
      return slots.filter((s) => c.courts.some((court: any) => court.id === s.courtId)).length;
    })
  );
  const freeToday = counts.reduce((a, b) => a + b, 0);

  const [coaches, players] = await Promise.all([
    db.coachProfile.count({ where: { sports: { contains: prefs.sport } } }),
    db.user.count({ where: { role: "PLAYER", country: prefs.country } }),
  ]);

  const pct = Math.round((await getSettings()).commissionPct * 100);
  const tint = sportColor(prefs.sport);

  return (
    <div className="space-y-14">
      {/* Hero: tallet der ændrer sig, ikke et slogan */}
      <section
        className="relative overflow-hidden rounded-2xl px-6 py-12 text-chalk sm:px-10 sm:py-16"
        style={{ backgroundColor: tint }}
      >
        {/* Banelinjer som baggrund — dæmpede, så tallet står alene */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
          viewBox="0 0 400 220"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g stroke="#fff" strokeWidth="1.5" fill="none">
            <rect x="30" y="20" width="340" height="180" />
            <line x1="30" y1="50" x2="370" y2="50" />
            <line x1="30" y1="170" x2="370" y2="170" />
            <line x1="120" y1="50" x2="120" y2="170" />
            <line x1="280" y1="50" x2="280" y2="170" />
            <line x1="120" y1="110" x2="280" y2="110" />
          </g>
          <line x1="200" y1="8" x2="200" y2="212" stroke="#fff" strokeWidth="3" />
        </svg>

        <div className="relative max-w-2xl">
          <p className="eyebrow text-chalk">
            {sportLabel(prefs.sport, prefs.locale)} · i dag · {t("availability.now")}
          </p>
          <p className="data mt-3 text-6xl font-bold leading-none sm:text-8xl">
            {freeToday}
          </p>
          <h1 className="display mt-2 text-2xl sm:text-4xl">
            {t(freeToday === 1 ? "home.slotOne" : "home.slotMany")}
          </h1>
          <p className="mt-4 max-w-lg text-chalk/85">{t("home.lede")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/book" className="btn bg-chalk text-ink hover:bg-mist">
              {t("nav.book")}
            </Link>
            <Link
              href="/spillere"
              className="btn border-2 border-chalk/60 text-chalk hover:bg-chalk/10"
            >
              {t("nav.players")}
            </Link>
          </div>
        </div>
      </section>

      {/* Sportsvalget som bolde. En bold genkendes hurtigere end et ord —
          man ved hvad man spiller, længe før man har læst det. */}
      <section>
        <h2 className="display text-2xl">{t("home.pickSport")}</h2>
        <p className="mt-1 text-sm text-slate">{t("home.pickSportNote")}</p>
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {SPORTS.map((s) => {
            const active = prefs.sport === s;
            return (
              <form action={setSport} key={s}>
                <input type="hidden" name="sport" value={s} />
                <button
                  className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 bg-chalk px-2 py-4 transition-all ${
                    active
                      ? "border-court shadow-lift"
                      : "border-transparent hover:border-court/40 hover:shadow-lift"
                  }`}
                >
                  <Ball sport={s} size={44} />
                  <span className={`text-xs font-bold ${active ? "text-court" : "text-slate"}`}>
                    {sportLabel(s, prefs.locale)}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* De tre indgange, med de tal der faktisk findes */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            href: "/book",
            label: t("nav.book"),
            n: clubs.length,
            unit: t(clubs.length === 1 ? "unit.club" : "unit.clubs"),
            body: t("home.cardBook"),
          },
          {
            href: "/traenere",
            label: t("nav.coaches"),
            n: coaches,
            unit: t(coaches === 1 ? "unit.coach" : "unit.coaches"),
            body: t("home.cardCoaches"),
          },
          {
            href: "/spillere",
            label: t("nav.players"),
            n: players,
            unit: t(players === 1 ? "unit.player" : "unit.players"),
            body: t("home.cardPlayers"),
          },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="card transition-shadow hover:shadow-lift">
            <p className="data text-3xl font-bold text-ink">{c.n}</p>
            <p className="text-sm font-semibold text-slate">{c.unit}</p>
            <p className="display mt-4 text-xl">{c.label}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate">{c.body}</p>
          </Link>
        ))}
      </section>

      {/* Sådan gør du: tre trin, fordi det er præcis så mange der er */}
      <section>
        <h2 className="display text-2xl sm:text-3xl">{t("home.howTitle")}</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            { n: 1, title: t("home.step1"), body: t("home.step1Body") },
            { n: 2, title: t("home.step2"), body: t("home.step2Body") },
            { n: 3, title: t("home.step3"), body: t("home.step3Body") },
          ].map((step) => (
            <li key={step.n} className="card">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-data text-sm font-bold text-chalk">
                {step.n}
              </span>
              <p className="display mt-3 text-xl">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* De tre indvendinger, folk faktisk har, besvaret hver for sig */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: t("home.trustNoMembership"), body: t("home.trustNoMembershipBody") },
          { title: t("home.trustPrice"), body: t("home.trustPriceBody") },
          { title: t("home.trustCancel"), body: t("home.trustCancelBody") },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl bg-chalk p-5">
            <p className="font-bold">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate">{item.body}</p>
          </div>
        ))}
      </section>

      {/* Kun til dem, der ikke har en profil. Resten har allerede sagt ja. */}
      {!user && (
        <section className="rounded-2xl border-2 border-court/25 bg-court/5 px-6 py-10 text-center">
          <h2 className="display text-2xl sm:text-3xl">{t("home.lede")}</h2>
          <Link href="/signup" className="btn-court mt-6 inline-block">
            {t("home.ctaSignup")}
          </Link>
        </section>
      )}

      {/* Spørgsmålene med de tal, systemet faktisk kører med. Står der 24
          timer her, skal koden også sige 24 — se REFUND_WINDOW_HOURS. */}
      <section>
        <h2 className="display text-2xl sm:text-3xl">{t("home.faqTitle")}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            { q: t("home.faq1Q"), a: t("home.faq1A") },
            { q: t("home.faq2Q"), a: t("home.faq2A") },
            { q: t("home.faq3Q"), a: t("home.faq3A") },
            { q: t("home.faq4Q"), a: t("home.faq4A") },
          ].map((item) => (
            <div key={item.q} className="card">
              <p className="display text-lg">{item.q}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Klub-pitch */}
      <section className="overflow-hidden rounded-2xl bg-ink px-6 py-10 text-chalk sm:px-10">
        <div className="chalk-line mb-6 max-w-[220px]" />
        <h2 className="display text-2xl sm:text-3xl">{t("club.boardQuestion")}</h2>
        <p className="mt-3 max-w-2xl text-chalk/80">
          {t("club.pitch")} {t("club.pitchPricing", { pct })}
        </p>
        <Link href="/opret-klub" className="btn-court mt-6">
          {t("club.signup")}
        </Link>
      </section>
    </div>
  );
}
