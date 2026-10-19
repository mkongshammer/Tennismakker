// Coach discovery.
//
// Coaches carry a free-text area ("Boston", "Brooklyn, NY") rather than
// coordinates, so location search matches the resolved city/state name and
// the raw query against that area. Cards answer the three questions a
// player has: who, how much per lesson, and when is the next open time.
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "../../lib/db";
import { coachRatings } from "../../lib/reviews";
import { getPreferences, setPreferenceCookies } from "../../lib/preferences";
import { freeSlots } from "../../lib/coaching";
import { describeLength, lessonPriceKr } from "../../lib/slots";
import { formatDate, formatMoney } from "../../lib/international";
import { SPORTS, sportLabel, type Sport } from "../../lib/sports";
import { resolvePlace } from "../../lib/us-places";
import { imageUrl } from "../../lib/imageUrl";
import { InterestForm } from "../../components/discovery/InterestForm";
import { EmptyState, Icon, PageHeader } from "../../components/ui";
import { CoachSearch } from "../../components/discovery/CoachSearch";

export const dynamic = "force-dynamic";

type Query = { q?: string; sport?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }): Promise<Metadata> {
  const query = await searchParams;
  const sport = (SPORTS as readonly string[]).includes(String(query.sport ?? "").toUpperCase()) ? sportLabel(String(query.sport).toUpperCase(), "en-US").toLowerCase() : "racquet sports";
  return {
    title: `${query.q ? `${sport} coaches near ${query.q}` : `Find a ${sport} coach`}`,
    description: `Book private ${sport} lessons with vetted coaches${query.q ? ` near ${query.q}` : " across the United States"}. Transparent lesson pricing, real availability, pay only once the coach confirms.`,
  };
}

