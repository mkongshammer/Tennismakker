import { PlaceInput } from "../../components/ui/PlaceInput";
import { notErased } from "../../lib/erasure";

import {UiText} from "../../components/InternationalProvider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { db } from "../../lib/db";
import { LevelBadge } from "../../components/LevelBadge";
import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { contactPlayer } from "./actions";
import { respondToMatchPost } from "../matches/actions";
import { MATCH_TYPES } from "../../lib/levels";
import { sportColor, sportLabel, SPORTS } from "../../lib/sports";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Icon } from "../../components/ui";
import { ShareRacketBuddy } from "./ShareRacketBuddy";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

// Every player gets their own colours, always the same ones, so a face-less
// profile is still recognisable in a row of twenty.
const GRADIENTS = [
  ["#1B62C4", "#7AB0FF"], ["#0D7D5A", "#7BE0B5"], ["#B4541E", "#FFB37A"], ["#6B3FA0", "#C9A6FF"],
  ["#0F6E8C", "#7FD8F0"], ["#A0284B", "#FF9DB8"], ["#3D5A1E", "#C8E86B"], ["#1F3A8A", "#9CB6FF"],
];
function gradientFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/** Round profile picture. With `ring` it gets the "looking to play" ring. */
function Avatar({ id, name, size, ring = false }: { id: string; name: string; size: number; ring?: boolean }) {
  const face = (
    <span className="flex items-center justify-center rounded-full font-extrabold text-white" style={{ width: size, height: size, background: gradientFor(id), fontSize: Math.round(size * 0.36), letterSpacing: "-0.02em" }} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
  if (!ring) return face;
  return (
    <span className="inline-flex rounded-full p-[3px]" style={{ background: "conic-gradient(from 210deg, #D8FF3E, #3B84E8, #FF8A4C, #D8FF3E)" }}>
      <span className="rounded-full bg-chalk p-[3px]">{face}</span>
    </span>
  );
}

type Props = {
  searchParams: Promise<{ sport?: string; region?: string; page?: string; chat?: string }>;
};

function splitSports(value: string) {
  return value
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

function pageHref(page: number, sport: string, region: string) {
  const params = new URLSearchParams();
  if (sport) params.set("sport", sport);
  if (region) params.set("region", region);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/players?${query}` : "/players";
}

export default async function SpillerePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const prefs = await getPreferences();
  const t = translator(prefs.locale);
  const resolvedSearchParams = await searchParams;
  const selectedSport = (resolvedSearchParams.sport ?? "").trim().toUpperCase();
  const selectedRegion = (resolvedSearchParams.region ?? "").trim();
  const requestedPage = Math.max(1, Number.parseInt(resolvedSearchParams.page ?? "1", 10) || 1);

  const [allPlayers, posts] = await Promise.all([
    db.user.findMany({
      where: { id: { not: user.id }, role: { in: ["PLAYER", "COACH"] }, ...notErased, country: "US" },
      select: { id: true, name: true, level: true, area: true, bio: true, sports: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.matchRequest.findMany({
      where: { status: "OPEN", source: "POST", requester: { country: "US", ...notErased } },
      select: { id: true, message: true, area: true, level: true, sport: true, matchType: true, createdAt: true, requesterId: true, requester: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const matches = (sports: string, area: string | null) =>
    (!selectedSport || splitSports(sports).includes(selectedSport)) &&
    (!selectedRegion || (area ?? "").toLowerCase().includes(selectedRegion.toLowerCase()));

  const filteredPlayers = allPlayers.filter((p) => matches(p.sports, p.area));
  const feed = posts.filter((p) => matches(p.sport, p.area)).slice(0, 6);
  // Stories: one bubble per player with an open post, newest first.
  const looking = [...new Map(posts.filter((p) => p.requesterId !== user.id && matches(p.sport, p.area)).map((p) => [p.requesterId, p])).values()].slice(0, 14);
  const lookingIds = new Set(posts.map((p) => p.requesterId));
  const sportsInUse = SPORTS.filter((sp) => allPlayers.some((p) => splitSports(p.sports).includes(sp)));

  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const players = filteredPlayers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isNew = (d: Date) => Date.now() - d.getTime() < 14 * 86_400_000;
  const ago = (d: Date) => formatDistanceToNow(d, { addSuffix: true, locale: prefs.locale === "es" ? es : undefined });
  const chip = (active: boolean) => `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${active ? "border-court bg-court text-white" : "border-slate/20 text-ink hover:border-court"}`;

  return (
    <div className="mx-auto min-w-0 max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-display-md sm:text-display-lg">{t("players.findTitle")}</h1>
          <p className="mt-1 text-slate">
            {filteredPlayers.length} {filteredPlayers.length === 1 ? "player" : "players"}{selectedRegion ? ` near ${selectedRegion}` : " across the US"}. Say hi and set up a game.
          </p>
        </div>
        <Link href="/matches/new" className="btn-court"><Icon name="sparkle" /> New post</Link>
      </div>

      {resolvedSearchParams.chat === "locked" && (
        <p className="mb-4 rounded-2xl border border-slate/15 bg-mist p-4 text-sm" role="status">
          Coaches and players can message each other once a lesson has been accepted by the coach and paid for by the player.
        </p>
      )}

      {/* Stories: who wants to play right now */}
      <section aria-label="Looking to play" className="mb-5 max-w-full overflow-x-auto pb-1 [scrollbar-width:none]">
        <ul className="flex gap-4">
          <li className="w-[76px] shrink-0 text-center">
            <Link href="/matches/new" className="group block" aria-label="Post that you want to play">
              <span className="relative mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed border-slate/30 text-court group-hover:border-court">
                <span className="text-3xl font-light leading-none">+</span>
              </span>
              <span className="mt-1.5 block truncate text-xs font-semibold">Your post</span>
            </Link>
          </li>
          {looking.map((p) => (
            <li key={p.requesterId} className="w-[76px] shrink-0 text-center">
              <a href={`#post-${p.id}`} className="block" aria-label={`${p.requester.name} wants to play`}>
                <Avatar id={p.requester.id} name={p.requester.name} size={60} ring />
                <span className="mt-1 block truncate text-xs font-semibold">{firstName(p.requester.name)}</span>
              </a>
            </li>
          ))}
          {looking.length === 0 && (
            <li className="flex items-center text-sm text-slate">Nobody has posted yet. Be the first: tap + and say when you want to play.</li>
          )}
        </ul>
      </section>

      {/* Filters */}
      <div className="mb-5 flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex w-full min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] sm:w-auto sm:flex-wrap">
          <Link href={pageHref(1, "", selectedRegion)} className={chip(!selectedSport)}>All</Link>
          {sportsInUse.map((sp) => (
            <Link key={sp} href={pageHref(1, sp, selectedRegion)} className={chip(selectedSport === sp)}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedSport === sp ? "#fff" : sportColor(sp) }} aria-hidden="true" />
              {sportLabel(sp, prefs.locale)}
            </Link>
          ))}
        </div>
        <form method="get" className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs sm:flex-none sm:ml-auto">
          {selectedSport && <input type="hidden" name="sport" value={selectedSport} />}
          <label className="sr-only" htmlFor="players-region">City or state</label>
          <PlaceInput id="players-region" name="region" defaultValue={selectedRegion} placeholder="City or state" className="input h-10 min-w-0 flex-1 rounded-full px-4 py-0 text-sm" />
          <button type="submit" className="btn-ghost btn-sm shrink-0" aria-label="Search"><Icon name="search" size={18} /></button>
          {selectedRegion && <Link href={pageHref(1, selectedSport, "")} className="btn-ghost btn-sm shrink-0" aria-label="Clear city"><Icon name="x" size={18} /></Link>}
        </form>
      </div>

      {/* Feed: latest posts */}
      {feed.length > 0 && (
        <section aria-labelledby="feed-heading" className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="feed-heading" className="display text-title">Looking to play</h2>
            <Link href="/matches" className="text-sm font-semibold text-court hover:underline">See all posts</Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {feed.map((p) => (
              <li key={p.id} id={`post-${p.id}`} className="card-flat min-w-0 scroll-mt-24 !p-0">
                <div className="flex items-center gap-3 px-4 pt-4">
                  <Avatar id={p.requester.id} name={p.requester.name} size={40} ring />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold leading-tight">{p.requester.name}</p>
                    <p className="truncate text-xs text-slate">{p.area} · {ago(p.createdAt)}</p>
                  </div>
                  <LevelBadge level={p.level} />
                </div>
                <p className="break-words px-4 py-3 text-[15px] leading-6">{p.message}</p>
                <div className="flex flex-wrap items-center gap-2 border-t border-slate/10 px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-2.5 py-1 text-xs font-semibold">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sportColor(p.sport) }} aria-hidden="true" />{sportLabel(p.sport, prefs.locale)}
                  </span>
                  <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-semibold">{MATCH_TYPES[p.matchType] ?? p.matchType}</span>
                  {p.requesterId === user.id ? (
                    <span className="ml-auto text-sm text-slate">{t("partners.yours")}</span>
                  ) : (
                    <form action={respondToMatchPost} className="ml-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn-court btn-sm"><Icon name="chat" size={16} /> I’m in</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Player grid */}
      <h2 className="display mb-3 text-title">Players</h2>
      {players.length === 0 ? (
        <div className="card-flat text-center">
          <p className="font-bold"><UiText text="Ingen spillere matcher dine filtre endnu."/></p>
          <p className="mt-2 text-sm text-slate"><UiText text="Prøv en anden region eller en anden sportsgren, eller opret et opslag."/></p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/matches/new" className="btn-court"><UiText text="Opret opslag"/></Link>
            <Link href="/players" className="btn-ghost"><UiText text="Nulstil"/></Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {players.map((player) => {
              const sports = splitSports(player.sports);
              return (
                <li key={player.id} className="card-flat flex min-w-0 flex-col overflow-hidden !p-0 text-center">
                  <div className="relative h-16" style={{ background: gradientFor(player.id), opacity: 0.9 }} aria-hidden="true">
                    {isNew(player.createdAt) && <span className="absolute right-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
                  </div>
                  <div className="relative z-10 -mt-9 flex justify-center">{lookingIds.has(player.id) ? <Avatar id={player.id} name={player.name} size={64} ring /> : <span className="rounded-full ring-4 ring-chalk"><Avatar id={player.id} name={player.name} size={64} /></span>}</div>
                  <div className="flex flex-1 flex-col px-3 pb-4 pt-2">
                    <p className="line-clamp-1 break-words font-bold leading-tight">{player.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate">{player.area || "United States"}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                      <LevelBadge level={player.level} />
                      {player.role === "COACH" && <span className="rounded-full bg-court/10 px-2 py-1 text-xs font-semibold text-court">Coach</span>}
                    </div>
                    <p className="mt-2 flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-xs text-slate">
                      {sports.map((sp) => (
                        <span key={sp} className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sportColor(sp) }} aria-hidden="true" />{sportLabel(sp, prefs.locale)}</span>
                      ))}
                    </p>
                    {player.bio ? <p className="mt-2 line-clamp-2 break-words text-sm leading-5 text-slate">{player.bio}</p> : null}
                    <form action={contactPlayer} className="mt-auto pt-3">
                      <input type="hidden" name="playerId" value={player.id} />
                      <button className="btn-court btn-sm w-full"><Icon name="chat" size={16} /> Message</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Pages">
              {currentPage > 1 ? <Link href={pageHref(currentPage - 1, selectedSport, selectedRegion)} className="btn-ghost btn-sm" rel="prev">Previous</Link> : null}
              <span className="px-2 text-sm text-slate">Page {currentPage} of {totalPages}</span>
              {currentPage < totalPages ? <Link href={pageHref(currentPage + 1, selectedSport, selectedRegion)} className="btn-court btn-sm" rel="next">Next</Link> : null}
            </nav>
          ) : null}
        </>
      )}

      <div className="mt-8"><ShareRacketBuddy /></div>
    </div>
  );
}
