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
import { getClubAvailability } from "../lib/integrations";
import { translator } from "../lib/i18n";
import { sportColor, sportLabel } from "../lib/sports";

export const dynamic = "force-dynamic";

export default async function Home() {
  const prefs = await getPreferences();
  const t = translator(prefs.locale);

  const clubs = await db.club.findMany({
    where: {
      status: "APPROVED",
      country: prefs.country,
      courts: { some: { sport: prefs.sport } },
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
          <p className="eyebrow text-chalk/75">
            {sportLabel(prefs.sport, prefs.locale)} · i dag
          </p>
          <p className="data mt-3 text-6xl font-bold leading-none sm:text-8xl">
            {freeToday}
          </p>
          <h1 className="display mt-2 text-2xl sm:text-4xl">
            {freeToday === 1 ? "ledig banetime nær dig" : "ledige banetimer nær dig"}
          </h1>
          <p className="mt-4 max-w-lg text-chalk/85">
            Book uden medlemskab. Find en træner, når du vil blive bedre. Find en
            medspiller, når du mangler en at spille imod.
          </p>
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

      {/* De tre indgange, med de tal der faktisk findes */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            href: "/book",
            label: t("nav.book"),
            n: clubs.length,
            unit: clubs.length === 1 ? "klub" : "klubber",
            body: "Se ledige tider i klubber nær dig, og betal online. Du behøver ikke være medlem.",
          },
          {
            href: "/traenere",
            label: t("nav.coaches"),
            n: coaches,
            unit: coaches === 1 ? "træner" : "trænere",
            body: "Enkelttimer eller hele forløb. Priser og ledige tider står på profilen.",
          },
          {
            href: "/spillere",
            label: t("nav.players"),
            n: players,
            unit: players === 1 ? "spiller" : "spillere",
            body: "Se spillere på dit niveau. Siger I begge ja, åbner der en samtale.",
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

      {/* Klub-pitch */}
      <section className="overflow-hidden rounded-2xl bg-ink px-6 py-10 text-chalk sm:px-10">
        <div className="chalk-line mb-6 max-w-[220px]" />
        <h2 className="display text-2xl sm:text-3xl">Sidder du i en klubbestyrelse?</h2>
        <p className="mt-3 max-w-2xl text-chalk/80">
          I beholder jeres eget bookingsystem. Vi viser kun de tider, I selv
          frigiver, til spillere udefra — og sender betalingen videre til jer.
          Vælg mellem 10% pr. booking eller et fast månedsbeløb.
        </p>
        <Link href="/opret-klub" className="btn-court mt-6">
          {t("club.signup")}
        </Link>
      </section>
    </div>
  );
}