export default async function CoachesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [prefs, query] = await Promise.all([getPreferences(), searchParams]);
  const sportRaw = String(query.sport ?? "").toUpperCase();
  const sport = (SPORTS as readonly string[]).includes(sportRaw) ? (sportRaw as Sport) : prefs.sport;
  if (sport !== prefs.sport) await setPreferenceCookies({ sport }).catch(() => {});
  const q = String(query.q ?? "").trim().slice(0, 120);
  const place = q ? await resolvePlace(q) : null;

  const all = await db.coachProfile.findMany({
    where: { sports: { contains: sport }, country: "US" },
    include: {
      user: true,
      packages: { where: { active: true } },
      images: { where: { approved: true }, take: 1, select: { id: true } },
    },
    orderBy: { priceHour: "asc" },
  });

  const needle = q.toLowerCase();
  const matchesPlace = (area: string) => {
    const a = area.toLowerCase();
    if (!q) return true;
    if (a.includes(needle)) return true;
    if (!place) return false;
    if (place.city && a.includes(place.city.toLowerCase())) return true;
    if (a.includes(place.state.toLowerCase()) || new RegExp(`\\b${place.state.toLowerCase()}\\b`).test(a)) return true;
    return false;
  };
  const coaches = all.filter((c) => matchesPlace(c.area));

  const [ratings, nextFree] = await Promise.all([
    coachRatings(coaches.map((c) => c.id)),
    Promise.all(coaches.map(async (c) => [c.id, (await freeSlots(c))[0] ?? null] as const)),
  ]);
  const nextByCoach = new Map(nextFree);
  const sportName = sportLabel(sport, "en-US");
  const where = place ? ` near ${place.label}` : q ? ` matching “${q}”` : "";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Find a coach" title={`${sportName} coaches${where}`} lead={coaches.length ? `${coaches.length} ${coaches.length === 1 ? "coach" : "coaches"} · book a single lesson or a package. You pay only after the coach confirms.` : "Search a city, state or ZIP to find coaches who teach near you."} />

      <CoachSearch q={q} sport={sport} />

      {coaches.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {coaches.map((c) => {
            const next = nextByCoach.get(c.id) ?? null;
            const rating = ratings.get(c.id) ?? { average: 0, count: 0 };
            const lesson = lessonPriceKr(c.priceHour, c.lessonMinutes);
            return (
              <li key={c.id}>
                <Link href={`/traenere/${c.id}`} className="card-interactive card flex h-full flex-col">
                  <div className="flex items-start gap-4">
                    {c.images[0] ? (
                      <img src={imageUrl(c.images[0].id)} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                    ) : (
                      <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-mist text-xl font-bold text-slate">
                        {c.user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-bold leading-tight">{c.user.name}</p>
                      <p className="mt-0.5 text-sm text-slate">{c.area}</p>
                      <p className="mt-1 text-sm">
                        {rating.count > 0 ? (
                          <>
                            <span className="text-court">★</span> {rating.average.toFixed(1)} <span className="text-slate-light">({rating.count})</span>
                          </>
                        ) : (
                          <span className="badge-neutral">New coach</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="display text-title text-court">{formatMoney(lesson, c.currency, "en-US")}</p>
                      <p className="text-xs text-slate">per {describeLength(c.lessonMinutes, "en-US")} lesson</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">{c.headline}</p>
                  {c.specialties && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.specialties.split(",").filter(Boolean).map((s) => (
                        <span key={s} className="badge-neutral">{s.trim()}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
                    {next ? (
                      <span className="badge-success"><Icon name="clock" size={14} /> Next {formatDate(next, "en-US", c.timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                    ) : (
                      <span className="badge-neutral">By request</span>
                    )}
                    {c.packages.length > 0 && <span className="text-xs font-semibold text-slate">{c.packages.length} lesson {c.packages.length === 1 ? "package" : "packages"}</span>}
                    <span className="ml-auto font-semibold text-court">See times →</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : all.length > 0 && q ? (
        <EmptyState
          icon={<Icon name="search" size={26} />}
          title={`No ${sportName.toLowerCase()} coaches${where} yet`}
          body={`${all.length} ${all.length === 1 ? "coach teaches" : "coaches teach"} ${sportName.toLowerCase()} elsewhere in the US. Coaches travel — a message often works.`}
          actions={
            <>
              <Link href={`/traenere?sport=${sport}`} className="btn-court">Show all {sportName.toLowerCase()} coaches</Link>
            </>
          }
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <div className="card-flat flex flex-col items-start px-6 py-8 sm:px-8">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3e6] text-grass"><Icon name="coach" size={26} /></span>
            <h2 className="display text-display-md">{place ? `No ${sportName.toLowerCase()} coaches on RacketBuddy near ${place.label} yet.` : `No ${sportName.toLowerCase()} coaches on RacketBuddy yet.`}</h2>
            <p className="mt-3 max-w-lg text-slate">We only list coaches with a real profile and bookable hours. Leave your email and we’ll let you know when a coach near you joins.</p>
            <div className="mt-6 w-full">
              <InterestForm q={q} sport={sport} kind="COACHES" label={place?.label} />
            </div>
          </div>
          <div className="grid gap-4">
            <Link href={`/book${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="card-interactive card-flat flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-court-tint text-court-dark"><Icon name="court" size={24} /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">Reserve a court instead</span><span className="block text-sm text-slate">See what’s open today near you.</span></span>
              <Icon name="chevron" className="text-slate" />
            </Link>
            <Link href="/profil/traener/opret" className="card-dark flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-optic"><Icon name="coach" size={24} /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">Are you a coach?</span><span className="block text-sm text-white/70">Set your rate and hours. Students book and pay you directly.</span></span>
              <Icon name="chevron" className="text-white/70" />
            </Link>
          </div>
        </section>
      )}

      {coaches.length > 0 && (
        <aside className="card-flat flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Coach {sportName.toLowerCase()}?</p>
            <p className="text-sm text-slate">Create a profile with your rate, lesson length and weekly hours. Payouts go straight to you.</p>
          </div>
          <Link href="/profil/traener/opret" className="btn-ghost shrink-0">Create a coach profile</Link>
        </aside>
      )}
    </div>
  );
}
