import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { db } from "../../lib/db";
import { LevelBadge } from "../../components/LevelBadge";
import { getPreferences } from "../../lib/preferences";
import { translator } from "../../lib/i18n";
import { contactPlayer } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type Props = {
  searchParams?: Promise<{ sport?: string; page?: string }> | { sport?: string; page?: string };
};

function splitSports(value: string) {
  return value
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

export default async function SpillerePage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = translator((await getPreferences()).locale);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const selectedSport = (resolvedSearchParams.sport ?? "").trim();
  const requestedPage = Math.max(1, Number.parseInt(resolvedSearchParams.page ?? "1", 10) || 1);

  const [currentUserProfile, allPlayers] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { sports: true },
    }),
    db.user.findMany({
      where: {
        id: { not: user.id },
        role: { in: ["PLAYER", "COACH"] },
        country: user.country,
      },
      select: {
        id: true,
        name: true,
        level: true,
        area: true,
        bio: true,
        sports: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const sportOptions = Array.from(
    new Set([
      ...splitSports(currentUserProfile?.sports ?? ""),
      ...allPlayers.flatMap((player) => splitSports(player.sports)),
    ]),
  ).sort((a, b) => a.localeCompare(b, "da"));

  const filteredPlayers = selectedSport
    ? allPlayers.filter((player) =>
        splitSports(player.sports).some(
          (sport) => sport.toLocaleLowerCase("da") === selectedSport.toLocaleLowerCase("da"),
        ),
      )
    : allPlayers;

  // Pagination is primarily for "Alle sportsgrene", where the directory can
  // become long. A filtered sport stays simple and shows all matching players.
  const totalPages = selectedSport ? 1 : Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const players = selectedSport
    ? filteredPlayers
    : filteredPlayers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">{t("players.findTitle")}</h1>
        <Link href="/makkere" className="btn-ghost px-4 py-2">
          Se opslag
        </Link>
      </div>

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold">
          Sportsgren
          <select
            name="sport"
            defaultValue={selectedSport}
            className="mt-1 w-full rounded-xl border border-slate/20 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Alle sportsgrene</option>
            {sportOptions.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-court px-4 py-2.5">
          Filtrér
        </button>
        {selectedSport ? (
          <Link href="/spillere" className="btn-ghost px-4 py-2.5">
            Nulstil
          </Link>
        ) : null}
      </form>

      {players.length === 0 ? (
        <div className="card text-center">
          <p className="font-bold">
            {selectedSport
              ? `Ingen spillere er oprettet til ${selectedSport} endnu.`
              : "Ingen andre spillere er oprettet endnu."}
          </p>
          <p className="mt-2 text-sm text-slate/60">
            Du kan stadig oprette et opslag og skrive, hvem du søger.
          </p>
          <div className="mt-4">
            <Link href="/makkere/ny" className="btn-court inline-block px-5 py-3">
              Opret opslag
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {players.map((player) => {
              const sports = splitSports(player.sports).join(" · ");
              const initials = player.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("");

              return (
                <div key={player.id} className="card">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink">
                      <span className="display text-lg text-chalk">{initials}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-bold">{player.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <LevelBadge level={player.level} />
                            {player.role === "COACH" && (
                              <span className="rounded-full bg-court/10 px-2 py-1 text-xs font-semibold text-court">
                                Træner
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-slate/60">
                        {player.area ? <span>{player.area}</span> : null}
                        {player.area && sports ? <span> · </span> : null}
                        {sports ? <span>{sports}</span> : null}
                      </div>

                      {player.bio ? (
                        <p className="mt-3 text-sm leading-6">{player.bio}</p>
                      ) : null}

                      <form action={contactPlayer} className="mt-4">
                        <input type="hidden" name="playerId" value={player.id} />
                        <button className="btn-court px-4 py-2">Send besked</button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!selectedSport && totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Sider">
              {currentPage > 1 ? (
                <Link href={`/spillere?page=${currentPage - 1}`} className="btn-ghost px-4 py-2">
                  Forrige
                </Link>
              ) : null}

              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Link
                  key={page}
                  href={`/spillere?page=${page}`}
                  className={
                    page === currentPage
                      ? "rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-chalk"
                      : "btn-ghost px-4 py-2"
                  }
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </Link>
              ))}

              {currentPage < totalPages ? (
                <Link href={`/spillere?page=${currentPage + 1}`} className="btn-ghost px-4 py-2">
                  Næste
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
